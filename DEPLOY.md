# Deploying Earth Sentry

The app is a static SPA plus a thin same-origin proxy for JPL's SSD API (which
sends no CORS headers). The Docker image bundles both via nginx. CelesTrak and
NASA allow CORS and are called directly from the browser.

## Vercel (recommended — free, direct from GitHub)

No Docker needed. Vercel serves the static build and proxies `/jpl` to JPL via a
rewrite (`vercel.json`), so all features work same-origin.

1. Push this repo to GitHub.
2. [vercel.com](https://vercel.com) → **Add New… → Project** → import the repo.
3. Framework auto-detects as **Vite** (build `npm run build`, output `dist`).
   Leave defaults; no env vars required.
4. **Deploy.** You get a `https://earth-sentry-*.vercel.app` URL that redeploys
   on every push to `main`.

Optional env var: `VITE_NASA_API_KEY` (build-time) for a personal NASA key.

## Netlify (alternative)

Same idea via `netlify.toml` (proxies `/jpl`). Import the repo at
[netlify.com](https://netlify.com); build `npm run build`, publish `dist`.

## Docker (Render / any container host)

```bash
docker build -t earth-sentry .
docker run --rm -p 8080:8080 earth-sentry
# open http://localhost:8080
```

The container listens on `$PORT` (default `8080`). Hosts that inject `PORT`
(Render, Fly, Cloud Run, etc.) work without changes. nginx reverse-proxies
`/jpl/*` → `https://ssd-api.jpl.nasa.gov/*`.

## Render (Blueprint)

`render.yaml` defines a Docker web service. Either:

- **Blueprint:** in the Render dashboard → *New* → *Blueprint*, point it at this
  GitHub repo. Render reads `render.yaml`, builds the Dockerfile, and injects
  `PORT`. Auto-deploys on every push to `main`.
- **Manual:** *New* → *Web Service* → connect the repo → environment *Docker*.

No environment variables are required. Optional:

- `VITE_NASA_API_KEY` — a personal api.nasa.gov key (build-time) to lift the
  DEMO_KEY rate limit. JPL/CelesTrak need no key.
- `VITE_JPL_BASE` — override the JPL proxy base (defaults to same-origin `/jpl`).

## CI

`.github/workflows/ci.yml` runs typecheck + Vite build, then a Docker build, on
every push/PR to `main`.
