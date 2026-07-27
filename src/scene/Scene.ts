import { vec3 } from "gl-matrix";
import { Renderer } from "../gl/renderer";
import { Bodies } from "./bodies";
import { Markers } from "./markers";
import { Orbits, type OrbitSpec } from "./orbits";
import { Satellites, type LayerStyle } from "./satellites";
import { SCENE } from "./scale";
import { PLANETS, EARTH_INDEX } from "../orbital/planets";
import { elementsToPosition, sampleOrbit } from "../orbital/kepler";
import type { CloseApproach, OrbitalElements } from "../data/types";
import type { Sat } from "../data/celestrak";

/** Real-time acceleration for satellite propagation (so orbits are visible). */
const SAT_SPEED = 90;
const SAT_UPDATE_INTERVAL = 0.12; // seconds of wall-clock between propagations

export type SceneMode = "approx" | "real";

/** Owns all drawables and the per-frame draw order + picking. */
export class Scene {
  readonly renderer: Renderer;
  private bodies: Bodies;
  readonly markers: Markers;
  private orbits: Orbits;
  private satellites: Satellites;
  private readonly satEpochMs = Date.now();
  private lastSatUpdate = -1;

  private mode: SceneMode = "approx";
  private simDate = new Date();
  private approaches: CloseApproach[] = [];
  private neoElements: (OrbitalElements | null)[] = [];

  private readonly planetOrbitSpecs: OrbitSpec[];
  private neoOrbitSpecs: OrbitSpec[] = [];
  private planetPositions: vec3[] = PLANETS.map(() => vec3.create());
  private readonly tmp = vec3.create();
  private readonly origin = vec3.create();

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.bodies = new Bodies(renderer.gl);
    this.markers = new Markers(renderer.gl);
    this.orbits = new Orbits(renderer.gl);
    this.satellites = new Satellites(renderer.gl);

    // planet orbit rings are static
    this.planetOrbitSpecs = PLANETS.map((p) => ({
      points: sampleOrbit(p.el, 256),
      color: p.ringColor,
      alpha: 0.5,
    }));
  }

  setMode(mode: SceneMode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.rebuildOrbits();
    this.updatePositions();
  }

  setSimDate(date: Date) {
    this.simDate = date;
    if (this.mode === "real") this.updatePositions();
  }

  setApproaches(list: CloseApproach[]) {
    this.approaches = list;
    this.neoElements = list.map(() => null);
    this.neoOrbitSpecs = [];
    this.rebuildOrbits();
    this.updatePositions();
  }

  /** Real orbital elements aligned to the current approaches (null = unknown). */
  setRealElements(elements: (OrbitalElements | null)[]) {
    this.neoElements = elements;
    this.neoOrbitSpecs = [];
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (!el) continue;
      this.neoOrbitSpecs.push({
        points: sampleOrbit(el, 220),
        color: this.approaches[i]?.hazardous ? [1.0, 0.4, 0.35] : [1.0, 0.72, 0.2],
        alpha: 0.32,
      });
    }
    this.rebuildOrbits();
    this.updatePositions();
  }

  select(index: number) {
    this.markers.selectedIndex = index;
  }

  setSatelliteLayer(key: string, sats: Sat[], style: LayerStyle, showTrail = false) {
    this.satellites.setLayer(key, sats, style, showTrail);
    this.lastSatUpdate = -1; // force an immediate propagation next frame
  }

  setSatelliteEnabled(key: string, on: boolean) {
    this.satellites.setEnabled(key, on);
    this.lastSatUpdate = -1;
  }

  /** Rebuild orbit line buffers (only when the object set / mode changes). */
  private rebuildOrbits() {
    this.orbits.setOrbits(this.mode === "real" ? [...this.planetOrbitSpecs, ...this.neoOrbitSpecs] : []);
  }

  /** Recompute body/marker positions for the current date (cheap; per scrub). */
  private updatePositions() {
    if (this.mode === "real") {
      for (let i = 0; i < PLANETS.length; i++) {
        elementsToPosition(PLANETS[i].el, this.simDate, this.planetPositions[i]);
        vec3.scale(this.planetPositions[i], this.planetPositions[i], SCENE.AU_UNIT);
      }
      const positions: (vec3 | null)[] = this.neoElements.map((el) => {
        if (!el) return null;
        const p = elementsToPosition(el, this.simDate, vec3.create());
        return vec3.scale(p, p, SCENE.AU_UNIT);
      });
      this.markers.setData(this.approaches, { positions, baseSize: SCENE.MARKER_BASE_SIZE_HELIO });
    } else {
      this.markers.setData(this.approaches);
    }
  }

  render = (_dt: number, elapsed: number) => {
    const r = this.renderer;
    const cam = r.camera;
    const view = cam.viewMatrix();
    const proj = cam.projMatrix(r.aspect);

    r.bindScreen();
    r.clear(0.043, 0.047, 0.039);
    this.bodies.drawStars(view, proj, elapsed);

    if (this.mode === "real") {
      this.bodies.drawSunAt(view, proj, cam.position, elapsed, this.origin, SCENE.SUN_CORE_RADIUS);
      for (let i = 0; i < PLANETS.length; i++) {
        const p = PLANETS[i];
        const pos = this.planetPositions[i];
        vec3.negate(this.tmp, pos);
        vec3.normalize(this.tmp, this.tmp); // sun direction (toward origin)
        this.bodies.drawBody(
          view, proj, cam.position, pos, p.radiusUnits, elapsed * 0.1,
          p.colorA, p.colorB, i === EARTH_INDEX ? this.bodies.earthTexture : null, 0.1, this.tmp,
        );
      }
      this.orbits.draw(view, proj, SCENE.AU_UNIT);
      this.markers.draw(view, proj, elapsed, false);
    } else {
      this.bodies.drawSun(view, proj, cam.position, elapsed);
      this.bodies.drawEarth(view, proj, cam.position, elapsed);
      this.bodies.drawMoon(view, proj, cam.position, elapsed);
      this.markers.draw(view, proj, elapsed, false);

      // satellites live in the geocentric near-Earth shell, propagated to a
      // fast clock and refreshed on a throttled cadence
      if (this.lastSatUpdate < 0 || elapsed - this.lastSatUpdate > SAT_UPDATE_INTERVAL) {
        this.lastSatUpdate = elapsed;
        this.satellites.update(new Date(this.satEpochMs + elapsed * 1000 * SAT_SPEED));
      }
      const dpr = r.width / Math.max(1, r.canvas.clientWidth);
      this.satellites.draw(view, proj, dpr);
    }
  };

  /** Free all GL resources owned by the scene. */
  dispose() {
    this.bodies.dispose();
    this.markers.dispose();
    this.orbits.dispose();
    this.satellites.dispose();
  }

  /** Render markers to the pick target and resolve the object under a click. */
  pickAt(cssX: number, cssY: number): number {
    const r = this.renderer;
    const view = r.camera.viewMatrix();
    const proj = r.camera.projMatrix(r.aspect);
    r.bindPickTarget();
    this.markers.draw(view, proj, 0, true);
    const px = r.readPick(cssX, cssY);
    r.bindScreen();
    return this.markers.pickToIndex(px);
  }
}
