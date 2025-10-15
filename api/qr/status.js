// api/qr/status.js
// Sederhana: stub OK. Nanti kalau endpoint Orkut sudah ada,
// tinggal ganti fetch ke URL resmi mereka.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { reference } = req.body || {};
    if (!reference) {
      return res.status(400).json({ success: false, message: 'reference wajib' });
    }

    // === TEMP: selalu pending 1x, lalu paid kalau diklik refresh > 1 menit ===
    // (Biar front end bisa demo; ganti dengan fetch ke Orkut saat ada endpoint)
    const now = Date.now();
    const ts = Number(reference.replace(/\D/g, '')) || now;
    const paid = (now - ts) > 15000; // dianggap paid setelah 15 detik

    return res.status(200).json({
      success: true,
      reference,
      status: paid ? 'PAID' : 'PENDING'
    });

    // === Contoh integrasi Orkut (kalau endpoint sudah ada) ===
    // const r = await fetch('https://orkut.your-api/check', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     auth_username: process.env.AUTH_USERNAME,
    //     auth_token: process.env.AUTH_TOKEN,
    //     reference
    //   })
    // });
    // const json = await r.json();
    // return res.status(200).json(json);

  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: e.message || 'internal error' });
  }
}