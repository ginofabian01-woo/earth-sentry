import { mat4, vec3 } from "gl-matrix";
import * as satellite from "satellite.js";
import { createProgram, uniformLocations } from "../gl/program";
import { satVert, satFrag, satPickVert, satPickFrag, lineVert, lineFrag } from "../gl/shaders";
import { EARTH_RADIUS_KM } from "../data/types";
import { ISS_NORAD, type Sat } from "../data/celestrak";

type GL = WebGL2RenderingContext;

export interface LayerStyle {
  color: [number, number, number];
  size: number;
}

export interface SatHit {
  sat: Sat;
  layerKey: string;
  color: [number, number, number];
}

export interface SatInfo {
  altitudeKm: number;
  speedKmS: number;
}

interface Layer {
  sats: Sat[];
  style: LayerStyle;
  enabled: boolean;
  buf: WebGLBuffer;
  vao: WebGLVertexArrayObject;
  scratch: Float32Array;
  count: number;
  showTrail: boolean;
  trailBuf: WebGLBuffer | null;
  trailVao: WebGLVertexArrayObject | null;
  trailCount: number;
  groundBuf: WebGLBuffer | null;
  groundVao: WebGLVertexArrayObject | null;
  groundCount: number;
  pickBuf: WebGLBuffer;
  pickScratch: Float32Array;
  globalIds: Float32Array;
}

/** Surface offset for the ground track so it doesn't z-fight the globe. */
const GROUND_R = 1.015;

/** Pick-id offset so satellites don't collide with NEO marker ids (1..N). */
export const SAT_PICK_BASE = 100000;

const R = EARTH_RADIUS_KM;

/**
 * SGP4-propagated satellite layers (CelesTrak). Positions are ECI (km) mapped to
 * scene Earth-radii units, so they sit in the real near-Earth shell in the
 * geocentric view. Layers are propagated on a throttled cadence to a fast clock.
 */
export class Satellites {
  private gl: GL;
  private prog: WebGLProgram;
  private u: Record<string, WebGLUniformLocation | null>;
  private lineProg: WebGLProgram;
  private lineU: Record<string, WebGLUniformLocation | null>;
  private pickProg: WebGLProgram;
  private pickU: Record<string, WebGLUniformLocation | null>;
  private readonly identity = mat4.create();
  private layers = new Map<string, Layer>();
  /** Flat registry: pickList[globalId-1] -> hit. Rebuilt on layer change. */
  private pickList: SatHit[] = [];

  constructor(gl: GL) {
    this.gl = gl;
    this.prog = createProgram(gl, satVert, satFrag);
    this.u = uniformLocations(gl, this.prog, ["uView", "uProj", "uSize", "uColor"]);
    this.lineProg = createProgram(gl, lineVert, lineFrag);
    this.lineU = uniformLocations(gl, this.lineProg, ["uView", "uProj", "uModel", "uColor", "uAlpha"]);
    this.pickProg = createProgram(gl, satPickVert, satPickFrag);
    this.pickU = uniformLocations(gl, this.pickProg, ["uView", "uProj", "uSize", "uBase"]);
  }

  isEnabled(key: string) {
    return this.layers.get(key)?.enabled ?? false;
  }

  hasLayer(key: string) {
    return this.layers.has(key);
  }

  setLayer(key: string, sats: Sat[], style: LayerStyle, showTrail = false) {
    const gl = this.gl;
    let layer = this.layers.get(key);
    if (!layer) {
      layer = {
        sats, style, enabled: true,
        buf: gl.createBuffer()!, vao: gl.createVertexArray()!,
        scratch: new Float32Array(sats.length * 3), count: 0,
        showTrail, trailBuf: null, trailVao: null, trailCount: 0,
        groundBuf: null, groundVao: null, groundCount: 0,
        pickBuf: gl.createBuffer()!, pickScratch: new Float32Array(sats.length),
        globalIds: new Float32Array(sats.length),
      };
      gl.bindVertexArray(layer.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, layer.buf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      // per-point pick id at location 1 (ignored by the normal point shader)
      gl.bindBuffer(gl.ARRAY_BUFFER, layer.pickBuf);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 0, 0);
      if (showTrail) {
        layer.trailBuf = gl.createBuffer()!;
        layer.trailVao = gl.createVertexArray()!;
        gl.bindVertexArray(layer.trailVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, layer.trailBuf);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

        layer.groundBuf = gl.createBuffer()!;
        layer.groundVao = gl.createVertexArray()!;
        gl.bindVertexArray(layer.groundVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, layer.groundBuf);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      }
      gl.bindVertexArray(null);
      this.layers.set(key, layer);
    } else {
      layer.sats = sats;
      layer.style = style;
      layer.scratch = new Float32Array(sats.length * 3);
      layer.pickScratch = new Float32Array(sats.length);
      layer.globalIds = new Float32Array(sats.length);
    }
    this.rebuildPickList();
  }

