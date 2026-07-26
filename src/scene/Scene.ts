import { Renderer } from "../gl/renderer";
import { Bodies } from "./bodies";
import { Markers } from "./markers";
import type { CloseApproach } from "../data/types";

/** Owns all drawables and the per-frame draw order + picking. */
export class Scene {
  readonly renderer: Renderer;
  private bodies: Bodies;
  readonly markers: Markers;

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.bodies = new Bodies(renderer.gl);
    this.markers = new Markers(renderer.gl);
  }

  setApproaches(list: CloseApproach[]) {
    this.markers.setData(list);
  }

  select(index: number) {
    this.markers.selectedIndex = index;
  }

  render = (_dt: number, elapsed: number) => {
    const r = this.renderer;
    const cam = r.camera;
    const view = cam.viewMatrix();
    const proj = cam.projMatrix(r.aspect);

    r.bindScreen();
    r.clear(0.043, 0.047, 0.039); // charcoal
    this.bodies.drawStars(view, proj, elapsed);
    this.bodies.drawSun(view, proj, cam.position, elapsed);
    this.bodies.drawEarth(view, proj, cam.position, elapsed);
    this.bodies.drawMoon(view, proj, cam.position, elapsed);
    this.markers.draw(view, proj, elapsed, false);
  };

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
