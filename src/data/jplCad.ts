// JPL SSD/CNEOS Close-Approach Data (CAD) API — primary feed. No key, no limit.
// https://ssd-api.jpl.nasa.gov/doc/cad.html

import { fetchJson, JPL_BASE } from "./client";
import { AU_IN_LD, type CloseApproach } from "./types";

interface CadResponse {
  signature: { source: string; version: string };
  count: string;
  fields: string[];
  data: string[][];
}

const CAD_URL = `${JPL_BASE}/cad.api`;

/** Julian date -> JS Date (UTC). */
export function jdToDate(jd: number): Date {
  return new Date((jd - 2440587.5) * 86400000);
}

/** Estimate diameter (meters) from absolute magnitude H, assuming albedo 0.14. */
export function diameterFromH(h: number, albedo = 0.14): number {
  const km = (1329 / Math.sqrt(albedo)) * Math.pow(10, -0.2 * h);
  return km * 1000;
}

export interface CadQuery {
  dateMin: string; // YYYY-MM-DD
  dateMax: string; // YYYY-MM-DD
  distMaxLd?: number; // default 20 lunar distances
  limit?: number;
}

export async function fetchCloseApproaches(q: CadQuery): Promise<CloseApproach[]> {
  const distMaxAu = (q.distMaxLd ?? 20) / AU_IN_LD;
  const params = new URLSearchParams({
    "date-min": q.dateMin,
    "date-max": q.dateMax,
    "dist-max": distMaxAu.toFixed(6),
    sort: "dist",
    fullname: "true",
    limit: String(q.limit ?? 500),
  });
  const url = `${CAD_URL}?${params.toString()}`;
  const raw = await fetchJson<CadResponse>(url, { ttl: 30 * 60 * 1000 });
  if (!raw.data) return [];

  const idx = (name: string) => raw.fields.indexOf(name);
  const iDes = idx("des");
  const iJd = idx("jd");
  const iDist = idx("dist");
  const iVel = idx("v_rel");
  const iH = idx("h");
  const iFull = idx("fullname");

  const out: CloseApproach[] = raw.data.map((row, n) => {
    const des = row[iDes];
    const distAu = parseFloat(row[iDist]);
    const h = iH >= 0 && row[iH] != null ? parseFloat(row[iH]) : null;
    const distLd = distAu * AU_IN_LD;
    const diameterM = h != null ? diameterFromH(h) : 30;
    return {
      des,
      fullname: (iFull >= 0 ? row[iFull] : des)?.trim() || des,
      date: jdToDate(parseFloat(row[iJd])),
      distAu,
      distLd,
      velKmS: parseFloat(row[iVel]),
      h,
      diameterM,
      hazardous: distAu < 0.05 && h != null && h <= 22,
      id: `${des}@${row[iJd]}#${n}`,
    };
  });
  return out;
}