  /** Assign every satellite a stable 1-based global pick id across all layers. */
  private rebuildPickList() {
    this.pickList = [];
    for (const [key, layer] of this.layers) {
      for (let i = 0; i < layer.sats.length; i++) {
        this.pickList.push({ sat: layer.sats[i], layerKey: key, color: layer.style.color });
        layer.globalIds[i] = this.pickList.length; // 1-based
      }
    }
  }

  setEnabled(key: string, on: boolean) {
    const layer = this.layers.get(key);
    if (layer) layer.enabled = on;
  }

  /** Propagate all enabled layers to `date` and upload updated positions. */
  update(date: Date) {
    const gl = this.gl;
    for (const layer of this.layers.values()) {
      if (!layer.enabled || layer.sats.length === 0) continue;
      let n = 0;
      const out = layer.scratch;
      const ids = layer.pickScratch;
      for (let i = 0; i < layer.sats.length; i++) {
        const pv = satellite.propagate(layer.sats[i].satrec, date);
        const p = pv?.position;
        if (!p || typeof p === "boolean") continue;
        out[n * 3] = p.x / R;
        out[n * 3 + 1] = p.z / R; // ECI z (north) -> scene up
        out[n * 3 + 2] = -p.y / R;
        ids[n] = layer.globalIds[i];
        n++;
      }
      layer.count = n;
      gl.bindBuffer(gl.ARRAY_BUFFER, layer.buf);
      gl.bufferData(gl.ARRAY_BUFFER, out.subarray(0, n * 3), gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, layer.pickBuf);
      gl.bufferData(gl.ARRAY_BUFFER, ids.subarray(0, n), gl.DYNAMIC_DRAW);

      if (layer.showTrail && layer.trailBuf) this.updateTrail(layer, date);
    }
  }

  /** Sample one orbit period around `date` for the layer's flagged object (ISS). */
  private updateTrail(layer: Layer, date: Date) {
    const gl = this.gl;
    const iss = layer.sats.find((s) => s.noradId === ISS_NORAD) ?? layer.sats[0];
    if (!iss) return;
    const SEG = 120;
    const spanMin = 92; // ~one ISS orbit
    const pts = new Float32Array((SEG + 1) * 3);
    const ground = new Float32Array((SEG + 1) * 3);
    let m = 0;
    for (let i = 0; i <= SEG; i++) {
      const t = new Date(date.getTime() + (i / SEG - 0.5) * spanMin * 60000);
      const pv = satellite.propagate(iss.satrec, t);
      const p = pv?.position;
      if (!p || typeof p === "boolean") continue;
      const x = p.x / R, y = p.z / R, z = -p.y / R;
      pts[m * 3] = x;
      pts[m * 3 + 1] = y;
      pts[m * 3 + 2] = z;
      // sub-satellite point: project onto the globe surface (same ECI frame)
      const inv = GROUND_R / (Math.hypot(x, y, z) || 1);
      ground[m * 3] = x * inv;
      ground[m * 3 + 1] = y * inv;
      ground[m * 3 + 2] = z * inv;
      m++;
    }
    layer.trailCount = m;
    gl.bindBuffer(gl.ARRAY_BUFFER, layer.trailBuf);
    gl.bufferData(gl.ARRAY_BUFFER, pts.subarray(0, m * 3), gl.DYNAMIC_DRAW);
    layer.groundCount = m;
    if (layer.groundBuf) {
      gl.bindBuffer(gl.ARRAY_BUFFER, layer.groundBuf);
      gl.bufferData(gl.ARRAY_BUFFER, ground.subarray(0, m * 3), gl.DYNAMIC_DRAW);
    }
  }

  draw(view: mat4, proj: mat4, dpr: number) {
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);

