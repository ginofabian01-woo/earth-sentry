// v1 "approximate" placement: position each NEO around Earth (scene origin) by
// its miss distance and a deterministic bearing. Distances are log-compressed so
// both very close and far encounters stay visible in one frame.

import { vec3 } from "gl-matrix";
import type { CloseApproach } from "../data/types";
import { SCENE } from "../scene/scale";

/** Deterministic hash -> [0,1) so a given object always lands in one spot. */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** Log-compressed scene radius (in Earth radii units) for a miss distance. */
export function markerRadius(distLd: number): number {
  // 1 LD ~= 60.3 Earth radii. Compress with log so 0.2..20 LD maps into view.
  const ld = Math.max(0.05, distLd);
  const t = Math.log10(ld / 0.05) / Math.log10(20 / 0.05); // 0..1 across range
  return SCENE.EARTH_RADIUS * 2.2 + t * SCENE.MARKER_SHELL;
}

/** World-space position for an approach, stable across frames. */
export function approximatePosition(ca: CloseApproach, out = vec3.create()): vec3 {
  const r = markerRadius(ca.distLd);
  // bearing from a stable hash; inclination-ish spread from a second hash
  const az = hash01(ca.des) * Math.PI * 2;
  const el = (hash01(ca.des + "^") - 0.5) * Math.PI * 0.7;
  const cosEl = Math.cos(el);
  vec3.set(out, r * cosEl * Math.cos(az), r * Math.sin(el), r * cosEl * Math.sin(az));
  return out;
}
