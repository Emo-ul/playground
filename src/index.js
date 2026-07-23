// Emotiv Playground — worker in front of static assets.
// Google OAuth (auth code flow) + @emotiv.com gate + KV whitelist for externals.
// Auth activates automatically once GOOGLE_CLIENT_SECRET and SESSION_SECRET
// secrets are set on the worker; until then the site is served openly.

const CLIENT_ID =
  "329302311578-ad85r1a85g2s253u46bocaees40mi86i.apps.googleusercontent.com";
const ALLOWED_DOMAIN = "emotiv.com";
const SESSION_COOKIE = "pg_session";
const STATE_COOKIE = "pg_state";
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

const EMOTIV_ORIGIN = "https://www.emotiv.com";
const STUDIO_ICON =
  "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/be/42/fe/be42fe27-a5cc-e530-1afc-2d91292615ed/AppIcon.png/256x256bb.png";

/* ---------- crypto helpers ---------- */
const te = new TextEncoder();

function b64u(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64uToStr(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return atob(s);
}
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey(
    "raw", te.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(await crypto.subtle.sign("HMAC", key, te.encode(msg)));
}

async function makeSession(email, secret) {
  const payload = b64u(te.encode(JSON.stringify({
    email, exp: Math.floor(Date.now() / 1000) + SESSION_TTL
  })));
  return payload + "." + (await hmac(secret, payload));
}
async function verifySession(value, secret) {
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return null;
  if ((await hmac(secret, payload)) !== sig) return null;
  try {
    const data = JSON.parse(b64uToStr(payload));
    if (data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch { return null; }
}

function getCookie(request, name) {
  const m = (request.headers.get("cookie") || "")
    .match(new RegExp("(?:^|;\\s*)" + name + "=([^;]+)"));
  return m ? m[1] : null;
}
function cookieHeader(name, value, maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- whitelist ---------- */
async function getWhitelist(env) {
  if (!env.AUTH_KV) return [];
  return (await env.AUTH_KV.get("whitelist", "json")) || [];
}

/* ---------- pages ---------- */
function deniedPage(email) {
  const e = escapeHtml(email || "mysterious stranger");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Absolutely not</title><link rel="icon" href="/favicon.png"><style>
body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0d0e14;color:#e8e8ee;font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif;text-align:center}
.card{max-width:520px;padding:48px 40px}
h1{font-size:64px;margin:0 0 12px}
h2{font-size:22px;margin:0 0 16px}
p{color:#9a9aa8;line-height:1.6;margin:0 0 24px}
a{color:#7b8cff;text-decoration:none}
.em{color:#e8e8ee;font-weight:600}
</style></head><body><div class="card">
<h1>🚫</h1>
<h2>Nice try, <span class="em">${e}</span>.</h2>
<p>This is a private playground, and you are — and we cannot stress this enough — <em>not invited</em>. The bouncer checked the list twice. Your name isn't just missing; the list recoiled.</p>
<p>Know someone at Emotiv? Grovel to them for an invite. Otherwise, please enjoy literally any other website.</p>
<p><a href="/logout">Try a different account</a></p>
</div></body></html>`;
}

/* ---------- emotiv.com proxy ---------- */
async function proxyEmotiv(request, path, search) {
  const res = await fetch(EMOTIV_ORIGIN + path + (search || ""), {
    headers: {
      accept: request.headers.get("accept") || "*/*",
      "accept-language": "en",
      "user-agent": request.headers.get("user-agent") || "Mozilla/5.0"
    },
    redirect: "follow"
  });
  const h = new Headers(res.headers);
  ["x-frame-options", "content-security-policy", "content-security-policy-report-only",
   "cross-origin-opener-policy", "cross-origin-embedder-policy"].forEach(k => h.delete(k));
  h.set("cache-control", "no-store");
  return new Response(res.body, { status: res.status, headers: h });
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...extra }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = url.origin;
    const path = url.pathname;
    const authEnabled = !!(env.GOOGLE_CLIENT_SECRET && env.SESSION_SECRET && env.AUTH_KV);

    /* ----- session ----- */
    let session = null;
    if (authEnabled) {
      session = await verifySession(getCookie(request, SESSION_COOKIE), env.SESSION_SECRET);
    }

    /* ----- oauth routes ----- */
    if (authEnabled && path === "/oauth/start") {
      const state = crypto.randomUUID();
      const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      auth.searchParams.set("client_id", CLIENT_ID);
      auth.searchParams.set("redirect_uri", origin + "/oauth/callback");
      auth.searchParams.set("response_type", "code");
      auth.searchParams.set("scope", "openid email profile");
      auth.searchParams.set("state", state);
      auth.searchParams.set("prompt", "select_account");
      return new Response(null, {
        status: 302,
        headers: { location: auth.toString(), "set-cookie": cookieHeader(STATE_COOKIE, state, 600) }
      });
    }

    if (authEnabled && path === "/oauth/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      if (!code || !state || state !== getCookie(request, STATE_COOKIE)) {
        return new Response("Invalid OAuth state. <a href='/login'>Try again</a>.", {
          status: 400, headers: { "content-type": "text/html" }
        });
      }
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: origin + "/oauth/callback",
          grant_type: "authorization_code"
        })
      });
      if (!tokenRes.ok) {
        return new Response("Token exchange failed. <a href='/login'>Try again</a>.", {
          status: 502, headers: { "content-type": "text/html" }
        });
      }
      const tokens = await tokenRes.json();
      let claims = {};
      try { claims = JSON.parse(b64uToStr(tokens.id_token.split(".")[1])); } catch {}
      const email = (claims.email || "").toLowerCase();
      const verified = claims.email_verified === true || claims.email_verified === "true";
      const whitelist = await getWhitelist(env);
      const allowed = verified && email &&
        (email.endsWith("@" + ALLOWED_DOMAIN) || whitelist.includes(email));

      if (!allowed) {
        return new Response(deniedPage(email), {
          status: 403,
          headers: {
            "content-type": "text/html",
            "cache-control": "no-store",
            "set-cookie": cookieHeader(SESSION_COOKIE, "", 0)
          }
        });
      }
      const cookie = await makeSession(email, env.SESSION_SECRET);
      return new Response(null, {
        status: 302,
        headers: { location: "/", "set-cookie": cookieHeader(SESSION_COOKIE, cookie, SESSION_TTL) }
      });
    }

    if (path === "/logout") {
      return new Response(null, {
        status: 302,
        headers: { location: "/login", "set-cookie": cookieHeader(SESSION_COOKIE, "", 0) }
      });
    }

    if (path === "/login") {
      if (!authEnabled || session) {
        return new Response(null, { status: 302, headers: { location: "/" } });
      }
      const res = await env.ASSETS.fetch(new Request(origin + "/login.html"));
      return new Response(res.body, {
        status: res.status,
        headers: { "content-type": "text/html", "cache-control": "no-store" }
      });
    }

    /* ----- public assets (needed by login page) ----- */
    if (path === "/favicon.png") {
      return env.ASSETS.fetch(request);
    }

    /* ----- auth gate ----- */
    if (authEnabled && !session) {
      if (path.startsWith("/api/")) return json({ error: "unauthenticated" }, 401);
      return new Response(null, { status: 302, headers: { location: "/login" } });
    }

    /* ----- api ----- */
    if (path === "/api/me") {
      if (!authEnabled) return json({ email: null, authEnabled: false });
      return json({ email: session.email, authEnabled: true });
    }

    if (path === "/api/whitelist") {
      if (!authEnabled) return json({ error: "Auth not configured yet" }, 503);
      if (!session.email.endsWith("@" + ALLOWED_DOMAIN)) {
        return json({ error: "Only @emotiv.com users manage access" }, 403);
      }
      const list = await getWhitelist(env);
      if (request.method === "GET") return json(list);
      if (request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const email = (body.email || "").toLowerCase().trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Invalid email" }, 400);
        if (!list.includes(email)) list.push(email);
        await env.AUTH_KV.put("whitelist", JSON.stringify(list));
        return json(list);
      }
      if (request.method === "DELETE") {
        const email = (url.searchParams.get("email") || "").toLowerCase();
        const next = list.filter(e => e !== email);
        await env.AUTH_KV.put("whitelist", JSON.stringify(next));
        return json(next);
      }
      return json({ error: "Method not allowed" }, 405);
    }

    /* ----- proxied assets ----- */
    if (path === "/data-icon.svg") {
      const r = await fetch("https://www.gstatic.com/analytics-lego/svg/ic_looker_studio.svg",
        { cf: { cacheEverything: true, cacheTtl: 86400 } });
      return new Response(r.body, {
        status: r.status,
        headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=86400" }
      });
    }

    if (path === "/studio-icon.png") {
      const r = await fetch(STUDIO_ICON, { cf: { cacheEverything: true, cacheTtl: 86400 } });
      const h = new Headers(r.headers);
      h.set("cache-control", "public, max-age=86400");
      return new Response(r.body, { status: r.status, headers: h });
    }

    if (path === "/emotiv" || path.startsWith("/emotiv/")) {
      return proxyEmotiv(request, path.replace(/^\/emotiv\/?/, "/"), url.search);
    }

    /* ----- static assets ----- */
    const res = await env.ASSETS.fetch(request);
    if (res.status === 404) {
      // Absolute-path subresources of the embedded emotiv.com site.
      return proxyEmotiv(request, path, url.search);
    }
    const out = new Response(res.body, res);
    if ((out.headers.get("content-type") || "").includes("text/html")) {
      out.headers.set("cache-control", "no-store");
    }
    return out;
  }
};
