// worker: menyediakan /api/qr/check10 dan proxy ke vercel utk /api/qr/create
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS helper
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // 1) Endpoint status simulasi: /api/qr/check10?reference=...&amount=...
    if (path === "/api/qr/check10") {
      const isGet = request.method === "GET";
      const isPost = request.method === "POST";
      if (!isGet && !isPost) {
        return json({ success: false, message: "Method not allowed" }, 405, cors);
      }

      let ref, amount;
      if (isGet) {
        ref = url.searchParams.get("reference");
        amount = Number(url.searchParams.get("amount"));
      } else {
        const body = await request.json().catch(() => ({}));
        ref = body?.reference;
        amount = Number(body?.amount);
      }
      if (!ref || !amount) {
        return json({ success: false, message: "reference & amount required" }, 400, cors);
      }

      const paid = (Math.floor(Date.now()/1000) % 2) === 0; // genap=PAID, ganjil=PENDING
      return json({
        success: true,
        data: {
          reference: ref,
          amount,
          status: paid ? "PAID" : "PENDING",
          checked_at: new Date().toISOString()
        }
      }, 200, cors);
    }

    // 2) Proxy ke Vercel untuk create (biar satu domain)
    if (path === "/api/qr/create") {
      const vercel = "https://lev-payv1-cg1z.vercel.app/api/qr/create";
      const init = {
        method: request.method,
        headers: request.headers,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      };
      const r = await fetch(vercel + url.search, init);
      const body = await r.text();
      return new Response(body, {
        status: r.status,
        headers: { "Content-Type": r.headers.get("Content-Type") || "application/json", ...cors }
      });
    }

    return json({ success:false, message:"Not found" }, 404, cors);
  }
};

function json(obj, status=200, headers={}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
  });
}