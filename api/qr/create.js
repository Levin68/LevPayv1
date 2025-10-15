import { QRISGenerator } from 'autoft-qris';
import QRCode from 'qrcode';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { amount } = req.body || {};
    const amt = Number(amount);
    if (!amt || amt < 1) {
      return res.status(400).json({ success: false, message: 'amount minimal 1' });
    }

    // Ambil dari Environment Vercel
    const STORE_NAME    = process.env.STORE_NAME ?? 'LevPay';
    const AUTH_USERNAME = process.env.AUTH_USERNAME;
    const AUTH_TOKEN    = process.env.AUTH_TOKEN;
    const BASE_QR       = process.env.BASE_QR_STRING;

    if (!AUTH_USERNAME || !AUTH_TOKEN || !BASE_QR) {
      return res.status(500).json({ success: false, message: 'Missing environment configuration' });
    }

    // 1) Generate QRIS string via autoft-qris (tanpa logo/tema)
    const gen = new QRISGenerator({
      storeName: STORE_NAME,
      auth_username: AUTH_USERNAME,
      auth_token: AUTH_TOKEN,
      baseQrString: BASE_QR
    });

    const reference = 'REF' + Date.now();
    const qrString  = gen.generateQrString(amt);

    // 2) Render PNG murni via 'qrcode' (pure JS → tidak butuh canvas native)
    const pngBuffer = await QRCode.toBuffer(qrString, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320
    });

    res.status(200).json({
      success: true,
      reference,
      amount: amt,
      qr_string: qrString,
      qr_image: `data:image/png;base64,${pngBuffer.toString('base64')}`
    });
  } catch (err) {
    console.error('QR Create Error:', err);
    res.status(500).json({ success: false, message: err.message || 'internal error' });
  }
}