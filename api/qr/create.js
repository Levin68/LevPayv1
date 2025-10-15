import { QRISGenerator } from 'autoft-qris';

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const { amount } = req.body || {};
    const amt = Number(amount);
    if (!amt || amt < 1) {
      return res.status(400).json({ success: false, message: 'amount minimal 1' });
    }

    const gen = new QRISGenerator({
      storeName: process.env.STORE_NAME || 'LevPay',
      auth_username: process.env.AUTH_USERNAME,
      auth_token: process.env.AUTH_TOKEN,
      baseQrString: process.env.BASE_QR_STRING
      // tanpa logo & tema khusus
    });

    const reference = 'REF' + Date.now();      // ref unik
    const qrString = gen.generateQrString(amt);
    const qrBuffer = await gen.generateQRWithLogo(qrString); // tanpa logoPath = PNG plain
    const qrBase64 = qrBuffer.toString('base64');

    return res.status(200).json({
      success: true,
      reference,
      amount: amt,
      qr_string: qrString,
      qr_image: `data:image/png;base64,${qrBase64}`
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: e.message || 'internal error' });
  }
}