# Earth Sentry — Object Encounter System

A live 3D monitor for near-Earth object encounters: Earth, the Moon, the Sun, a
starfield, and real close-approach objects (NEOs) streamed from public NASA/JPL
APIs — rendered in **raw WebGL2** and wrapped in a **retro-futurism × gorpcore**
mission-control HUD.

![status](https://img.shields.io/badge/phase-1_shippable-33ff66) ![webgl](https://img.shields.io/badge/render-raw_WebGL2-ffb000)

---

## What it does

- **Live orbital-traffic watch.** Pulls close-approach data from JPL/CNEOS and
  plots every tracked NEO around Earth, color-coded by hazard and sized by
  estimated diameter.
- **Interactive 3D scene.** Orbit the camera (drag), zoom (wheel), and click any
  object to open its **dossier** — miss distance (LD / km), relative velocity,
  diameter, absolute magnitude, and osculating orbital elements from JPL SBDB.
- **Encounter timeline.** Scrub a date window (7 / 30 / 90 days), step forward or
  back, and see approaches laid out chronologically.
- **Retro-futurist HUD.** Phosphor-CRT accents (amber/green glow, scanlines) over
  a muted gorpcore base palette, animated with Motion and anime.js.

## Tech

| Layer | Choice |
| --- | --- |
| 3D | **Raw WebGL2** — hand-written GLSL shaders, buffers, camera, color-id picking. `gl-matrix` for math only (no Three.js). |
| UI | **React + Motion** (`motion.dev`) for HUD panels/transitions, **anime.js** for numeric readouts. |
| Build | Vite + TypeScript |
| Data | JPL CAD (primary, keyless), JPL SBDB (object detail/elements), NASA NeoWs + APOD (DEMO_KEY). |

## Data sources

- **JPL CAD** — `https://ssd-api.jpl.nasa.gov/cad.api` — close approaches. No key,
  no rate limit. **Primary feed.**
- **JPL SBDB** — `https://ssd-api.jpl.nasa.gov/sbdb.api` — per-object physical +
  orbital elements (used for the dossier and Keplerian orbits).
- **NASA NeoWs / APOD** — `https://api.nasa.gov/…` — enrichment/flavor. Uses
  `DEMO_KEY` by default (30 req/hr, 50 req/day); set your own key to lift limits.

> **CORS note:** JPL's `ssd-api` does **not** send CORS headers, so browsers block
> direct calls. In dev, Vite proxies them under `/jpl` (see `vite.config.ts`).
> NASA's `api.nasa.gov` allows CORS and is called directly. For production, route
> `/jpl` through an equivalent rewrite/proxy or set `VITE_JPL_BASE`.

All responses are cached (in-memory + `localStorage`, TTL) so timeline scrubbing
doesn't refetch and the DEMO_KEY budget is preserved.

## Getting started

```bash
npm install
cp .env.example .env      # optional: add your NASA key
npm run dev               # http://localhost:5173
```

Environment (`.env`):

```
VITE_NASA_API_KEY=DEMO_KEY   # get a free key at https://api.nasa.gov/
# VITE_JPL_BASE=...          # production-only: CORS-enabled base/proxy for JPL
```

## Project structure

```
src/
  gl/        raw WebGL2 — renderer, program/shader helpers, geometry, camera, picking
  scene/     Scene orchestrator, Sun/Earth/Moon bodies, procedural Earth texture, NEO markers
  orbital/   sim clock, approximate placement (v1), Kepler solver + propagation (v2)
  data/      cached fetch client, JPL CAD/SBDB + NASA NeoWs/APOD clients, domain types
  ui/        React HUD — GLCanvas boundary, Hud, Timeline, Legend, Controls, StatusBar, ObjectInspector
  styles/    design tokens + globals (blended phosphor/gorpcore palette)
```

The **GL/React boundary** lives in `ui/GLCanvas.tsx`: it constructs the
`Renderer`/`Scene` once and runs its own `requestAnimationFrame` loop, so React
re-renders never touch the hot render path. Selection flows renderer→React via a
callback; data/filter changes flow React→renderer via imperative methods.

## Scene scale

Distances are **compressed for viewability** (units = Earth radii): a true-scale
view would leave Earth an invisible dot. NEO markers sit on a **log-compressed
shell** by miss distance so both very-close and distant encounters stay on screen.
See `src/scene/scale.ts`.

## Roadmap

- **Phase 1 (done):** raw-WebGL scene, live CAD feed, approximate marker
  placement, HUD, timeline, picking + dossier.
- **Phase 2 (done):** real Keplerian orbits — a heliocentric "HELIO ORBITS" mode
  with the Sun, inner planets (Mercury–Mars) on their real orbits, and every
  in-window NEO drawn with its true orbit ellipse (JPL SBDB elements). Positions
  propagate against the timeline clock; a GEOCENTRIC ↔ HELIO toggle switches views
  and reframes the camera. (`orbital/kepler.ts` + `orbital/planets.ts` +
  `scene/orbits.ts`.)
- **Phase 3 — space-infrastructure layer (done):** live Earth-orbit traffic in
  the geocentric view, as toggleable layers in the Console:
  - **Starlink swarms** (cyan), **GPS constellation** (amber, MEO ≈ 4.2 Earth
    radii), **ALL ACTIVE** (~15k-object catalog), and the **ISS** (green, with a
    live orbit trail).

  **Data + method:** TLE element sets from **CelesTrak**
  (`gp.php?GROUP=<starlink|gps-ops|active|stations>&FORMAT=tle`), propagated with
  **SGP4 via `satellite.js`**. Positions are ECI (km) mapped to scene Earth-radii
  units, so satellites sit in the real near-Earth shell. Layers are propagated on
  a throttled, time-accelerated clock (`scene/satellites.ts`). CelesTrak allows
  CORS, so no proxy is needed for it (only JPL needs one).

- **Phase 3.1 (done):** **incoming-object animation** — geocentric NEOs sweep in
  toward Earth as the timeline cursor nears each close-approach date, with fading
  trajectory tails; and the **ISS ground track** (sub-satellite path projected to
  the surface) alongside its orbit trail.
- **Phase 3.2 (done):** **satellite picking** — click any satellite for a live
  track dossier (name, NORAD id, altitude, speed, layer); on-screen **tracking
  labels** that follow the selected satellite and always mark the ISS; and **info
  tooltips** on each Orbital Traffic layer.
- **Later:** day/night terminator shadow (satellite.js shadow helpers), a live
  "now" auto-advancing clock.

## Credits

Data courtesy of NASA/JPL public APIs. Not affiliated with NASA.
