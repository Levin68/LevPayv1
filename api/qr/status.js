import { PaymentChecker } from 'autoft-qris';

export default async function handler(req, res) {
  try {
    const { reference, amount } = req.query;
    if (!reference || !amount) {
      return res.status(400).json({ success: false, message: 'query ?reference=&amount=' });
    }

    const checker = new PaymentChecker({
      auth_username: process.env.AUTH_USERNAME,
      auth_token: process.env.AUTH_TOKEN
    });

    const resp = await checker.checkPaymentStatus(reference, Number(amount));
    // resp.data.status biasanya: PENDING / PAID / EXPIRED
    return res.status(200).json(resp);
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: e.message || 'internal error' });
  }
}