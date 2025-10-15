// /api/qr/create.js  — FINAL
// ESM (Next/Vercel Edge/Node runtimes)

// ======== ENV ========
const { AUTH_USERNAME, AUTH_TOKEN, BASE_QR_STRING, STORE_NAME } = process.env;

// ======== CRC16-CCITT (poly 0x1021, init 0xFFFF) ========
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

// ======== Helper: ASCII <-> HEX ========
function asciiToHex(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) out += s.charCodeAt(i).toString(16).padStart(2, '0');
  return out.toUpperCase();
}

// ======== TLV utils (EMV string, ASCII content) ========
// Parse "ID(2) + LEN(2) + VALUE(len)" berulang → Map('id' -> 'value')
function parseTLV(s) {
  const map = new Map();
  let i = 0;
  while (i + 4 <= s.length) {
    const id = s.substr(i, 2);
    const len = parseInt(s.substr(i + 2, 2), 10);
    const start = i + 4;
    const end = start + len;
    if (isNaN(len) || end > s.length) break;
    const val = s.substring(start, end);
    map.set(id, val);
    i = end;
  }
  return map;
}
// Serialize Map → EMV string
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

// ======== CORE: build QRIS dinamis dari base + amount + reference ========
function buildQRIS({ base, amount, reference }) {
  if (!base) throw new Error('BASE_QR_STRING kosong');
  const amtStr = String(Math.round(Number(amount) || 0));
  if (!/^\d+$/.test(amtStr) || Number(amtStr) < 1) {
    throw new Error('amount minimal 1 (angka)');
  }

  // 1) buang CRC lama kalau ada (…6304XXXX)
  let raw = base.trim().replace(/6304[0-9A-Fa-f]{4}$/, '');

  // 2) pastikan header dinamis (Tag 00-01-..) — force 01=12
  //    Banyak base merchant pakai 010211 (static). Kita paksa 010212 (dynamic).
  //    Aman dipakai walaupun base sudah benar.
  raw = raw.replace(/^000201010211/, '000201010212');

  // 3) parse TLV top-level
  const tlvs = parseTLV(raw);

  // Safety: paksa 01=12
  tlvPut(tlvs, '01', '12');

  // 4) Tag 54 = Nominal
  tlvPut(tlvs, '54', amtStr);

  // 5) Tag 62 (Additional Data Field) → sub-TLV; 62/01 = reference
  const tag62raw = tlvGet(tlvs, '62') || '';
  const tag62map = parseTLV(tag62raw);
  tlvPut(tag62map, '01', reference);           // 62/01: Reference Label
  const tag62str = tlvSerialize(tag62map);
  tlvPut(tlvs, '62', tag62str);

  // 6) buang CRC (63) sebelum hitung ulang
  tlvDel(tlvs, '63');
  const noCRC = tlvSerialize(tlvs);

  // 7) CRC: hitung atas ASCII+‘6304’
  const forCRC = noCRC + '6304';
  const crc = crc16ccitt(asciiToHex(forCRC));

  // 8) final
  return forCRC + crc;
}

// ======== Response helpers ========
function ok(res, data) {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ success: true, ...data });
}
function err(res, code, message) {
  res.setHeader('Content-Type', 'application/json');
  res.status(code).json({ success: false, message });
}

// ======== CORS (optional) ========
function applyCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ======== Handler ========
export default async function handler(req, res) {
  applyCORS(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Quick test via GET: /api/qr/create?amount=10000
  if (req.method === 'GET') {
    const amount = Number(req.query.amount || 0);
    if (!amount) {
      return ok(res, {
        info: 'Use POST to create QR. Quick test: /api/qr/create?amount=10000',
        store: STORE_NAME || 'LevPay',
      });
    }
    try {
      const reference = 'REF' + Date.now();
      const qris = buildQRIS({
        base: BASE_QR_STRING,
        amount,
        reference
      });
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
    const { amount, meta } = req.body || {};
    const amt = Number(amount);
    if (!amt || amt < 1) return err(res, 400, 'amount minimal 1');

    // opsional: pastikan kredensial Orkut terisi (kalau mau dipakai di endpoint lain)
    if (!AUTH_USERNAME || !AUTH_TOKEN) {
      // tidak fatal untuk generate QR base, tapi kasih warning:
      console.warn('[WARN] AUTH_USERNAME/AUTH_TOKEN kosong — hanya generate QR.');
    }

    const reference = 'REF' + Date.now();
    const qris = buildQRIS({
      base: BASE_QR_STRING,
      amount: amt,
      reference
    });

    const qr_image_url =
      'https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=' +
      encodeURIComponent(qris);

    return ok(res, {
      store: STORE_NAME || 'LevPay',
      reference,
      amount: amt,
      meta: meta || null,
      qris,
      qr_image_url
    });
  } catch (e) {
    return err(res, 500, e.message || 'internal error');
  }
}