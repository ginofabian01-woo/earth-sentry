import { mat4 } from "gl-matrix";
import * as satellite from "satellite.js";
import { createProgram, uniformLocations } from "../gl/program";
import { satVert, satFrag, lineVert, lineFrag } from "../gl/shaders";
import { EARTH_RADIUS_KM } from "../data/types";
import { ISS_NORAD, type Sat } from "../data/celestrak";

type GL = WebGL2RenderingContext;

export interface LayerStyle {
  color: [number, number, number];
  size: number;
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
}

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
  private readonly identity = mat4.create();
  private layers = new Map<string, Layer>();

  constructor(gl: GL) {
    this.gl = gl;
    this.prog = createProgram(gl, satVert, satFrag);
    this.u = uniformLocations(gl, this.prog, ["uView", "uProj", "uSize", "uColor"]);
    this.lineProg = createProgram(gl, lineVert, lineFrag);
    this.lineU = uniformLocations(gl, this.lineProg, ["uView", "uProj", "uModel", "uColor", "uAlpha"]);
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
      };
      gl.bindVertexArray(layer.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, layer.buf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      if (showTrail) {
        layer.trailBuf = gl.createBuffer()!;
        layer.trailVao = gl.createVertexArray()!;
        gl.bindVertexArray(layer.trailVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, layer.trailBuf);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      }
      gl.bindVertexArray(null);
      this.layers.set(key, layer);
    } else {
      layer.sats = sats;
      layer.style = style;
      layer.scratch = new Float32Array(sats.length * 3);
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
      for (const s of layer.sats) {
        const pv = satellite.propagate(s.satrec, date);
        const p = pv?.position;
        if (!p || typeof p === "boolean") continue;
        out[n * 3] = p.x / R;
        out[n * 3 + 1] = p.z / R; // ECI z (north) -> scene up
        out[n * 3 + 2] = -p.y / R;
        n++;
      }
      layer.count = n;
      gl.bindBuffer(gl.ARRAY_BUFFER, layer.buf);
      gl.bufferData(gl.ARRAY_BUFFER, out.subarray(0, n * 3), gl.DYNAMIC_DRAW);

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
    let m = 0;
    for (let i = 0; i <= SEG; i++) {
      const t = new Date(date.getTime() + (i / SEG - 0.5) * spanMin * 60000);
      const pv = satellite.propagate(iss.satrec, t);
      const p = pv?.position;
      if (!p || typeof p === "boolean") continue;
      pts[m * 3] = p.x / R;
      pts[m * 3 + 1] = p.z / R;
      pts[m * 3 + 2] = -p.y / R;
      m++;
    }
    layer.trailCount = m;
    gl.bindBuffer(gl.ARRAY_BUFFER, layer.trailBuf);
    gl.bufferData(gl.ARRAY_BUFFER, pts.subarray(0, m * 3), gl.DYNAMIC_DRAW);
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
      if (!layer.enabled || !layer.showTrail || !layer.trailVao || layer.trailCount < 2) continue;
      gl.uniform3fv(this.lineU.uColor, layer.style.color);
      gl.uniform1f(this.lineU.uAlpha, 0.5);
      gl.bindVertexArray(layer.trailVao);
      gl.drawArrays(gl.LINE_STRIP, 0, layer.trailCount);
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

  dispose() {
    const gl = this.gl;
    for (const layer of this.layers.values()) {
      gl.deleteBuffer(layer.buf);
      gl.deleteVertexArray(layer.vao);
      if (layer.trailBuf) gl.deleteBuffer(layer.trailBuf);
      if (layer.trailVao) gl.deleteVertexArray(layer.trailVao);
    }
    this.layers.clear();
    gl.deleteProgram(this.prog);
    gl.deleteProgram(this.lineProg);
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
}[] = [
  { key: "starlink", group: "starlink", label: "STARLINK", style: { color: [0.35, 0.8, 1.0], size: 2.2 }, defaultOn: true },
  { key: "gps", group: "gps-ops", label: "GPS", style: { color: [1.0, 0.72, 0.2], size: 3.2 }, defaultOn: true },
  { key: "active", group: "active", label: "ALL ACTIVE", style: { color: [0.72, 0.76, 0.82], size: 1.5 }, defaultOn: false },
  { key: "iss", group: "stations", label: "ISS", style: { color: [0.4, 1.0, 0.5], size: 6.0 }, trail: true, issOnly: true, defaultOn: true },
];
