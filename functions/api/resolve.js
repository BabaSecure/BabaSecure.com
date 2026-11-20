import { getNigerianBanks, json, normalizePhone, pickProviders, resolveAll } from '../_lib/paystack.js';

export async function onRequestPost(context) {
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
    const matches = results
      .filter(result => result.status === 'found')
      .map(({ bank, code, accountName }) => ({ bank, code, accountName }));
    const incomplete = results
      .filter(result => result.status === 'error' || result.status === 'rate_limited')
      .map(result => result.bank);

    console.log(JSON.stringify({
      event: 'phinder_lookup',
      accountSuffix: accountNumber.slice(-4),
      checked: providers.length,
      matches: matches.length
    }));
    return json({
      normalized: accountNumber,
      checked: providers.length,
      matches,
      incomplete,
      provider: 'Paystack',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    if (error.message?.startsWith('Paystack is not configured')) return json({ error: error.message }, 503);
    return json({ error: 'Paystack is temporarily unavailable. Please try again later.' }, 502);
  }
}
