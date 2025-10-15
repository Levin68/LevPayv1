import { PaymentChecker } from 'autoft-qris';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { reference, amount } = req.body || {};
    const amt = Number(amount);

    if (!reference || !amt) {
      return res.status(400).json({ success: false, message: 'reference & amount wajib' });
    }

    const AUTH_USERNAME = process.env.AUTH_USERNAME;
    const AUTH_TOKEN    = process.env.AUTH_TOKEN;

    if (!AUTH_USERNAME || !AUTH_TOKEN) {
      return res.status(500).json({ success: false, message: 'Missing environment configuration' });
    }

    const checker = new PaymentChecker({
      auth_username: AUTH_USERNAME,
      auth_token: AUTH_TOKEN
    });

    const result = await checker.checkPaymentStatus(reference, amt);
    // result.data.status biasanya: 'PENDING' | 'PAID' | 'FAILED'
    return res.status(200).json(result);
  } catch (err) {
    console.error('Status Error:', err);
    res.status(500).json({ success: false, message: err.message || 'internal error' });
  }
}