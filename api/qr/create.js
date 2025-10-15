// CommonJS biar aman di Vercel tanpa set "type":"module"
const { QRISGenerator } = require('autoft-qris');

module.exports = async (req, res) => {
  // CORS aman-aman (walau 1 domain)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST')
    return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const { amount, meta } = req.body || {};
    const amt = Number(amount);
    if (!amt || amt < 1) {
      return res.status(400).json({ success: false, message: 'amount minimal 1' });
    }

    const gen = new QRISGenerator({
      storeName: process.env.STORE_NAME || 'LevPay',
      auth_username: process.env.AUTH_USERNAME,
      auth_token: process.env.AUTH_TOKEN,
      baseQrString: process.env.BASE_QR_STRING
      // tanpa logo & tema
    });

    const reference = 'REF' + Date.now();
    const qrString = gen.generateQrString(amt);

    // pakai layanan QR image eksternal (tanpa canvas build)
    const qrImageUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=320x320&data='
      + encodeURIComponent(qrString);

    return res.status(200).json({
      success: true,
      store: process.env.STORE_NAME || 'LevPay',
      reference,
      amount: amt,
      qris: qrString,
      qr_image_url: qrImageUrl
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: e.message || 'internal error' });
  }
};