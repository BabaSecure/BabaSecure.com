import { getNigerianBanks, json, normalizePhone, pickProviders, resolveAll } from './functions/_lib/paystack.js';

async function handleResolve(context) {
  const length = Number(context.request.headers.get('content-length') || 0);
  if (length > 4096) return json({ error: 'Request is too large.' }, 413);

  let input;
  try { input = await context.request.json(); }
  catch { return json({ error: 'Invalid request.' }, 400); }

  const accountNumber = normalizePhone(input?.phone ?? input?.accountNumber);
  if (accountNumber.length !== 10) return json({ error: 'Enter a valid phone number.' }, 400);

  try {
    const providers = pickProviders(await getNigerianBanks(context), context.env.PROVIDER_SCOPE);
    const results = await resolveAll(providers, accountNumber, context.env);
    const names = [...new Set(results.filter(result => result.status === 'found').map(result => result.accountName))];
    const matches = names.map(accountName => ({ accountName }));

    console.log(JSON.stringify({ event: 'phinder_lookup', accountSuffix: accountNumber.slice(-4), checked: providers.length, matches: matches.length }));
    return json({ matches, timestamp: new Date().toISOString() });
  } catch (error) {
    return json({ error: 'Search currently unavailable. Please try again.' }, 502);
  }
}

export default {
  async fetch(request, env, executionContext) {
    const url = new URL(request.url);
    const context = { request, env, waitUntil: promise => executionContext.waitUntil(promise) };

    if (url.pathname === '/phinder' || url.pathname === '/phinder/') {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = '/Phinder/Phinder.html';
      return env.ASSETS.fetch(new Request(assetUrl, request));
    }
    if (url.pathname === '/api/resolve') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
      return handleResolve(context);
    }
    return env.ASSETS.fetch(request);
  }
};
