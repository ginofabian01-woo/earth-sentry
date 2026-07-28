import { mat3, mat4, vec3 } from "gl-matrix";
import { createProgram, uniformLocations } from "../gl/program";
import { createMesh, createStarfield, makeUVSphere, type Mesh } from "../gl/geometry";
import {
  planetVert,
  planetFrag,
  sunVert,
  sunFrag,
  starVert,
  starFrag,
} from "../gl/shaders";
import { SCENE } from "./scale";
import { makeEarthTexture } from "./earthTexture";

type GL = WebGL2RenderingContext;

/** Sun/Earth/Moon + starfield. Owns their programs, meshes and draw calls. */
export class Bodies {
  private gl: GL;
  private sphere: Mesh;
  private stars: { vao: WebGLVertexArrayObject; count: number };

  private planetProg: WebGLProgram;
  private planetU: Record<string, WebGLUniformLocation | null>;
  private sunProg: WebGLProgram;
  private sunU: Record<string, WebGLUniformLocation | null>;
  private starProg: WebGLProgram;
  private starU: Record<string, WebGLUniformLocation | null>;

  private earthTex: WebGLTexture;
  readonly sunDir = vec3.create();
  private readonly sunPos = vec3.create();

  private readonly model = mat4.create();
  private readonly normalMat = mat3.create();

  constructor(gl: GL) {
    this.gl = gl;
    this.sphere = createMesh(gl, makeUVSphere(48, 96));
    this.stars = createStarfield(gl, 2600, SCENE.STAR_RADIUS);
    this.earthTex = makeEarthTexture(gl);

    this.planetProg = createProgram(gl, planetVert, planetFrag);
    this.planetU = uniformLocations(gl, this.planetProg, [
      "uModel", "uView", "uProj", "uNormalMat", "uSunDir", "uColorA",
      "uColorB", "uUseTex", "uTex", "uAmbient", "uRimStrength", "uCamPos",
    ]);
    this.sunProg = createProgram(gl, sunVert, sunFrag);
    this.sunU = uniformLocations(gl, this.sunProg, ["uModel", "uView", "uProj", "uTime", "uCamPos"]);
    this.starProg = createProgram(gl, starVert, starFrag);
    this.starU = uniformLocations(gl, this.starProg, ["uView", "uProj", "uTime"]);

    // fixed sun direction (upper-right, slightly front)
    vec3.normalize(this.sunDir, vec3.fromValues(1, 0.22, 0.42));
    vec3.scale(this.sunPos, this.sunDir, SCENE.SUN_DISTANCE);
  }

  dispose() {
    const gl = this.gl;
    gl.deleteProgram(this.planetProg);
    gl.deleteProgram(this.sunProg);
    gl.deleteProgram(this.starProg);
    gl.deleteVertexArray(this.sphere.vao);
    gl.deleteVertexArray(this.stars.vao);
    gl.deleteTexture(this.earthTex);
  }

