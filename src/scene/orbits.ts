import { mat4 } from "gl-matrix";
import { createProgram, uniformLocations } from "../gl/program";
import { lineVert, lineFrag } from "../gl/shaders";

type GL = WebGL2RenderingContext;

export interface OrbitSpec {
  /** Line-strip points in AU (scene frame), from sampleOrbit(). */
  points: Float32Array;
  color: [number, number, number];
  alpha: number;
}

interface Entry {
  buf: WebGLBuffer;
  vao: WebGLVertexArrayObject;
  count: number;
  color: [number, number, number];
  alpha: number;
}

/** Draws a dynamic set of orbit path line strips (heliocentric, AU units). */
export class Orbits {
  private gl: GL;
  private prog: WebGLProgram;
  private u: Record<string, WebGLUniformLocation | null>;
  private entries: Entry[] = [];
  private readonly model = mat4.create();

  constructor(gl: GL) {
    this.gl = gl;
    this.prog = createProgram(gl, lineVert, lineFrag);
    this.u = uniformLocations(gl, this.prog, ["uView", "uProj", "uModel", "uColor", "uAlpha"]);
  }

  private clearEntries() {
    const gl = this.gl;
    for (const e of this.entries) {
      gl.deleteBuffer(e.buf);
      gl.deleteVertexArray(e.vao);
    }
    this.entries.length = 0;
  }

  setOrbits(specs: OrbitSpec[]) {
    const gl = this.gl;
    this.clearEntries();
    for (const s of specs) {
      const vao = gl.createVertexArray()!;
      gl.bindVertexArray(vao);
      const buf = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, s.points, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
      this.entries.push({ buf, vao, count: s.points.length / 3, color: s.color, alpha: s.alpha });
    }
  }

  draw(view: mat4, proj: mat4, auUnit: number) {
    if (this.entries.length === 0) return;
    const gl = this.gl;
    mat4.fromScaling(this.model, [auUnit, auUnit, auUnit]);
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(this.u.uView, false, view);
    gl.uniformMatrix4fv(this.u.uProj, false, proj);
    gl.uniformMatrix4fv(this.u.uModel, false, this.model);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    for (const e of this.entries) {
      gl.uniform3fv(this.u.uColor, e.color);
      gl.uniform1f(this.u.uAlpha, e.alpha);
      gl.bindVertexArray(e.vao);
      gl.drawArrays(gl.LINE_STRIP, 0, e.count);
    }
    gl.bindVertexArray(null);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  dispose() {
    this.clearEntries();
    this.gl.deleteProgram(this.prog);
  }
}
