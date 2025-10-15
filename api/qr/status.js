module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET')
    return res.status(405).json({ success: false, message: 'Method not allowed' });

  try {
    const { reference, amount } = req.query || {};
    if (!reference) {
      return res.status(400).json({ success: false, message: 'reference required' });
    }

    // TODO: ganti dengan panggilan checker Orkut kamu.
    // Untuk demo: random status supaya UI bisa berubah
    const paid = Math.random() < 0.2; // 20% chance
    const status = paid ? 'PAID' : 'PENDING';

    res.status(200).json({
      success: true,
      data: { reference, amount: Number(amount) || null, status }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message || 'internal error' });
  }
};