  drawStars(view: mat4, proj: mat4, time: number) {
    const gl = this.gl;
    gl.useProgram(this.starProg);
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.uniformMatrix4fv(this.starU.uView, false, view);
    gl.uniformMatrix4fv(this.starU.uProj, false, proj);
    gl.uniform1f(this.starU.uTime, time);
    gl.bindVertexArray(this.stars.vao);
    gl.drawArrays(gl.POINTS, 0, this.stars.count);
    gl.bindVertexArray(null);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  drawSun(view: mat4, proj: mat4, camPos: vec3, time: number) {
    this.drawSunAt(view, proj, camPos, time, this.sunPos, SCENE.SUN_RADIUS);
  }

  /** Emissive Sun sphere at an arbitrary center/radius (used in helio mode). */
  drawSunAt(view: mat4, proj: mat4, camPos: vec3, time: number, center: vec3, radius: number) {
    const gl = this.gl;
    mat4.fromTranslation(this.model, center);
    mat4.scale(this.model, this.model, [radius, radius, radius]);
    gl.useProgram(this.sunProg);
    gl.uniformMatrix4fv(this.sunU.uModel, false, this.model);
    gl.uniformMatrix4fv(this.sunU.uView, false, view);
    gl.uniformMatrix4fv(this.sunU.uProj, false, proj);
    gl.uniform3fv(this.sunU.uCamPos, camPos);
    gl.uniform1f(this.sunU.uTime, time);
    gl.bindVertexArray(this.sphere.vao);
    gl.drawElements(gl.TRIANGLES, this.sphere.indexCount, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }

  /** Generic lit sphere (a planet body) with a per-call sun direction. */
  drawBody(
    view: mat4, proj: mat4, camPos: vec3,
    center: vec3, radius: number, spin: number,
    colorA: [number, number, number], colorB: [number, number, number],
    tex: WebGLTexture | null, ambient: number, sunDir: vec3,
  ) {
    this.drawSphere(view, proj, camPos, center, radius, spin, colorA, colorB, tex, ambient, 0, sunDir);
  }

  get earthTexture() {
    return this.earthTex;
  }

  private drawSphere(
    view: mat4, proj: mat4, camPos: vec3,
    center: vec3, radius: number, spin: number,
    colorA: [number, number, number], colorB: [number, number, number],
    tex: WebGLTexture | null, ambient: number, rim: number,
    sunDir: vec3 = this.sunDir,
  ) {
    const gl = this.gl;
    mat4.fromTranslation(this.model, center);
    mat4.rotateY(this.model, this.model, spin);
    mat4.scale(this.model, this.model, [radius, radius, radius]);
    mat3.normalFromMat4(this.normalMat, this.model);

    gl.useProgram(this.planetProg);
    gl.uniformMatrix4fv(this.planetU.uModel, false, this.model);
    gl.uniformMatrix4fv(this.planetU.uView, false, view);
    gl.uniformMatrix4fv(this.planetU.uProj, false, proj);
    gl.uniformMatrix3fv(this.planetU.uNormalMat, false, this.normalMat);
    gl.uniform3fv(this.planetU.uSunDir, sunDir);
    gl.uniform3fv(this.planetU.uCamPos, camPos);
    gl.uniform3fv(this.planetU.uColorA, colorA);
    gl.uniform3fv(this.planetU.uColorB, colorB);
    gl.uniform1f(this.planetU.uAmbient, ambient);
    gl.uniform1f(this.planetU.uRimStrength, rim);
    if (tex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(this.planetU.uTex, 0);
      gl.uniform1f(this.planetU.uUseTex, 1);
    } else {
      gl.uniform1f(this.planetU.uUseTex, 0);
    }
    gl.bindVertexArray(this.sphere.vao);
    gl.drawElements(gl.TRIANGLES, this.sphere.indexCount, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }

  drawEarth(view: mat4, proj: mat4, camPos: vec3, time: number) {
    this.drawSphere(
      view, proj, camPos, [0, 0, 0], SCENE.EARTH_RADIUS, time * 0.05,
      [0.05, 0.2, 0.45], [0.15, 0.35, 0.2], this.earthTex, 0.06, 0.9,
    );
  }

  drawMoon(view: mat4, proj: mat4, camPos: vec3, time: number) {
    const a = time * 0.12;
    const center = vec3.fromValues(
      Math.cos(a) * SCENE.MOON_DISTANCE, Math.sin(a) * 3.5, Math.sin(a) * SCENE.MOON_DISTANCE,
    );
    this.drawSphere(
      view, proj, camPos, center, SCENE.MOON_RADIUS, a,
      [0.32, 0.32, 0.33], [0.5, 0.49, 0.47], null, 0.05, 0.0,
    );
    return center;
  }

  /** Moon world position at a given time (matches drawMoon's orbit). */
  moonPosition(time: number, out = vec3.create()): vec3 {
    const a = time * 0.12;
    return vec3.set(out, Math.cos(a) * SCENE.MOON_DISTANCE, Math.sin(a) * 3.5, Math.sin(a) * SCENE.MOON_DISTANCE);
  }

  get sunWorldPosition(): vec3 {
    return this.sunPos;
  }
}
