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

/** Days over which an object sweeps in toward Earth around its approach date. */
const APPROACH_WINDOW_DAYS = 5;

/**
 * 0..1 "incoming" intensity: 1 exactly at close approach, fading to 0 as the
 * cursor moves APPROACH_WINDOW_DAYS away in time.
 */
export function approachIntensity(ca: CloseApproach, cursor: Date): number {
  const days = Math.abs(ca.date.getTime() - cursor.getTime()) / 86400000;
  return Math.max(0, 1 - days / APPROACH_WINDOW_DAYS);
}

/** Unit bearing for an approach (stable per object). */
function bearing(ca: CloseApproach, out = vec3.create()): vec3 {
  const az = hash01(ca.des) * Math.PI * 2;
  const el = (hash01(ca.des + "^") - 0.5) * Math.PI * 0.7;
  const cosEl = Math.cos(el);
  return vec3.set(out, cosEl * Math.cos(az), Math.sin(el), cosEl * Math.sin(az));
}

/** World-space position for an approach, stable across frames (at closest). */
export function approximatePosition(ca: CloseApproach, out = vec3.create()): vec3 {
  bearing(ca, out);
  return vec3.scale(out, out, markerRadius(ca.distLd));
}

/**
 * Time-aware placement: the object sits at its miss-distance radius at closest
 * approach and is pushed outward as the cursor moves away in time, so scrubbing
 * the timeline sweeps objects inward toward Earth at their encounter moment.
 */
export function approximatePositionAt(ca: CloseApproach, cursor: Date, out = vec3.create()): vec3 {
  bearing(ca, out);
  const baseR = markerRadius(ca.distLd);
  const away = 1 - approachIntensity(ca, cursor); // 0 at CA, 1 far in time
  const r = baseR + away * away * SCENE.MARKER_SHELL * 0.9;
  return vec3.scale(out, out, r);
}
