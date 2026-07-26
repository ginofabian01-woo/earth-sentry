import { OrbitCamera } from "./camera";

export type FrameFn = (dt: number, elapsed: number) => void;

/**
 * Owns the WebGL2 context, canvas sizing (DPR-aware), the render loop, and a
 * reusable 1x1-per-frame offscreen framebuffer for color-id picking.
 */
export class Renderer {
  readonly gl: WebGL2RenderingContext;
  readonly canvas: HTMLCanvasElement;
  readonly camera = new OrbitCamera();

  width = 1;
  height = 1;
  private raf = 0;
  private last = 0;
  private elapsed = 0;
  private frameFn: FrameFn | null = null;
  private ro: ResizeObserver;

  // pick framebuffer
  private pickFbo: WebGLFramebuffer | null = null;
  private pickTex: WebGLTexture | null = null;
  private pickDepth: WebGLRenderbuffer | null = null;
  private pickW = 0;
  private pickH = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", {
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("WebGL2 is not available in this browser.");
    this.gl = gl;
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.camera.attach(canvas);
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
  }

  get aspect() {
    return this.width / this.height;
  }

  start(fn: FrameFn) {
    this.frameFn = fn;
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.elapsed += dt;
      this.camera.update(dt);
      this.frameFn?.(dt, this.elapsed);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.frameFn = null;
  }

  dispose() {
    this.stop();
    this.ro.disconnect();
    this.camera.detach(this.canvas);
    const gl = this.gl;
    if (this.pickFbo) gl.deleteFramebuffer(this.pickFbo);
    if (this.pickTex) gl.deleteTexture(this.pickTex);
    if (this.pickDepth) gl.deleteRenderbuffer(this.pickDepth);
  }

  clear(r: number, g: number, b: number) {
    const gl = this.gl;
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(r, g, b, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  /** Bind (creating/resizing as needed) the offscreen pick framebuffer. */
  bindPickTarget() {
    const gl = this.gl;
    if (!this.pickFbo) {
      this.pickFbo = gl.createFramebuffer();
      this.pickTex = gl.createTexture();
      this.pickDepth = gl.createRenderbuffer();
    }
    if (this.pickW !== this.width || this.pickH !== this.height) {
      this.pickW = this.width;
      this.pickH = this.height;
      gl.bindTexture(gl.TEXTURE_2D, this.pickTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.pickDepth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.width, this.height);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.pickTex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.pickDepth);
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  /** Read one RGBA pixel (CSS coords, origin top-left) from the pick target. */
  readPick(cssX: number, cssY: number): [number, number, number, number] {
    const gl = this.gl;
    const dpr = this.width / this.canvas.clientWidth;
    const px = Math.floor(cssX * dpr);
    const py = Math.floor((this.canvas.clientHeight - cssY) * dpr);
    const out = new Uint8Array(4);
    gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return [out[0], out[1], out[2], out[3]];
  }

  bindScreen() {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }
}
