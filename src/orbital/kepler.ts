// Classical two-body (Keplerian) propagation. Heliocentric ecliptic frame.
// Used in Phase 2 for real orbit paths and object positions.

import { vec3 } from "gl-matrix";
import type { OrbitalElements } from "../data/types";
import { dateToJd } from "./time";

/** Solve Kepler's equation M = E - e·sinE for eccentric anomaly E (elliptic). */
export function solveKepler(M: number, e: number, tol = 1e-8, maxIter = 60): number {
  // normalize M to [-pi, pi]
  let m = M % (2 * Math.PI);
  if (m > Math.PI) m -= 2 * Math.PI;
  if (m < -Math.PI) m += 2 * Math.PI;
  let E = e < 0.8 ? m : Math.PI * Math.sign(m || 1);
  for (let i = 0; i < maxIter; i++) {
    const f = E - e * Math.sin(E) - m;
    const fp = 1 - e * Math.cos(E);
    const dE = f / fp;
    E -= dE;
    if (Math.abs(dE) < tol) break;
  }
  return E;
}

/**
 * Heliocentric ecliptic position (AU) for elements at a given date.
 * Returns coordinates in the ecliptic frame (x toward vernal equinox).
 */
export function elementsToPosition(el: OrbitalElements, date: Date, out = vec3.create()): vec3 {
  const jd = dateToJd(date);
  const n = (2 * Math.PI) / el.periodDays; // mean motion (rad/day)
  const M = el.ma + n * (jd - el.epochJd);
  const E = solveKepler(M, el.e);

  // position in orbital plane
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const xv = el.a * (cosE - el.e);
  const yv = el.a * (Math.sqrt(1 - el.e * el.e) * sinE);

  // rotate by argument of perihelion (w), inclination (i), node (om)
  const cosw = Math.cos(el.w), sinw = Math.sin(el.w);
  const cosom = Math.cos(el.om), sinom = Math.sin(el.om);
  const cosi = Math.cos(el.i), sini = Math.sin(el.i);

  const x = (cosw * cosom - sinw * sinom * cosi) * xv + (-sinw * cosom - cosw * sinom * cosi) * yv;
  const y = (cosw * sinom + sinw * cosom * cosi) * xv + (-sinw * sinom + cosw * cosom * cosi) * yv;
  const z = (sinw * sini) * xv + (cosw * sini) * yv;

  // map ecliptic (x,y,z) -> scene (y up): use x, z-up->y
  vec3.set(out, x, z, -y);
  return out;
}

/** Sample a full orbit as a closed line strip (heliocentric, AU, scene frame). */
export function sampleOrbit(el: OrbitalElements, segments = 256): Float32Array {
  const pts = new Float32Array((segments + 1) * 3);
  const cosw = Math.cos(el.w), sinw = Math.sin(el.w);
  const cosom = Math.cos(el.om), sinom = Math.sin(el.om);
  const cosi = Math.cos(el.i), sini = Math.sin(el.i);
  for (let s = 0; s <= segments; s++) {
    const E = (s / segments) * 2 * Math.PI;
    const xv = el.a * (Math.cos(E) - el.e);
    const yv = el.a * (Math.sqrt(1 - el.e * el.e) * Math.sin(E));
    const x = (cosw * cosom - sinw * sinom * cosi) * xv + (-sinw * cosom - cosw * sinom * cosi) * yv;
    const y = (cosw * sinom + sinw * cosom * cosi) * xv + (-sinw * sinom + cosw * cosom * cosi) * yv;
    const z = (sinw * sini) * xv + (cosw * sini) * yv;
    pts[s * 3] = x;
    pts[s * 3 + 1] = z;
    pts[s * 3 + 2] = -y;
  }
  return pts;
}
