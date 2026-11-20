import { getNigerianBanks, json, normalizePhone, pickProviders, resolveAll } from './functions/_lib/paystack.js';

async function handleBanks(context) {
  try {
    const banks = await getNigerianBanks(context);
    return json({ banks, updatedAt: new Date().toISOString(), source: 'Paystack List Banks API' });
  } catch (error) {
    return json({ error: error.message || 'Could not load Paystack bank directory.' }, 503);
  }
}

async function handleResolve(context) {
  const length = Number(context.request.headers.get('content-length') || 0);
  if (length > 4096) return json({ error: 'Request is too large.' }, 413);

  let input;
  try { input = await context.request.json(); }
  catch { return json({ error: 'Invalid request.' }, 400); }

  const accountNumber = normalizePhone(input?.phone ?? input?.accountNumber);
  if (!accountNumber) return json({ error: 'Enter a phone number.' }, 400);

  try {
    const providers = pickProviders(await getNigerianBanks(context), context.env.PROVIDER_SCOPE);
    const results = await resolveAll(providers, accountNumber, context.env);
    const matches = results.filter(result => result.status === 'found')
      .map(({ bank, code, accountName }) => ({ bank, code, accountName }));
    const incomplete = results.filter(result => result.status === 'error' || result.status === 'rate_limited')
      .map(result => result.bank);

    console.log(JSON.stringify({ event: 'phinder_lookup', accountSuffix: accountNumber.slice(-4), checked: providers.length, matches: matches.length }));
    return json({ normalized: accountNumber, checked: providers.length, matches, incomplete, provider: 'Paystack', timestamp: new Date().toISOString() });
  } catch (error) {
    if (error.message?.startsWith('Paystack is not configured')) return json({ error: error.message }, 503);
    return json({ error: 'Paystack is temporarily unavailable. Please try again later.' }, 502);
  }
}

export default {
  async fetch(request, env, executionContext) {
    const url = new URL(request.url);
    const context = { request, env, waitUntil: promise => executionContext.waitUntil(promise) };

    if (url.pathname === '/api/banks') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
      return handleBanks(context);
    }
    if (url.pathname === '/api/resolve') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
      return handleResolve(context);
    }
    return env.ASSETS.fetch(request);
  }
};
