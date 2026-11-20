const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

// Load local .env without adding a dependency. Never put the secret in browser code.
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

const PORT = Number(process.env.PORT || 4173);
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const attempts = new Map();
let bankCache = null;
let bankCacheExpires = 0;

// Only these files are ever served from disk. Keys are lower-case with spaces as underscores,
// so "/BabaSecure%20nobg.png" and "/BabaSecure_nobg.png" both resolve.
const STATIC = {
  '/': ['Phinder.html', 'text/html; charset=utf-8'],
  '/styles.css': ['../styles.css', 'text/css; charset=utf-8'],
  '/logo.css': ['../logo.css', 'text/css; charset=utf-8'],
  '/script.js': ['../script.js', 'text/javascript; charset=utf-8'],
  '/babasecure_nobg.png': ['../BabaSecure_nobg.png', 'image/png'],
  '/babasecure.png': ['../BabaSecure.png', 'image/png'],
  '/babasecure_full.png': ['../BabaSecure_full.png', 'image/png']
};

function staticEntry(pathname) {
  try { return STATIC[decodeURIComponent(pathname).toLowerCase().replace(/ /g, '_')]; } catch { return undefined; }
}

function send(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(data));
}

function serveStatic(res, [file, type]) {
  // Try the name as listed, then the same name with spaces instead of underscores.
  const candidates = [file, file.replace(/_/g, ' ')];
  const attempt = i => {
    if (i >= candidates.length) return send(res, 404, { error: 'Not found.' });
    fs.readFile(path.join(__dirname, candidates[i]), (err, buf) => {
      if (err) return attempt(i + 1);
      res.writeHead(200, { 'content-type': type, 'x-content-type-options': 'nosniff', 'cache-control': 'no-cache' });
      res.end(buf);
    });
  };
  attempt(0);
}

// Accepts any phone format: spaces, dashes, brackets, +234, 234, 00234, (0), leading 0, or none.
function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '').replace(/^00(?=234)/, '');
  if (d.startsWith('234') && d.length > 10) d = d.slice(3);
  if (d.startsWith('0') && d.length > 10) d = d.slice(1);
  return d;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of attempts) {
    const recent = times.filter(t => now - t < 60_000);
    recent.length ? attempts.set(ip, recent) : attempts.delete(ip);
  }
}, 60_000).unref();

async function getNigerianBanks() {
  if (bankCache && Date.now() < bankCacheExpires) return bankCache;
  if (!PAYSTACK_SECRET_KEY) throw new Error('Paystack is not configured. Set PAYSTACK_SECRET_KEY on this server.');

  const all = [];
  let cursor = null;
  for (let page = 0; page < 50; page += 1) {
    const url = new URL('https://api.paystack.co/bank');
    url.searchParams.set('country', 'nigeria');
    url.searchParams.set('perPage', '100');
    url.searchParams.set('use_cursor', 'true');
    url.searchParams.set('include_nip_sort_code', 'true');
    if (cursor) url.searchParams.set('next', cursor);
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, accept: 'application/json' },
      signal: AbortSignal.timeout(10_000)
    });
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

  bankCache = all
    .filter(bank => bank && bank.code && bank.name && bank.active !== false && bank.is_deleted !== true)
    .map(bank => ({
      name: String(bank.name),
      code: String(bank.code),
      nipCode: String(bank.nip_bank_code || bank.nip_institution_code || bank.nip_code || bank.nip_sort_code || ''),
      type: String(bank.type || ''),
      active: bank.active !== false
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  bankCacheExpires = Date.now() + 10 * 60 * 1000;
  return bankCache;
}

// Providers whose account numbers can be phone numbers: wallets, payment service banks, fintechs.
// Set PROVIDER_SCOPE=all in .env to check every active bank instead (slow, may hit rate limits).
const WALLET_NAMES = /opay|paycom|palmpay|psb|payment service|paga\b|momo|smartcash|moniepoint|9mobile|wallet|readycash|chams|vtnetworks|konga|visual ict|gomoney|eyowo/i;
// Codes confirmed in Paystack's list (Nov 2026). The regex above catches future renames and additions.
const WALLET_CODES = new Set([
  '999992', // OPay
  '999991', // PalmPay
  '120001', // 9mobile 9Payment Service Bank
  '120002', // HopePSB
  '120003', // MTN Momo PSB
  '120004', // Airtel Smartcash PSB
  '946',    // Money Master PSB
  '50515',  // Moniepoint MFB
  '100002', // Paga
  '311',    // Parkway - ReadyCash
  '100036', // CHAMS MOBILE MFB
  '00719',  // Kegow (Chamsmobile)
  '100022', // GoMoney
  '100025', // KONGAPAY
  '100023', // Visual ICT (TagPay)
  'C08',    // VTNetworks
  '100040', // Xpress Wallet
  '50126'   // Eyowo
]);
const CONCURRENCY = 5;
const MAX_RETRIES = 2;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function pickProviders(banks) {
  if (process.env.PROVIDER_SCOPE === 'all') return banks;
  // Paystack lists some codes twice (e.g. 100025 is both KongaPay and Kolomoni MFB).
  // Keep one entry per code, preferring the one whose name looks like a wallet.
  const byCode = new Map();
  for (const b of banks) {
    if (!(WALLET_CODES.has(b.code) || WALLET_NAMES.test(b.name))) continue;
    const prev = byCode.get(b.code);
    if (!prev || (WALLET_NAMES.test(b.name) && !WALLET_NAMES.test(prev.name))) byCode.set(b.code, b);
  }
  return [...byCode.values()];
}

async function resolveOne(bank, accountNumber) {
  const url = new URL('https://api.paystack.co/bank/resolve');
  url.searchParams.set('account_number', accountNumber);
  url.searchParams.set('bank_code', bank.code);
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, accept: 'application/json' },
        signal: AbortSignal.timeout(10_000)
      });
      if (response.status === 429) { await sleep(1000 * (attempt + 1)); continue; }
      const result = await response.json();
      if (response.ok && result.status === true && result.data?.account_name) {
        return { bank: bank.name, code: bank.code, status: 'found', accountName: String(result.data.account_name) };
      }
      return { bank: bank.name, code: bank.code, status: 'not_found' };
    } catch {
      if (attempt === MAX_RETRIES) return { bank: bank.name, code: bank.code, status: 'error' };
    }
  }
  return { bank: bank.name, code: bank.code, status: 'rate_limited' };
}

