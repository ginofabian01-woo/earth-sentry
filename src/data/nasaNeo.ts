// NASA NeoWs + APOD (DEMO_KEY). Used sparingly for flavor/enrichment; the JPL
// CAD/SBDB endpoints carry the primary load so we stay under the key's budget.
// https://api.nasa.gov/

import { fetchJson, NASA_KEY } from "./client";

const BASE = "https://api.nasa.gov";

export interface Apod {
  title: string;
  explanation: string;
  url: string;
  media_type: string;
  date: string;
}

export async function fetchApod(): Promise<Apod | null> {
  try {
    const url = `${BASE}/planetary/apod?api_key=${NASA_KEY}`;
    return await fetchJson<Apod>(url, { ttl: 6 * 60 * 60 * 1000 });
  } catch {
    return null;
  }
}

export interface NeoFeedStats {
  elementCount: number;
  hazardousCount: number;
}

/** Lightweight NeoWs feed summary (<=7-day span) for HUD counters. */
export async function fetchNeoFeedStats(start: string, end: string): Promise<NeoFeedStats | null> {
  try {
    const url = `${BASE}/neo/rest/v1/feed?start_date=${start}&end_date=${end}&api_key=${NASA_KEY}`;
    const raw = await fetchJson<{
      element_count: number;
      near_earth_objects: Record<string, { is_potentially_hazardous_asteroid: boolean }[]>;
    }>(url, { ttl: 60 * 60 * 1000 });
    let hazardous = 0;
    for (const day of Object.values(raw.near_earth_objects)) {
      for (const o of day) if (o.is_potentially_hazardous_asteroid) hazardous++;
    }
    return { elementCount: raw.element_count, hazardousCount: hazardous };
  } catch {
    return null;
  }
}
