// api/qr/create.js
// Build QRIS dinamis: sisipkan Tag 54 (amount) dan hitung ulang CRC (Tag 63)
// Tanpa dependency native.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { amount, note } = req.body || {};
    const amt = Number(amount);
    if (!amt || amt < 1) {
      return res.status(400).json({ success: false, message: 'amount minimal 1' });
    }

    const STORE_NAME = process.env.STORE_NAME || 'LevPay';
    const BASE = (process.env.BASE_QR_STRING || '').trim();
    if (!BASE) {
      return res.status(500).json({ success: false, message: 'BASE_QR_STRING belum di-set' });
    }

    // --- TLV helpers ---
    const toTLV = (id, value) => id + String(value.length).padStart(2, '0') + value;

    // parse TLV ke object tag->value
    function parseTLV(s) {
      const out = {};
      let i = 0;
      while (i + 4 <= s.length) {
        const id = s.slice(i, i + 2);
        const len = parseInt(s.slice(i + 2, i + 4), 10);
        const val = s.slice(i + 4, i + 4 + len);
        out[id] = val;
        i += 4 + len;
      }
      return out;
    }

    // rebuild TLV dari object (urut menurut urutan kemunculan awal sebisanya)
    function buildTLV(obj, order) {
      const ids = order?.filter(id => obj[id] !== undefined) ?? Object.keys(obj);
      let s = '';
      for (const id of ids) s += toTLV(id, obj[id]);
      return s;
    }

    // CRC16-CCITT (0x1021) initial 0xFFFF
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

    // 1) parse base, buang Tag 54 (amount) jika ada & Tag 63 (CRC)
    const tags = parseTLV(BASE);
    delete tags['54'];
    delete tags['63'];

    // 2) set Tag 54 = amount (format EMV: 2 desimal). Banyak wallet terima "50000.00"
    const fixedAmount = amt.toFixed(2);
    tags['54'] = fixedAmount;

    // 3) rakit kembali string tanpa CRC
    //    Usaha mempertahankan urutan: ambil urutan tag dari BASE lalu tambahkan '54' bila belum ada
    const baseOrder = [];
    let i = 0;
    while (i + 4 <= BASE.length) {
      const id = BASE.slice(i, i + 2);
      const len = parseInt(BASE.slice(i + 2, i + 4), 10);
      baseOrder.push(id);
      i += 4 + len;
    }
    if (!baseOrder.includes('54')) baseOrder.splice(baseOrder.indexOf('53') + 1 || baseOrder.length, 0, '54'); // taruh setelah '53' bila ada

    const withoutCRC = buildTLV(tags, baseOrder) + '6304'; // append ID '63' + length '04' sebelum hitung CRC

    // 4) CRC
    const crc = crc16ccitt(withoutCRC);
    const qrisString = withoutCRC + crc;

    // 5) Buat reference
    const reference = 'REF' + Date.now();

    // 6) Frontend nanti pakai URL ini untuk render QR (tanpa canvas native)
    const qr_image_url =
      'https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=' +
      encodeURIComponent(qrisString);

    return res.status(200).json({
      success: true,
      store: STORE_NAME,
      reference,
      amount: amt,
      qris: qrisString,
      qr_image_url,
      note: note || null
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: e.message || 'internal error' });
  }
}