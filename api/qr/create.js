// /api/qr/create.js
const { AUTH_USERNAME, AUTH_TOKEN, BASE_QR_STRING, STORE_NAME } = process.env;

// CRC16-CCITT (0x1021, init 0xFFFF)
function crc16ccitt(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

// bikin string QRIS dari base + amount (simulasi)
function buildQrisString(amount) {
  if (!BASE_QR_STRING) throw new Error('BASE_QR_STRING is empty');
  const amt = String(Math.round(Number(amount) || 0));
  const payload = `${BASE_QR_STRING}|A${amt}`;
  const crc = crc16ccitt(payload);
  return `${payload}|${crc}`;
}

function ok(res, data) {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ success: true, ...data });
}
function err(res, code, message) {
  res.setHeader('Content-Type', 'application/json');
  res.status(code).json({ success: false, message });
}

// CORS (kalau nanti dipanggil dari domain lain)
function applyCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  applyCORS(res);

  if (req.method === 'OPTIONS') return res.status(204).end();

  // === GET mode (buat test manual dari browser) ===
  if (req.method === 'GET') {
    const amount = Number(req.query.amount || 0);
    if (!amount || amount < 1) {
      return ok(res, {
        info: 'Use POST to create QR. For quick test: /api/qr/create?amount=10000&nama=Levin&note=Test',
        store: STORE_NAME || 'LevPay',
      });
    }
    try {
      const qrString = buildQrisString(amount);
      const qrImage = 'https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=' +
        encodeURIComponent(qrString);
      const reference = 'REF' + Date.now();
      return ok(res, {
        store: STORE_NAME || 'LevPay',
        reference,
        amount,
        qris: qrString,
        qr_image_url: qrImage
      });
    } catch (e) {
      return err(res, 500, e.message || 'internal error');
    }
  }

  // === POST mode (utama) ===
  if (req.method !== 'POST') return err(res, 405, 'Method not allowed');

  try {
    const { amount, meta } = req.body || {};
    const amt = Number(amount);
    if (!amt || amt < 1) return err(res, 400, 'amount minimal 1');

    // (opsional) validasi kredensial orkut
    if (!AUTH_USERNAME || !AUTH_TOKEN) {
      return err(res, 500, 'Missing AUTH_USERNAME/AUTH_TOKEN');
    }

    const qrString = buildQrisString(amt);
    const reference = 'REF' + Date.now();

    // Render QR via third-party (no native deps)
    const qrImageUrl =
      'https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=' +
      encodeURIComponent(qrString);

    return ok(res, {
      store: STORE_NAME || 'LevPay',
      reference,
      amount: amt,
      qris: qrString,
      meta: meta || null,
      qr_image_url: qrImageUrl
    });
  } catch (e) {
    return err(res, 500, e.message || 'internal error');
  }
}