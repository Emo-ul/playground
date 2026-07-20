// Emotiv Playground — worker in front of static assets.
// - Serves the desktop mockup (static assets)
// - Proxies www.emotiv.com with frame-blocking headers stripped, so the
//   mock Chrome window can iframe it
// - Proxies the EMOTIV Studio App Store icon
// - Will handle Google OAuth + access control next

const EMOTIV_ORIGIN = "https://www.emotiv.com";
const STUDIO_ICON =
  "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/be/42/fe/be42fe27-a5cc-e530-1afc-2d91292615ed/AppIcon.png/256x256bb.png";

async function proxyEmotiv(request, path, search) {
  const target = EMOTIV_ORIGIN + path + (search || "");
  const res = await fetch(target, {
    headers: {
      accept: request.headers.get("accept") || "*/*",
      "accept-language": "en",
      "user-agent": request.headers.get("user-agent") || "Mozilla/5.0"
    },
    redirect: "follow"
  });
  const h = new Headers(res.headers);
  [
    "x-frame-options",
    "content-security-policy",
    "content-security-policy-report-only",
    "cross-origin-opener-policy",
    "cross-origin-embedder-policy"
  ].forEach(k => h.delete(k));
  h.set("cache-control", "no-store");
  return new Response(res.body, { status: res.status, headers: h });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/studio-icon.png") {
      const r = await fetch(STUDIO_ICON, { cf: { cacheEverything: true, cacheTtl: 86400 } });
      const h = new Headers(r.headers);
      h.set("cache-control", "public, max-age=86400");
      return new Response(r.body, { status: r.status, headers: h });
    }

    if (url.pathname === "/emotiv" || url.pathname.startsWith("/emotiv/")) {
      return proxyEmotiv(request, url.pathname.replace(/^\/emotiv\/?/, "/"), url.search);
    }

    const res = await env.ASSETS.fetch(request);

    if (res.status === 404) {
      // Subresources/pages of the embedded emotiv.com site request absolute
      // paths on our origin; fall through to emotiv.com so the iframe works.
      // NOTE: revisit when adding real routes (e.g. /oauth/*).
      return proxyEmotiv(request, url.pathname, url.search);
    }

    const out = new Response(res.body, res);
    if ((out.headers.get("content-type") || "").includes("text/html")) {
      out.headers.set("cache-control", "no-store");
    }
    return out;
  }
};