    // trails first (under the points)
    gl.useProgram(this.lineProg);
    gl.uniformMatrix4fv(this.lineU.uView, false, view);
    gl.uniformMatrix4fv(this.lineU.uProj, false, proj);
    gl.uniformMatrix4fv(this.lineU.uModel, false, this.identity);
    for (const layer of this.layers.values()) {
      if (!layer.enabled || !layer.showTrail) continue;
      gl.uniform3fv(this.lineU.uColor, layer.style.color);
      if (layer.trailVao && layer.trailCount >= 2) {
        gl.uniform1f(this.lineU.uAlpha, 0.5);
        gl.bindVertexArray(layer.trailVao);
        gl.drawArrays(gl.LINE_STRIP, 0, layer.trailCount);
      }
      // ground track on the globe surface (dimmer)
      if (layer.groundVao && layer.groundCount >= 2) {
        gl.uniform1f(this.lineU.uAlpha, 0.28);
        gl.bindVertexArray(layer.groundVao);
        gl.drawArrays(gl.LINE_STRIP, 0, layer.groundCount);
      }
    }

    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(this.u.uView, false, view);
    gl.uniformMatrix4fv(this.u.uProj, false, proj);
    for (const layer of this.layers.values()) {
      if (!layer.enabled || layer.count === 0) continue;
      gl.uniform3fv(this.u.uColor, layer.style.color);
      gl.uniform1f(this.u.uSize, layer.style.size * dpr);
      gl.bindVertexArray(layer.vao);
      gl.drawArrays(gl.POINTS, 0, layer.count);
    }
    gl.bindVertexArray(null);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  /** Render enabled layers into the pick target with fat, id-colored points. */
  drawPick(view: mat4, proj: mat4, dpr: number) {
    const gl = this.gl;
    gl.useProgram(this.pickProg);
    gl.uniformMatrix4fv(this.pickU.uView, false, view);
    gl.uniformMatrix4fv(this.pickU.uProj, false, proj);
    gl.uniform1f(this.pickU.uBase, SAT_PICK_BASE);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    for (const layer of this.layers.values()) {
      if (!layer.enabled || layer.count === 0) continue;
      gl.uniform1f(this.pickU.uSize, Math.max(9, layer.style.size * dpr * 2.2));
      gl.bindVertexArray(layer.vao);
      gl.drawArrays(gl.POINTS, 0, layer.count);
    }
    gl.bindVertexArray(null);
  }

  /** Resolve a decoded pick id (already offset-subtracted) to a satellite. */
  resolvePick(globalId: number): SatHit | null {
    return this.pickList[globalId - 1] ?? null;
  }

  /** The ISS hit (if its layer is loaded), regardless of enabled state. */
  getISS(): SatHit | null {
    return this.pickList.find((h) => h.sat.noradId === ISS_NORAD) ?? null;
  }

  /** Scene-space position of a satellite at a date, or null if propagation fails. */
  positionOf(sat: Sat, date: Date, out = vec3.create()): vec3 | null {
    const pv = satellite.propagate(sat.satrec, date);
    const p = pv?.position;
    if (!p || typeof p === "boolean") return null;
    return vec3.set(out, p.x / R, p.z / R, -p.y / R);
  }

  /** Altitude (km above surface) and speed (km/s) at a date. */
  infoOf(sat: Sat, date: Date): SatInfo | null {
    const pv = satellite.propagate(sat.satrec, date);
    const p = pv?.position;
    const v = pv?.velocity;
    if (!p || typeof p === "boolean" || !v || typeof v === "boolean") return null;
    return {
      altitudeKm: Math.hypot(p.x, p.y, p.z) - R,
      speedKmS: Math.hypot(v.x, v.y, v.z),
    };
  }

  dispose() {
    const gl = this.gl;
    for (const layer of this.layers.values()) {
      gl.deleteBuffer(layer.buf);
      gl.deleteBuffer(layer.pickBuf);
      gl.deleteVertexArray(layer.vao);
      if (layer.trailBuf) gl.deleteBuffer(layer.trailBuf);
      if (layer.trailVao) gl.deleteVertexArray(layer.trailVao);
      if (layer.groundBuf) gl.deleteBuffer(layer.groundBuf);
      if (layer.groundVao) gl.deleteVertexArray(layer.groundVao);
    }
    this.layers.clear();
    this.pickList = [];
    gl.deleteProgram(this.prog);
    gl.deleteProgram(this.lineProg);
    gl.deleteProgram(this.pickProg);
  }
}

/** Layer styling + display config shared by UI and scene. */
export const SAT_LAYERS: {
  key: string;
  group: import("../data/celestrak").CelestrakGroup;
  label: string;
  style: LayerStyle;
  trail?: boolean;
  issOnly?: boolean;
  defaultOn: boolean;
  hint: string;
}[] = [
  { key: "starlink", group: "starlink", label: "STARLINK", style: { color: [0.35, 0.8, 1.0], size: 2.2 }, defaultOn: true,
    hint: "SpaceX Starlink broadband constellation — thousands of satellites in low Earth orbit (~550 km)." },
  { key: "gps", group: "gps-ops", label: "GPS", style: { color: [1.0, 0.72, 0.2], size: 3.2 }, defaultOn: true,
    hint: "Operational GPS navigation satellites in medium Earth orbit (~20,200 km)." },
  { key: "active", group: "active", label: "ALL ACTIVE", style: { color: [0.72, 0.76, 0.82], size: 1.5 }, defaultOn: false,
    hint: "The full CelesTrak catalog of ~15,000 active satellites. Heavy layer — expect a brief load." },
  { key: "iss", group: "stations", label: "ISS", style: { color: [0.4, 1.0, 0.5], size: 6.0 }, trail: true, issOnly: true, defaultOn: true,
    hint: "International Space Station (NORAD 25544) with its orbit trail and ground track." },
];
