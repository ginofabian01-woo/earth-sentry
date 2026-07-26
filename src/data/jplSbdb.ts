// JPL Small-Body Database (SBDB) API — keyless per-object detail + orbital
// elements. Primary source for the object inspector and Keplerian propagation.
// https://ssd-api.jpl.nasa.gov/doc/sbdb.html

import { fetchJson, JPL_BASE } from "./client";
import type { ObjectDetail, OrbitalElements } from "./types";

const SBDB_URL = `${JPL_BASE}/sbdb.api`;
const DEG = Math.PI / 180;

interface SbdbElement { name: string; value: string; units?: string }
interface SbdbResponse {
  object?: { fullname?: string; des?: string; neo?: boolean; pha?: boolean };
  orbit?: { epoch?: string; elements?: SbdbElement[] };
  phys_par?: { name: string; value: string }[];
}

export async function fetchObjectDetail(des: string): Promise<ObjectDetail> {
  const url = `${SBDB_URL}?${new URLSearchParams({ des, "full-prec": "true", "phys-par": "true" })}`;
  let raw: SbdbResponse;
  try {
    raw = await fetchJson<SbdbResponse>(url, { ttl: 6 * 60 * 60 * 1000 });
  } catch {
    return { des, name: des, source: "none" };
  }

  const elMap = new Map<string, number>();
  for (const el of raw.orbit?.elements ?? []) elMap.set(el.name, parseFloat(el.value));

  let elements: OrbitalElements | undefined;
  const a = elMap.get("a");
  const e = elMap.get("e");
  if (a != null && e != null) {
    elements = {
      a,
      e,
      i: (elMap.get("i") ?? 0) * DEG,
      om: (elMap.get("om") ?? 0) * DEG,
      w: (elMap.get("w") ?? 0) * DEG,
      ma: (elMap.get("ma") ?? 0) * DEG,
      epochJd: raw.orbit?.epoch ? parseFloat(raw.orbit.epoch) : 2451545.0,
      periodDays: elMap.get("per") ?? 365.25 * Math.pow(Math.abs(a), 1.5),
    };
  }

  const phys = new Map<string, number>();
  for (const p of raw.phys_par ?? []) phys.set(p.name, parseFloat(p.value));
  const diamKm = phys.get("diameter");

  return {
    des,
    name: raw.object?.fullname?.trim() || des,
    hazardous: raw.object?.pha ?? undefined,
    diameterMinM: diamKm != null ? diamKm * 1000 : undefined,
    diameterMaxM: diamKm != null ? diamKm * 1000 : undefined,
    elements,
    source: "sbdb",
  };
}
