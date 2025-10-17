// /api/qr/create.js — FIXED (biar bisa TF)

// ======== ENV ========
const { AUTH_USERNAME, AUTH_TOKEN, BASE_QR_STRING, STORE_NAME } = process.env;

// ======== CRC16-CCITT (0x1021, init 0xFFFF) ========
function crc16ccitt(hexStr) {
  let crc = 0xffff;
  for (let i = 0; i < hexStr.length; i += 2) {
    const byte = parseInt(hexStr.substr(i, 2), 16);
    crc ^= (byte << 8);
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
function asciiToHex(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) out += s.charCodeAt(i).toString(16).padStart(2, '0');
  return out.toUpperCase();
}

// ======== TLV helpers ========
function parseTLV(s) {
  const map = new Map();
  let i = 0;
  while (i + 4 <= s.length) {
    const id = s.substr(i, 2);
    const len = parseInt(s.substr(i + 2, 2), 10);
    const start = i + 4;
    const end = start + len;
    if (isNaN(len) || end > s.length) break;
    map.set(id, s.substring(start, end));
    i = end;
  }
  return map;
}
function tlvSerialize(map) {
  let out = '';
  for (const [id, val] of map.entries()) {
    out += id + String(val.length).padStart(2, '0') + val;
  }
  return out;
}
const tlvGet = (m, id) => (m.has(id) ? m.get(id) : null);
function tlvPut(m, id, val) { m.set(id, String(val ?? '')); }
function tlvDel(m, id) { m.delete(id); }

// ======== Ref numeric ≤ 16 digit ========
function nextNumericRef() {
  const ts = Math.floor(Date.now() / 1000);
  const rnd = Math.floor(Math.random() * 1000);
  return String((ts * 1000 + rnd) % 1e16).padStart(10, '0'); // 10–16 digit ok
}

// ======== Build QRIS dari base static + amount + ref ========
function buildQRIS({ base, amount, reference }) {
  if (!base) throw new Error('BASE_QR_STRING kosong');

  // minimal 1000 biar tidak ditolak acquirer
  const amt = Math.max(1000, Math.round(Number(amount) || 0));
  const amtStr = String(amt);

  // 1) buang CRC lama
  let raw = base.trim().replace(/6304[0-9A-Fa-f]{4}$/, '');

  // 2) JANGAN paksa 010212 — biarkan 010211 (static)
  //    Kalau base sudah 010212 biarkan, tapi jangan ganti.
  const tlvs = parseTLV(raw);
  const poi = tlvGet(tlvs, '01');
  if (poi !== '11' && poi !== '12') tlvPut(tlvs, '01', '11'); // fallback aman

  // 3) set amount (54)
  tlvPut(tlvs, '54', amtStr);

  // 4) set reference numeric di 62/01
  const tag62raw = tlvGet(tlvs, '62') || '';
  const tag62map = parseTLV(tag62raw);
  tlvPut(tag62map, '01', reference);
  tlvPut(tlvs, '62', tlvSerialize(tag62map));

  // 5) CRC ulang
  tlvDel(tlvs, '63');
  const noCRC = tlvSerialize(tlvs);
  const forCRC = noCRC + '6304';
  const crc = crc16ccitt(asciiToHex(forCRC));
  return forCRC + crc;
}

// ======== Helpers response ========
function ok(res, data) {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ success: true, ...data });
}
function err(res, code, message) {
  res.setHeader('Content-Type', 'application/json');
  res.status(code).json({ success: false, message });
}
function applyCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

// ======== Handler ========
export default async function handler(req, res) {
  applyCORS(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  // GET quick test
  if (req.method === 'GET') {
    const amount = Number(req.query.amount || 0) || 1000;
    try {
      const reference = nextNumericRef();
      const qris = buildQRIS({ base: BASE_QR_STRING, amount, reference });
      const qr_image_url =
        'https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=' +
        encodeURIComponent(qris);
      return ok(res, {
        store: STORE_NAME || 'LevPay',
        reference,
        amount,
        qris,
        qr_image_url
      });
    } catch (e) {
      return err(res, 500, e.message || 'internal error');
    }
  }

  if (req.method !== 'POST') return err(res, 405, 'Method not allowed');

  try {
    const { amount } = req.body || {};
    const amt = Number(amount) || 0;
    if (amt < 1) return err(res, 400, 'amount minimal 1');

    const reference = nextNumericRef();
    const qris = buildQRIS({ base: BASE_QR_STRING, amount: amt, reference });
    const qr_image_url =
      'https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=' +
      encodeURIComponent(qris);

    return ok(res, {
      store: STORE_NAME || 'LevPay',
      reference,
      amount: Math.max(1000, Math.round(amt)),
      qris,
      qr_image_url
    });
  } catch (e) {
    return err(res, 500, e.message || 'internal error');
  }
}