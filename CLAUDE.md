# Earth Sentry — project context

Earth Sentry is a standalone web app that visualizes **near-Earth object
encounters** in real time: Earth, the Moon, the Sun, a starfield, and live NEO
close approaches from public NASA/JPL APIs, rendered in **raw WebGL2** under a
retro-futurism × gorpcore mission-control HUD. This is its own project — no
relationship to any other repo.

## Stack (deliberate choices — keep them)

- **Raw WebGL2** for all 3D. Hand-written GLSL, buffers, camera, and color-id
  picking. `gl-matrix` is the ONLY math dependency — do **not** introduce
  Three.js / react-three-fiber.
- **React + Motion (`motion.dev`)** for the HUD chrome; **anime.js** for numeric
  readouts. React never touches the render loop.
- **Vite + TypeScript.** Keep `npx tsc -b` clean.

## Architecture

- `src/gl/` — Renderer (context, RAF loop, DPR resize, pick FBO), program/shader
  helpers, procedural geometry, orbit camera, color-id picking.
- `src/scene/` — `Scene` orchestrator, `bodies` (Sun/Earth/Moon + starfield),
  procedural Earth texture, `markers` (instanced NEO billboards), `scale`.
- `src/orbital/` — sim clock, `approximate` placement (Phase 1), `kepler` solver
  + propagation + orbit sampling (ready for Phase 2).
- `src/data/` — cached fetch `client`, `jplCad` (primary feed), `jplSbdb`
  (dossier/elements), `nasaNeo` (enrichment), domain `types`.
- `src/ui/` — `GLCanvas` (the React↔WebGL boundary; owns Renderer/Scene + its own
  RAF loop), `Hud`, `Timeline`, `Legend`, `Controls`, `StatusBar`,
  `ObjectInspector`. `styles/` holds the design tokens.

## Gotchas

- **JPL CORS:** `ssd-api.jpl.nasa.gov` (CAD + SBDB) sends no CORS headers. Dev
  hits it through the Vite **`/jpl` proxy** (`vite.config.ts`); `JPL_BASE` in
  `src/data/client.ts` selects `/jpl` in dev. NASA `api.nasa.gov` allows CORS.
  Production needs an equivalent `/jpl` rewrite or `VITE_JPL_BASE`.
- **Scale is compressed** for viewability (units = Earth radii); markers sit on a
  **log-compressed** miss-distance shell. See `src/scene/scale.ts`.
- **NASA DEMO_KEY** (30/hr, 50/day) via `VITE_NASA_API_KEY`; JPL carries the load.
  All fetches are cached (memory + localStorage) so scrubbing doesn't refetch.

## Run & verify

```bash
npm install
npm run dev        # http://localhost:5173
```

## Roadmap

- **Phase 1 (done):** raw-WebGL scene, live CAD feed, approximate markers, HUD,
  timeline, picking + dossier.
- **Phase 2 (done):** heliocentric "HELIO ORBITS" mode — Sun + inner planets +
  true NEO orbit ellipses (SBDB elements), positions propagated vs the timeline
  clock, GEOCENTRIC↔HELIO toggle with camera reframe. See `orbital/planets.ts`,
  `scene/orbits.ts`, and the mode branch in `scene/Scene.ts`.
- **Phase 3 (done):** live satellite layers in the geocentric view — Starlink,
  GPS, ALL ACTIVE (~15k), ISS (+trail) — toggled in the Console. CelesTrak TLE
  (`data/celestrak.ts`, CORS-open, no proxy) propagated with SGP4 (`satellite.js`)
  in `scene/satellites.ts`; ECI km → scene Earth-radii, throttled fast clock.
- **Later:** incoming-object animation, ISS ground track + day/night shadow
  (satellite.js `eciToGeodetic`/shadow), satellite picking/labels.
