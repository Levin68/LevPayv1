// api/qr/create.js
import { QRISGenerator } from 'autoft-qris';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    const { amount } = req.body || {};
    const amt = Number(amount);

    if (!amt || amt < 1) {
      return res.status(400).json({
        success: false,
        message: 'Nominal tidak valid (minimal 1)'
      });
    }

    // 🔐 ambil data dari environment (Vercel/.env)
    const config = {
      storeName: process.env.STORE_NAME || 'LevPay',
      auth_username: process.env.AUTH_USERNAME,
      auth_token: process.env.AUTH_TOKEN,
      baseQrString: process.env.BASE_QR_STRING
    };

    const qrisGen = new QRISGenerator(config, 'theme1');

    const reference = 'REF' + Date.now();
    const qrString = qrisGen.generateQrString(amt);
    const qrBuffer = await qrisGen.generateQRWithLogo(qrString);
    const qrBase64 = qrBuffer.toString('base64');

    return res.status(200).json({
      success: true,
      reference,
      amount: amt,
      qr_string: qrString,
      qr_image: `data:image/png;base64,${qrBase64}`
    });
  } catch (err) {
    console.error('QRIS Error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error'
    });
  }
}