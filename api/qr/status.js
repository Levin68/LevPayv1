// /api/qr/status.js  — REAL PAYMENT (OrderKuota)
// ESM compatible (Vercel/Next API)

const { AUTH_USERNAME, AUTH_TOKEN } = process.env;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
function ok(res, data) {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({ success: true, data });
}
function bad(res, msg, code = 400) {
  res.setHeader('Content-Type', 'application/json');
  res.status(code).json({ success: false, message: msg });
}

function normalize(result) {
  if (!result || typeof result !== 'object') return null;
  const data = result.data || result.result || result;
  if (!data || typeof data !== 'object') return null;

  // normalisasi field yang mungkin beda-beda
  const status = String(
    data.status ||
    data.payment_status ||
    data.transaction_status ||
    ''
  ).toUpperCase();

  const amount = Number(
    data.amount ||
    data.nominal ||
    data.total ||
    data.gross_amount ||
    0
  );

  const paidAt =
    data.paid_at || data.paidAt || data.date || data.transaction_time || null;

  const ref = String(
    data.ref || data.reference || data.order_id || data.transaction_id || ''
  );

  return { status, amount, paidAt, ref, raw: data };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const isGet = req.method === 'GET';
  const isPost = req.method === 'POST';
  if (!isGet && !isPost) return bad(res, 'Method not allowed', 405);

  const reference = isGet ? req.query.reference : req.body?.reference;
  const amount = Number(isGet ? req.query.amount : req.body?.amount);

  if (!reference || !amount) return bad(res, 'reference & amount required');
  if (!AUTH_USERNAME || !AUTH_TOKEN)
    return bad(res, 'Missing AUTH_USERNAME/AUTH_TOKEN (set di Vercel env)', 500);

  try {
    // dynamic import supaya aman ESM/CommonJS
    const mod = await import('autoft-qris');
    const PaymentChecker = mod.PaymentChecker || mod.default?.PaymentChecker;
    if (!PaymentChecker) throw new Error('PaymentChecker not found in autoft-qris');

    const checker = new PaymentChecker({
      auth_username: AUTH_USERNAME,
      auth_token: AUTH_TOKEN,
    });

    // panggil API OrderKuota via helper lib
    const result = await checker.checkPaymentStatus(reference, amount);
    const n = normalize(result);

    // fallback kalau respon aneh
    if (!n) return ok(res, { reference, amount, status: 'PENDING' });

    // map status ke 2 state utama
    const PAID_STATUSES = new Set([
      'PAID','SUCCESS','COMPLETED','SETTLEMENT','CAPTURE','CONFIRMED','SUCCESSFUL','PAID_OFF','DONE'
    ]);
    const status = PAID_STATUSES.has(n.status) ? 'PAID' : 'PENDING';

    return ok(res, {
      reference,
      amount,
      status,
      paid_at: n.paidAt || null,
      provider_ref: n.ref || null,
      raw: n.raw || null,   // simpan raw utk debugging (opsional)
    });
  } catch (e) {
    console.error('[status] error:', e);
    return bad(res, e.message || 'internal error', 500);
  }
}