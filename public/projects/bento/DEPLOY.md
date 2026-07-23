# Emotiv Studio onboarding demo — deploy notes

Static site, no build step. Upload this folder to any static host (S3/CloudFront, Netlify, Vercel, GitHub Pages, nginx).

## Files
- index.html                     — copy of the Discover screen (root entry)
- emotiv-studio-home.html        — Discover: 19 story/integration tiles, 2-level drawer (story → build guide)
- emotiv-studio-experiments.html — 14 experiment templates (overview → set-up guide)
- emotiv-studio-quest.html       — Brain Quest: gamified progression card (state in localStorage["emotiv-quest-v1"])
- emotiv-studio-research.html    — 10 peer-reviewed case studies, report-style drawers

Pages cross-link via relative hrefs — keep them in one directory.

## External runtime dependencies (all client-side)
- Google Fonts (fonts.googleapis.com)
- Images hotlinked from images.pexels.com, framerusercontent.com (Emotiv CDN), i.ytimg.com
- YouTube embeds (youtube-nocookie.com) — click-to-play
No API keys required at runtime. Do NOT deploy anything from ../.secrets (Pexels key used only for asset curation).

## Pre-launch checklist
- Verify the "22,000+ scholarly works" figure and the two flagged citations (Khushaba author list; drowsiness review journal)
- Confirm product naming (EPOC X / Insight / FLEX / MN8) with brand
- Optionally self-host images for offline resilience
