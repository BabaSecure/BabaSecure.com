import { getNigerianBanks, json } from '../_lib/paystack.js';

export async function onRequestGet(context) {
  try {
    const banks = await getNigerianBanks(context);
    return json({ banks, updatedAt: new Date().toISOString(), source: 'Paystack List Banks API' });
  } catch (error) {
    return json({ error: error.message || 'Could not load Paystack bank directory.' }, 503);
  }
}
