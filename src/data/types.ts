// Shared domain types for close approaches and orbital elements.

export interface CloseApproach {
  /** Primary designation, e.g. "2024 AB" or "99942 Apophis". */
  des: string;
  fullname: string;
  /** Close-approach epoch (UTC). */
  date: Date;
  /** Nominal miss distance in astronomical units. */
  distAu: number;
  /** Miss distance in lunar distances (1 LD = 0.00257 AU). */
  distLd: number;
  /** Relative velocity at approach, km/s. */
  velKmS: number;
  /** Absolute magnitude H (smaller = bigger/brighter). */
  h: number | null;
  /** Estimated diameter in meters (from H if not provided). */
  diameterM: number;
  /** Potentially hazardous flag (derived: dist < 0.05 AU and H <= 22). */
  hazardous: boolean;
  /** Stable id for picking/selection. */
  id: string;
}

/** Classical (osculating) orbital elements, angles in radians. */
export interface OrbitalElements {
  a: number; // semi-major axis (AU)
  e: number; // eccentricity
  i: number; // inclination
  om: number; // longitude of ascending node
  w: number; // argument of perihelion
  ma: number; // mean anomaly at epoch
  epochJd: number; // epoch (Julian date)
  periodDays: number; // orbital period
}

export interface ObjectDetail {
  des: string;
  name: string;
  neoWsId?: string;
  hazardous?: boolean;
  diameterMinM?: number;
  diameterMaxM?: number;
  elements?: OrbitalElements;
  source: "neows" | "sbdb" | "none";
}

export const AU_IN_LD = 1 / 0.00257; // ~389.17 LD per AU
export const AU_KM = 149_597_870.7;
export const EARTH_RADIUS_KM = 6371;
