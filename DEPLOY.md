# Deploying Earth Sentry

The app is a static SPA plus a thin same-origin proxy for JPL's SSD API (which
sends no CORS headers). The Docker image bundles both via nginx. CelesTrak and
NASA allow CORS and are called directly from the browser.

## Docker (any host)

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