async function resolveAll(providers, accountNumber) {
  const results = new Array(providers.length);
  let next = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < providers.length) {
      const i = next++;
      results[i] = await resolveOne(providers[i], accountNumber);
    }
  }));
  return results;
}

const server = http.createServer(async (req, res) => {
  const pathname = (req.url || '/').split('?')[0];

  if (req.method === 'GET' && pathname === '/api/banks') {
    try {
      const banks = await getNigerianBanks();
      return send(res, 200, { banks, updatedAt: new Date().toISOString(), source: 'Paystack List Banks API' });
    } catch (error) {
      return send(res, 503, { error: error.message || 'Could not load Paystack bank directory.' });
    }
  }

  if (req.method === 'POST' && pathname === '/api/resolve') {
    const ip = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const previous = (attempts.get(ip) || []).filter(time => now - time < 60_000);
    if (previous.length >= 5) return send(res, 429, { error: 'Too many checks. Wait a minute and try again.' });
    previous.push(now); attempts.set(ip, previous);

    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 4096) return send(res, 413, { error: 'Request is too large.' });
    }
    let input;
    try { input = JSON.parse(body); } catch { return send(res, 400, { error: 'Invalid request.' }); }
    const accountNumber = normalizePhone(input.phone ?? input.accountNumber);
    if (!accountNumber) return send(res, 400, { error: 'Enter a phone number.' });
    if (!PAYSTACK_SECRET_KEY) return send(res, 503, { error: 'Paystack is not configured. Set PAYSTACK_SECRET_KEY on this server.' });

    try {
      const providers = pickProviders(await getNigerianBanks());
      const results = await resolveAll(providers, accountNumber);
      const matches = results.filter(r => r.status === 'found').map(({ bank, code, accountName }) => ({ bank, code, accountName }));
      const incomplete = results.filter(r => r.status === 'error' || r.status === 'rate_limited').map(r => r.bank);
      console.log(`[${new Date().toISOString()}] ip=${ip} acct=***${accountNumber.slice(-4)} checked=${providers.length} matches=${matches.length}`);
      send(res, 200, {
        normalized: accountNumber,
        checked: providers.length,
        matches,
        incomplete,
        provider: 'Paystack',
        timestamp: new Date().toISOString()
      });
    } catch {
      send(res, 502, { error: 'Paystack is temporarily unavailable. Please try again later.' });
    }
    return;
  }

  const entry = req.method === 'GET' ? staticEntry(pathname) : undefined;
  if (entry) return serveStatic(res, entry);
  send(res, 404, { error: 'Not found.' });
});

server.listen(PORT, '127.0.0.1', () => console.log(`Phinder listening on http://localhost:${PORT}`));
