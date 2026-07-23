# Emotiv Playground

Internal experimentation environment. macOS-style desktop mockup served by a
Cloudflare Worker (`playground` on emotiv-growth.workers.dev), deployed
automatically on push to `main` (repo: Emo-ul/playground).

Access: Google OAuth. Any @emotiv.com account, plus externally whitelisted
emails (managed in  menu → Settings → Access; stored in KV `playground-auth`).
Secrets on the worker: `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`.

## Layout

```
public/               desktop shell (index.html), login.html, shared assets
public/projects/      experimental builds — THE archive
src/index.js          worker: auth, emotiv.com proxy, icon proxies
```

## Project/build convention (IMPORTANT — persistent agreement with Uldis)

Every experimental build lives at:

```
public/projects/<project>/<build>/index.html     →  /projects/<project>/<build>/
```

Examples: `projects/chrome/cta-page/`, `projects/studio/onboarding/`,
`projects/hero/baseline/`.

Rules agreed with Uldis (2026-07-23):

1. When he asks for something NEW, create it as a build folder under its
   project: `playground/<project>/<build>`. Builds stay in the repo as an
   archive — access when needed. Nothing gets deleted just because it's old.
2. Do NOT snapshot every iteration as a version. Keep iterating in place.
3. Create an archived version snapshot only when:
   a) Uldis explicitly asks, OR
   b) a project is revisited after a considerable gap (week+) AND the new
      asks are massive recreations rather than small iterations — then
      snapshot the old state first, on your own judgment.
4. Version snapshots go to `public/projects/<project>/<build>/v/<YYYY-MM-DD>[-label]/`
   (frozen copy), while the build root stays the live/current one.

Auth note: everything under /projects/ sits behind the same login gate
automatically (worker runs first; only /login, /oauth/*, /favicon.png are public).

Style note: it's "Emotiv", never "EMOTIV".

## Projects

- `hero/baseline` — static emotiv.com header+hero clone, untouched (source:
  ~/Documents/Playground/static header/). Stored for future use.
- `hero/cta` — same, with injected nav CTA experiment: "Shop" (white outline)
  + "Start Now" (blue), re-applied via MutationObserver over menu swaps.

The mock Chrome's new-tab page (`public/ntp.html`) mimics Google search +
recent pages and links to both hero builds via postMessage to the shell.

## Pending

- Customer-stories project (4 HTMLs) — files not yet received.
- Replace the Apple logo in the menu bar with Uldis's logo (asset pending).
