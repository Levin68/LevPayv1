// /api/qr/status.js — FINAL CLEAN VERSION
function applyCORS(res) {
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

export default async function handler(req, res) {
  applyCORS(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const isGet = req.method === 'GET';
  const isPost = req.method === 'POST';
  if (!isGet && !isPost) return bad(res, 'Method not allowed', 405);

  const ref = isGet ? req.query.reference : req.body?.reference;
  const amount = Number(isGet ? req.query.amount : req.body?.amount);

  if (!ref || !amount) return bad(res, 'reference & amount required');

  // Simulasi status — setiap 2.8 detik update
  const paid = (Math.floor(Date.now() / 2800) % 2) === 0;

  return ok(res, {
    reference: ref,
    amount,
    status: paid ? 'PAID' : 'PENDING'
  });
}