// api/qr/create.js — FINAL (ESM)

export const config = { runtime: "edge" };

// ===== ENV =====
const { AUTH_USERNAME, AUTH_TOKEN, BASE_QR_STRING, STORE_NAME } = process.env;

// ===== CRC16-CCITT =====
function crc16ccitt(hex) {
  let crc = 0xffff;
  for (let i = 0; i < hex.length; i += 2) {
    const b = parseInt(hex.substr(i, 2), 16);
    crc ^= (b << 8);
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1), crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
const asciiToHex = (s) => Array.from(s, c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("").toUpperCase();

// ===== TLV =====
function parseTLV(s) {
  const m = new Map(); let i = 0;
  while (i + 4 <= s.length) {
    const id = s.substr(i, 2); const len = parseInt(s.substr(i + 2, 2), 10);
    const start = i + 4, end = start + len; if (isNaN(len) || end > s.length) break;
    m.set(id, s.substring(start, end)); i = end;
  }
  return m;
}
function tlvSerialize(m) { let out=""; for (const [id,v] of m) out += id + String(v.length).padStart(2,"0") + v; return out; }
const tlvGet = (m, id) => (m.has(id) ? m.get(id) : null);
const tlvPut = (m, id, v) => m.set(id, String(v ?? ""));
const tlvDel = (m, id) => m.delete(id);

// ===== builder (default: keep tag 01 dari base) =====
function buildQRIS({ base, amount, reference, forceDynamic = false }) {
  if (!base) throw new Error("BASE_QR_STRING kosong");
  const amtStr = String(Math.round(Number(amount) || 0));
  if (!/^\d+$/.test(amtStr) || Number(amtStr) < 1) throw new Error("amount minimal 1");

  let raw = base.trim().replace(/6304[0-9A-Fa-f]{4}$/, "");
  const tlvs = parseTLV(raw);

  if (forceDynamic) tlvPut(tlvs, "01", "12"); // kalau tidak, biarkan bawaan base (11/12)
  tlvPut(tlvs, "54", amtStr);

  const tag62 = parseTLV(tlvGet(tlvs, "62") || "");
  tlvPut(tag62, "01", String(reference).slice(0, 25));
  tlvPut(tlvs, "62", tlvSerialize(tag62));

  tlvDel(tlvs, "63");
  const noCRC = tlvSerialize(tlvs);
  const withTag = noCRC + "6304";
  const crc = crc16ccitt(asciiToHex(withTag));
  return withTag + crc;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

export default async function handler(req) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  const url = new URL(req.url);

  // simple debug
  if (url.pathname.endsWith("/api/qr/debug")) {
    return json({
      ok: true,
      store: STORE_NAME || "LevPay",
      has_base: Boolean(BASE_QR_STRING),
      has_auth: Boolean(AUTH_USERNAME && AUTH_TOKEN),
    });
  }

  if (!url.pathname.endsWith("/api/qr/create")) {
    return json({ success: false, message: "Not found" }, 404);
  }

  try {
    let amount = url.searchParams.get("amount");
    const mode = (url.searchParams.get("mode") || "keep").toLowerCase(); // keep | force12
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body && body.amount != null) amount = body.amount;
    }
    const amt = Number(amount || 0);
    if (!amt || amt < 1) return json({ success: false, message: "amount minimal 1" }, 400);
    if (!BASE_QR_STRING) return json({ success: false, message: "BASE_QR_STRING belum diset" }, 400);

    const reference = "REF" + Date.now();
    const qris = buildQRIS({
      base: BASE_QR_STRING,
      amount: amt,
      reference,
      forceDynamic: mode === "force12",
    });
    const qr_image_url = "https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=" + encodeURIComponent(qris);

    return json({ success: true, store: STORE_NAME || "LevPay", reference, amount: amt, qris, qr_image_url });
  } catch (e) {
    return json({ success: false, message: String(e?.message || e) }, 500);
  }
}