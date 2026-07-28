import { mat4, vec3, vec4 } from "gl-matrix";
import { Renderer } from "../gl/renderer";
import { Bodies } from "./bodies";
import { Markers } from "./markers";
import { Orbits, type OrbitSpec } from "./orbits";
import { Satellites, SAT_PICK_BASE, type LayerStyle, type SatHit } from "./satellites";
import { SCENE } from "./scale";
import { PLANETS, EARTH_INDEX } from "../orbital/planets";
import { elementsToPosition, sampleOrbit } from "../orbital/kepler";
import { approximatePositionAt, approachIntensity } from "../orbital/approximate";
import type { CloseApproach, OrbitalElements } from "../data/types";
import type { Sat } from "../data/celestrak";

/** Real-time acceleration for satellite propagation (so orbits are visible). */
const SAT_SPEED = 90;
const SAT_UPDATE_INTERVAL = 0.12; // seconds of wall-clock between propagations

export type SceneMode = "approx" | "real";

export interface ScreenLabel {
  name: string;
  color: [number, number, number];
  x: number;
  y: number;
  kind: "sat" | "body";
}

export type PickResult =
  | { type: "neo"; index: number }
  | { type: "sat"; name: string; noradId: number; layerKey: string; altitudeKm: number; speedKmS: number }
  | { type: "none" };

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

  private currentSatDate = new Date();
  private selectedHit: SatHit | null = null;
  private onLabels: ((labels: ScreenLabel[]) => void) | null = null;
  private readonly viewProj = mat4.create();
  private readonly clip = vec4.create();
  private readonly labelPos = vec3.create();
  private readonly moonPos = vec3.create();

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
    this.updatePositions();
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

  /** Register a callback that receives on-screen satellite labels each frame. */
  setOnLabels(cb: ((labels: ScreenLabel[]) => void) | null) {
    this.onLabels = cb;
  }

  clearSelectedSat() {
    this.selectedHit = null;
  }

  /** Project a world position to CSS pixels, or null if off-screen/behind. */
  private project(pos: vec3, view: mat4, proj: mat4): { x: number; y: number } | null {
    mat4.multiply(this.viewProj, proj, view);
    vec4.set(this.clip, pos[0], pos[1], pos[2], 1);
    vec4.transformMat4(this.clip, this.clip, this.viewProj);
    const w = this.clip[3];
    if (w <= 0) return null;
    const nx = this.clip[0] / w, ny = this.clip[1] / w;
    if (nx < -1.15 || nx > 1.15 || ny < -1.15 || ny > 1.15) return null;
    const cw = this.renderer.canvas.clientWidth, ch = this.renderer.canvas.clientHeight;
    return { x: (nx * 0.5 + 0.5) * cw, y: (1 - (ny * 0.5 + 0.5)) * ch };
  }

  private emitLabels(view: mat4, proj: mat4, elapsed: number) {
    if (!this.onLabels) return;
    const labels: ScreenLabel[] = [];
    const push = (name: string, color: [number, number, number], world: vec3, kind: "sat" | "body") => {
      const s = this.project(world, view, proj);
      if (s) labels.push({ name, color, x: s.x, y: s.y, kind });
    };

    if (this.mode === "real") {
      push("SUN", [1.0, 0.72, 0.2], this.origin, "body");
      for (let i = 0; i < PLANETS.length; i++) {
        push(PLANETS[i].name.toUpperCase(), PLANETS[i].ringColor, this.planetPositions[i], "body");
      }
    } else {
      push("MOON", [0.72, 0.74, 0.78], this.bodies.moonPosition(elapsed, this.moonPos), "body");
      push("SUN", [1.0, 0.72, 0.2], this.bodies.sunWorldPosition, "body");

      const addSat = (hit: SatHit) => {
        const pos = this.satellites.positionOf(hit.sat, this.currentSatDate, this.labelPos);
        if (pos) push(hit.sat.name, hit.color, pos, "sat");
      };
      const iss = this.satellites.getISS();
      if (iss && this.satellites.isEnabled(iss.layerKey)) addSat(iss);
      if (this.selectedHit && this.selectedHit.sat.noradId !== iss?.sat.noradId) addSat(this.selectedHit);
    }
    this.onLabels(labels);
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
      // geocentric: objects sweep inward toward Earth as the cursor nears their
      // close-approach date, with fading trajectory tails streaming outward.
      const positions: (vec3 | null)[] = this.approaches.map((ca) =>
        approximatePositionAt(ca, this.simDate, vec3.create()),
      );
      this.markers.setData(this.approaches, { positions });

      const tails: OrbitSpec[] = [];
      for (let i = 0; i < this.approaches.length; i++) {
        const ca = this.approaches[i];
        const intensity = approachIntensity(ca, this.simDate);
        if (intensity <= 0.03) continue;
        const p = positions[i]!;
        const len = Math.hypot(p[0], p[1], p[2]) || 1;
        const tailLen = 2 + 7 * intensity;
        const ex = p[0] + (p[0] / len) * tailLen;
        const ey = p[1] + (p[1] / len) * tailLen;
        const ez = p[2] + (p[2] / len) * tailLen;
        tails.push({
          points: new Float32Array([p[0], p[1], p[2], ex, ey, ez]),
          color: ca.hazardous ? [1.0, 0.4, 0.35] : [1.0, 0.72, 0.2],
          alpha: 0.2 + 0.6 * intensity,
        });
      }
      this.orbits.setOrbits(tails);
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
      this.emitLabels(view, proj, elapsed); // sun + planet labels
    } else {
      this.bodies.drawSun(view, proj, cam.position, elapsed);
      this.bodies.drawEarth(view, proj, cam.position, elapsed);
      this.bodies.drawMoon(view, proj, cam.position, elapsed);
      this.orbits.draw(view, proj, 1); // approach tails (points already in world units)
      this.markers.draw(view, proj, elapsed, false);

      // satellites live in the geocentric near-Earth shell, propagated to a
      // fast clock and refreshed on a throttled cadence
      this.currentSatDate = new Date(this.satEpochMs + elapsed * 1000 * SAT_SPEED);
      if (this.lastSatUpdate < 0 || elapsed - this.lastSatUpdate > SAT_UPDATE_INTERVAL) {
        this.lastSatUpdate = elapsed;
        this.satellites.update(this.currentSatDate);
      }
      const dpr = r.width / Math.max(1, r.canvas.clientWidth);
      this.satellites.draw(view, proj, dpr);
      this.emitLabels(view, proj, elapsed);
    }
  };

  /** Free all GL resources owned by the scene. */
  dispose() {
    this.bodies.dispose();
    this.markers.dispose();
    this.orbits.dispose();
    this.satellites.dispose();
  }

  /**
   * Resolve the object under a click. NEO markers use pick ids 1..N; satellites
   * use SAT_PICK_BASE+ so both share one pick pass without colliding.
   */
  pickAt(cssX: number, cssY: number): PickResult {
    const r = this.renderer;
    const view = r.camera.viewMatrix();
    const proj = r.camera.projMatrix(r.aspect);
    const dpr = r.width / Math.max(1, r.canvas.clientWidth);

    r.bindPickTarget();
    this.markers.draw(view, proj, 0, true);
    if (this.mode === "approx") this.satellites.drawPick(view, proj, dpr);
    const px = r.readPick(cssX, cssY);
    r.bindScreen();

    const id = px[0] + px[1] * 256 + px[2] * 65536;
    if (id === 0) {
      this.selectedHit = null;
      return { type: "none" };
    }
    if (id >= SAT_PICK_BASE) {
      const hit = this.satellites.resolvePick(id - SAT_PICK_BASE);
      if (!hit) return { type: "none" };
      this.selectedHit = hit;
      const info = this.satellites.infoOf(hit.sat, this.currentSatDate);
      return {
        type: "sat",
        name: hit.sat.name,
        noradId: hit.sat.noradId,
        layerKey: hit.layerKey,
        altitudeKm: info?.altitudeKm ?? 0,
        speedKmS: info?.speedKmS ?? 0,
      };
    }
    this.selectedHit = null;
    const index = this.markers.pickToIndex(px);
    return index >= 0 ? { type: "neo", index } : { type: "none" };
  }
}
