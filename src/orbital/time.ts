// Simulation clock + date helpers shared by the timeline and propagation.

export function dateToJd(d: Date): number {
  return d.getTime() / 86400000 + 2440587.5;
}
export function jdToDate(jd: number): Date {
  return new Date((jd - 2440587.5) * 86400000);
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400000);
}

export function formatUTC(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 16) + "Z";
}

/** Days between two dates (b - a). */
export function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 86400000;
}

/** Drives the visible date window + a scrub cursor within it. */
export class SimClock {
  windowStart: Date;
  windowEnd: Date;
  /** Cursor position 0..1 within the window. */
  cursor = 0;

  constructor(windowStart: Date, windowEnd: Date) {
    this.windowStart = windowStart;
    this.windowEnd = windowEnd;
  }

  get spanDays(): number {
    return daysBetween(this.windowStart, this.windowEnd);
  }

  /** Current cursor date. */
  now(): Date {
    return new Date(
      this.windowStart.getTime() + this.cursor * (this.windowEnd.getTime() - this.windowStart.getTime()),
    );
  }
}
