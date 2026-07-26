import { mat4, vec3 } from "gl-matrix";

/**
 * Damped orbit camera driven by pointer + wheel. Spherical coords around a
 * target point. Exposes view/projection matrices and world-space position.
 */
export class OrbitCamera {
  // current + target spherical state (for damping)
  theta = Math.PI * 0.25; // azimuth
  phi = Math.PI * 0.32; // polar from +Y
  radius = 8;
  private tTheta = this.theta;
  private tPhi = this.phi;
  private tRadius = this.radius;

  target = vec3.fromValues(0, 0, 0);
  fov = (50 * Math.PI) / 180;
  near = 0.05;
  far = 6000;

  minRadius = 1.6;
  maxRadius = 4000;
  private readonly minPhi = 0.08;
  private readonly maxPhi = Math.PI - 0.08;

  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  readonly position = vec3.create();
  private readonly view = mat4.create();
  private readonly proj = mat4.create();

  attach(el: HTMLElement) {
    el.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    el.addEventListener("wheel", this.onWheel, { passive: false });
  }
  detach(el: HTMLElement) {
    el.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    el.removeEventListener("wheel", this.onWheel);
  }

  private onDown = (e: PointerEvent) => {
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };
  private onUp = () => {
    this.dragging = false;
  };
  private onMove = (e: PointerEvent) => {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.tTheta -= dx * 0.005;
    this.tPhi = clamp(this.tPhi - dy * 0.005, this.minPhi, this.maxPhi);
  };
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const factor = Math.exp(e.deltaY * 0.0012);
    this.tRadius = clamp(this.tRadius * factor, this.minRadius, this.maxRadius);
  };

  /** Programmatic framing (used when focusing an object). */
  frame(radius: number) {
    this.tRadius = clamp(radius, this.minRadius, this.maxRadius);
  }

  update(dt: number) {
    const k = 1 - Math.exp(-dt * 12); // critically-ish damped lerp
    this.theta += (this.tTheta - this.theta) * k;
    this.phi += (this.tPhi - this.phi) * k;
    this.radius += (this.tRadius - this.radius) * k;

    const sinPhi = Math.sin(this.phi);
    vec3.set(
      this.position,
      this.target[0] + this.radius * sinPhi * Math.sin(this.theta),
      this.target[1] + this.radius * Math.cos(this.phi),
      this.target[2] + this.radius * sinPhi * Math.cos(this.theta),
    );
    mat4.lookAt(this.view, this.position, this.target, [0, 1, 0]);
  }

  viewMatrix() {
    return this.view;
  }
  projMatrix(aspect: number) {
    // dynamic near plane so we don't lose precision when zoomed way out
    const near = Math.max(this.near, this.radius * 0.002);
    mat4.perspective(this.proj, this.fov, aspect, near, this.far);
    return this.proj;
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
