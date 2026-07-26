// Mean orbital elements (J2000) for the inner planets, used to draw real orbit
// rings and propagate planet positions in heliocentric mode. Values are
// approximate mean elements — good enough for a visualizer, not an ephemeris.

import type { OrbitalElements } from "../data/types";

const DEG = Math.PI / 180;
const J2000 = 2451545.0;

export interface Planet {
  name: string;
  el: OrbitalElements;
  radiusUnits: number;
  colorA: [number, number, number];
  colorB: [number, number, number];
  ringColor: [number, number, number];
}

/** Build elements from a (AU), e, degrees, mean longitude L0 (deg), period (d). */
function pe(a: number, e: number, iDeg: number, omDeg: number, wDeg: number, L0: number, periodDays: number): OrbitalElements {
  const ma = (((L0 - wDeg - omDeg) % 360) + 360) % 360;
  return { a, e, i: iDeg * DEG, om: omDeg * DEG, w: wDeg * DEG, ma: ma * DEG, epochJd: J2000, periodDays };
}

export const PLANETS: Planet[] = [
  {
    name: "Mercury",
    el: pe(0.38710, 0.20563, 7.005, 48.331, 29.124, 252.251, 87.969),
    radiusUnits: 0.45,
    colorA: [0.45, 0.42, 0.4], colorB: [0.6, 0.57, 0.53], ringColor: [0.5, 0.48, 0.45],
  },
  {
    name: "Venus",
    el: pe(0.72333, 0.00677, 3.394, 76.680, 54.884, 181.979, 224.701),
    radiusUnits: 0.68,
    colorA: [0.72, 0.6, 0.38], colorB: [0.9, 0.8, 0.55], ringColor: [0.8, 0.68, 0.42],
  },
  {
    name: "Earth",
    el: pe(1.00000, 0.01671, 0.0, 0.0, 102.947, 100.464, 365.256),
    radiusUnits: 0.72,
    colorA: [0.12, 0.32, 0.6], colorB: [0.2, 0.45, 0.35], ringColor: [0.33, 1.0, 0.4],
  },
  {
    name: "Mars",
    el: pe(1.52371, 0.09339, 1.850, 49.558, 286.502, 355.433, 686.980),
    radiusUnits: 0.55,
    colorA: [0.6, 0.28, 0.16], colorB: [0.8, 0.4, 0.24], ringColor: [0.78, 0.35, 0.2],
  },
];

/** Index of Earth in PLANETS (used to draw the Moon / highlight). */
export const EARTH_INDEX = 2;
