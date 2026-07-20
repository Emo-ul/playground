// Emotiv Playground — worker in front of static assets.
// Controls caching now; will handle Google OAuth + access control next.
export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request);
    const out = new Response(res.body, res);
    const type = out.headers.get("content-type") || "";
    if (type.includes("text/html")) {
      out.headers.set("cache-control", "no-store");
    }
    return out;
  }
};
