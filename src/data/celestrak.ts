// CelesTrak GP/TLE element sets -> SGP4 records. CelesTrak allows CORS (no proxy
// needed). https://celestrak.org/NORAD/documentation/gp-data-formats.php

import { twoline2satrec, type SatRec } from "satellite.js";
import { fetchText } from "./client";

export interface Sat {
  name: string;
  noradId: number;
  satrec: SatRec;
}

/** CelesTrak groups we surface as toggleable layers. */
export type CelestrakGroup = "starlink" | "gps-ops" | "active" | "stations";

const GP_URL = "https://celestrak.org/NORAD/elements/gp.php";

/** Parse 3-line TLE text ("name\nline1\nline2" repeated) into SGP4 records. */
export function parseTle(text: string): Sat[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const out: Sat[] = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i].trim();
    const l1 = lines[i + 1];
    const l2 = lines[i + 2];
    if (!l1.startsWith("1 ") || !l2.startsWith("2 ")) continue;
    try {
      const satrec = twoline2satrec(l1, l2);
      const noradId = parseInt(l1.slice(2, 7), 10);
      out.push({ name, noradId, satrec });
    } catch {
      /* skip malformed set */
    }
  }
  return out;
}

/** Fetch + parse a CelesTrak group. Cached for 3h (element sets update slowly). */
export async function fetchGroup(group: CelestrakGroup): Promise<Sat[]> {
  const url = `${GP_URL}?GROUP=${group}&FORMAT=tle`;
  const text = await fetchText(url, { ttl: 3 * 60 * 60 * 1000 });
  return parseTle(text);
}

export const ISS_NORAD = 25544;
