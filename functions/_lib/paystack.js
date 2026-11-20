const PAYSTACK_API = 'https://api.paystack.co';
const CACHE_KEY = new Request('https://phinder-cache.internal/nigerian-providers');
const CACHE_TTL_SECONDS = 600;

// Providers whose account numbers can be phone numbers: wallets, payment service banks, and fintechs.
const WALLET_NAMES = /opay|paycom|palmpay|psb|payment service|paga\b|momo|smartcash|moniepoint|9mobile|wallet|readycash|chams|vtnetworks|konga|visual ict|gomoney|eyowo/i;
const WALLET_CODES = new Set([
  '999992', '999991', '120001', '120002', '120003', '120004', '946', '50515',
  '100002', '311', '100036', '00719', '100022', '100025', '100023', 'C08',
  '100040', '50126'
]);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  }
});

export function normalizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '').replace(/^00(?=234)/, '');
  if (digits.startsWith('234') && digits.length > 10) digits = digits.slice(3);
  if (digits.startsWith('0') && digits.length > 10) digits = digits.slice(1);
  return digits;
}

function requireSecret(env) {
  if (!env.PAYSTACK_SECRET_KEY) {
    throw new Error('Paystack is not configured. Add PAYSTACK_SECRET_KEY in Cloudflare Variables and Secrets.');
  }
  return env.PAYSTACK_SECRET_KEY;
}

async function paystackFetch(url, secret) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    return await fetch(url, {
      headers: { authorization: `Bearer ${secret}`, accept: 'application/json' },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function getNigerianBanks(context) {
  const cached = await caches.default.match(CACHE_KEY);
  if (cached) return cached.json();

  const secret = requireSecret(context.env);
  const all = [];
  let cursor = null;
  for (let page = 0; page < 50; page += 1) {
    const url = new URL('/bank', PAYSTACK_API);
    url.searchParams.set('country', 'nigeria');
    url.searchParams.set('perPage', '100');
    url.searchParams.set('use_cursor', 'true');
    url.searchParams.set('include_nip_sort_code', 'true');
    if (cursor) url.searchParams.set('next', cursor);
    const response = await paystackFetch(url, secret);
    const result = await response.json();
    if (!response.ok || result.status !== true || !Array.isArray(result.data)) {
      throw new Error('Paystack did not return a bank directory.');
    }
    all.push(...result.data);
    const next = result.meta?.next;
    if (!next || result.data.length === 0) break;
    cursor = next;
    if (page === 49) throw new Error('Paystack bank directory pagination limit reached.');
  }

  const banks = all
    .filter(bank => bank && bank.code && bank.name && bank.active !== false && bank.is_deleted !== true)
    .map(bank => ({
      name: String(bank.name),
      code: String(bank.code),
      nipCode: String(bank.nip_bank_code || bank.nip_institution_code || bank.nip_code || bank.nip_sort_code || ''),
      type: String(bank.type || ''),
      active: bank.active !== false
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const cacheResponse = new Response(JSON.stringify(banks), {
    headers: { 'cache-control': `public, max-age=${CACHE_TTL_SECONDS}` }
  });
  context.waitUntil(caches.default.put(CACHE_KEY, cacheResponse));
  return banks;
}

export function pickProviders(banks, scope) {
  if (scope === 'all') return banks;
  const byCode = new Map();
  for (const bank of banks) {
    if (!(WALLET_CODES.has(bank.code) || WALLET_NAMES.test(bank.name))) continue;
    const existing = byCode.get(bank.code);
    if (!existing || (WALLET_NAMES.test(bank.name) && !WALLET_NAMES.test(existing.name))) byCode.set(bank.code, bank);
  }
  return [...byCode.values()];
}

async function resolveOne(bank, accountNumber, secret) {
  const url = new URL('/bank/resolve', PAYSTACK_API);
  url.searchParams.set('account_number', accountNumber);
  url.searchParams.set('bank_code', bank.code);
  for (let attempt = 0; attempt <= 2; attempt += 1) {
    try {
      const response = await paystackFetch(url, secret);
      if (response.status === 429) { await sleep(1000 * (attempt + 1)); continue; }
      const result = await response.json();
      if (response.ok && result.status === true && result.data?.account_name) {
        return { bank: bank.name, code: bank.code, status: 'found', accountName: String(result.data.account_name) };
      }
      return { bank: bank.name, code: bank.code, status: 'not_found' };
    } catch {
      if (attempt === 2) return { bank: bank.name, code: bank.code, status: 'error' };
    }
  }
  return { bank: bank.name, code: bank.code, status: 'rate_limited' };
}

export async function resolveAll(providers, accountNumber, env) {
  const secret = requireSecret(env);
  const results = new Array(providers.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(5, providers.length) }, async () => {
    while (next < providers.length) {
      const index = next++;
      results[index] = await resolveOne(providers[index], accountNumber, secret);
    }
  });
  await Promise.all(workers);
  return results;
}
