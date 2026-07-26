import { mat4, vec3 } from "gl-matrix";
import { createProgram, uniformLocations } from "../gl/program";
import { createQuad } from "../gl/geometry";
import { markerVert, markerFrag } from "../gl/shaders";
import { approximatePosition } from "../orbital/approximate";
import { SCENE } from "./scale";
import type { CloseApproach } from "../data/types";

type GL = WebGL2RenderingContext;
const FLOATS_PER = 10; // center(3) size(1) color(3) pickColor(3)

const HAZARD_COLOR: [number, number, number] = [1.0, 0.35, 0.3];
const SAFE_COLOR: [number, number, number] = [1.0, 0.69, 0.0];

/** Instanced billboard markers for close approaches. */
export class Markers {
  private gl: GL;
  private prog: WebGLProgram;
  private u: Record<string, WebGLUniformLocation | null>;
  private vao: WebGLVertexArrayObject;
  private instanceBuf: WebGLBuffer;

  count = 0;
  approaches: CloseApproach[] = [];
  readonly positions: vec3[] = [];
  selectedIndex = -1;

  constructor(gl: GL) {
    this.gl = gl;
    this.prog = createProgram(gl, markerVert, markerFrag);
    this.u = uniformLocations(gl, this.prog, ["uView", "uProj", "uPickMode", "uSelected", "uTime"]);

    // VAO: location 0 = quad corners (divisor 0); 1..4 = per-instance (divisor 1)
    this.vao = createQuad(gl); // binds quad buffer to loc 0 and leaves VAO bound-then-unbound
    gl.bindVertexArray(this.vao);
    this.instanceBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuf);
    const stride = FLOATS_PER * 4;
    const setup = (loc: number, size: number, offsetFloats: number) => {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offsetFloats * 4);
      gl.vertexAttribDivisor(loc, 1);
    };
    setup(1, 3, 0); // iCenter
    setup(2, 1, 3); // iSize
    setup(3, 3, 4); // iColor
    setup(4, 3, 7); // iPickColor
    gl.bindVertexArray(null);
  }

  /**
   * Upload marker instances. In approximate mode positions are derived from miss
   * distance; in real mode pass `positions` aligned to `approaches` (null hides
   * that marker) so selection indices stay consistent across modes.
   */
  setData(
    approaches: CloseApproach[],
    opts: { positions?: (vec3 | null)[]; baseSize?: number } = {},
  ) {
    const gl = this.gl;
    this.approaches = approaches;
    this.count = approaches.length;
    this.positions.length = 0;
    this.selectedIndex = -1;
    const baseSize = opts.baseSize ?? SCENE.MARKER_BASE_SIZE;

    const arr = new Float32Array(this.count * FLOATS_PER);
    for (let i = 0; i < this.count; i++) {
      const ca = approaches[i];
      const override = opts.positions ? opts.positions[i] : undefined;
      const hidden = opts.positions && !override;
      const p = override ?? approximatePosition(ca);
      this.positions.push(vec3.clone(p));

      const sizeScale = Math.min(3, Math.max(0.5, 0.5 + Math.log10(Math.max(1, ca.diameterM)) / 3));
      const size = hidden ? 0 : baseSize * sizeScale;
      const color = ca.hazardous ? HAZARD_COLOR : SAFE_COLOR;

      // pick id = index + 1 encoded into RGB
      const id = i + 1;
      const pr = (id & 255) / 255;
      const pg = ((id >> 8) & 255) / 255;
      const pb = ((id >> 16) & 255) / 255;

      const o = i * FLOATS_PER;
      arr[o] = p[0]; arr[o + 1] = p[1]; arr[o + 2] = p[2];
      arr[o + 3] = size;
      arr[o + 4] = color[0]; arr[o + 5] = color[1]; arr[o + 6] = color[2];
      arr[o + 7] = pr; arr[o + 8] = pg; arr[o + 9] = pb;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuf);
    gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW);
  }

  /** Decode a pick pixel to an approach index, or -1. */
  pickToIndex(rgba: [number, number, number, number]): number {
    const id = rgba[0] + (rgba[1] << 8) + (rgba[2] << 16);
    const idx = id - 1;
    return idx >= 0 && idx < this.count ? idx : -1;
  }

  draw(view: mat4, proj: mat4, time: number, pickMode: boolean) {
    if (this.count === 0) return;
    const gl = this.gl;
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(this.u.uView, false, view);
    gl.uniformMatrix4fv(this.u.uProj, false, proj);
    gl.uniform1f(this.u.uTime, time);
    gl.uniform1f(this.u.uPickMode, pickMode ? 1 : 0);
    gl.uniform1i(this.u.uSelected, this.selectedIndex);

    if (pickMode) {
      gl.disable(gl.BLEND);
      gl.depthMask(true);
    } else {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.depthMask(false);
    }
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.count);
    gl.bindVertexArray(null);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}
