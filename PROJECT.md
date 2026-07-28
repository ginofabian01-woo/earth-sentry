# Earth Sentry — Project Overview

Live: https://earth-sentry.vercel.app/ · Repo: https://github.com/ginofabian01-woo/earth-sentry

## Summary

Earth Sentry is a live, interactive 3D visualizer of the space around Earth —
near-Earth asteroid close approaches, ~15,000 tracked satellites (Starlink, GPS,
ISS), the Moon, Sun, and true planetary/asteroid orbits — streamed from public
NASA and JPL data and rendered in **raw WebGL2** (no Three.js) inside a
retro-futurist mission-control HUD.

## Project rundown

| Phase | Delivered |
| --- | --- |
| **1 — Foundation** | Raw WebGL2 renderer (custom GLSL, orbit camera, DPR handling), procedural Earth/Moon/Sun + starfield, live JPL close-approach feed, instanced NEO markers, color-ID click → object dossier, timeline, animated HUD (Motion + anime.js) |
| **2 — Real orbits** | Heliocentric mode: Sun + inner planets on real orbits + every in-window asteroid drawn as a true Keplerian orbit ellipse; positions propagate against the timeline clock; geocentric↔helio toggle |
| **3 — Orbital traffic** | Live satellite layers via CelesTrak TLE + SGP4: Starlink swarm, GPS constellation, ~15k active catalog, and the ISS (orbit trail) — toggleable |
| **3.1 — Motion** | Incoming-object animation (asteroids sweep toward Earth as the cursor nears their encounter date, with trajectory tails) + ISS ground track |
| **Hardening** | Two security sweeps (0 vulnerabilities, no secret leaks, WebGL leak fixed, request dedup), Docker/nginx + Vercel/Netlify deploy, GitHub Actions CI |

## Scope

**In scope (done):** live NEO close approaches; clickable dossiers (miss distance,
velocity, diameter, orbital elements); real Keplerian orbits (planets + asteroids);
SGP4 satellite constellations + ISS; timeline scrubbing that drives real orbital
mechanics; incoming-object animation; ISS ground track; responsive retro HUD;
public deploy.

**Out of scope (design choices):** no Three.js (everything hand-written WebGL);
distances are compressed for viewability (not 1:1 astronomical scale); the Earth
texture is procedural, not geo-referenced; orbital fidelity is visualization-grade,
not an ephemeris.

**Future / backlog:** day-night terminator shadow, satellite picking + labels, a
live "now" auto-advancing clock.

## Data pipeline (source → screen)

```
NASA / JPL / CelesTrak APIs
        │
        ▼
Cached fetch client  ── in-memory + localStorage (TTL) + in-flight dedup
        │              (JPL routed same-origin via /jpl proxy — JPL has no CORS;
        │               NASA & CelesTrak are CORS-open, called directly)
        ▼
Parsers → typed domain objects  (CloseApproach, OrbitalElements, SGP4 records)
        │
        ▼
Orbital math layer
   • NEOs (approx)   → time-modulated placement + tails
   • NEOs/planets    → Kepler solver → heliocentric positions/orbits
   • Satellites      → SGP4 propagation (satellite.js), ECI → scene coords
        │
        ▼
Scene (imperative WebGL)  ← GLCanvas boundary (React↔WebGL; own RAF loop)
        │
        ▼
GPU: instanced markers, point clouds, orbit/trail line strips, textured spheres
```

**Sources:** JPL CAD (close approaches, primary) · JPL SBDB (elements/dossier) ·
NASA NeoWs/APOD (enrichment, DEMO_KEY) · CelesTrak TLE (satellites).

## Build & deploy pipeline

```
Local dev            git push (main)        CI                     Hosting
──────────           ───────────────        ──────────────         ────────────────
Vite dev server  →   GitHub repo        →   GitHub Actions:    →   Vercel (auto-deploy)
+ /jpl dev proxy     (public)               tsc + vite build       rewrites /jpl → JPL
                                            + docker build         → *.vercel.app
                                                                   (alt: Docker/nginx
                                                                    on Render)
```

- The one server-side dependency is the `/jpl` proxy (JPL sends no CORS headers),
  handled three ways so any host works: Vite dev proxy locally, a
  `vercel.json`/`netlify.toml` rewrite on static hosts, and nginx in the Docker image.
- CI gates every push with typecheck + Vite build + Docker build.
- Deploy is push-to-`main` → Vercel auto-builds and ships.

## Tech stack

Raw WebGL2 + GLSL · TypeScript · React (HUD only) · Vite · satellite.js (SGP4) ·
custom Kepler solver · gl-matrix (math only) · Motion + anime.js · Docker/nginx ·
Vercel · GitHub Actions.
