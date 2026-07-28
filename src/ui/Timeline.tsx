import { motion } from "motion/react";
import { addDays } from "../orbital/time";
import type { CloseApproach } from "../data/types";

interface Props {
  windowStart: Date;
  windowEnd: Date;
  spanDays: number;
  approaches: CloseApproach[];
  focus: number;
  focusDate: Date;
  nearFocus: number;
  live: boolean;
  onToggleLive: () => void;
  onFocus: (v: number) => void;
  onSpan: (days: number) => void;
  onShift: (days: number) => void;
}

const SPANS = [7, 30, 90];
const fmt = (d: Date) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;

export function Timeline(p: Props) {
  const span = p.windowEnd.getTime() - p.windowStart.getTime();
  const frac = (d: Date) => Math.max(0, Math.min(1, (d.getTime() - p.windowStart.getTime()) / span));

  const ticks = Array.from({ length: 7 }, (_, i) => {
    const t = i / 6;
    return { t, date: addDays(p.windowStart, t * p.spanDays) };
  });

  return (
    <motion.div
      className="panel timeline brackets"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, type: "spring", stiffness: 240, damping: 28 }}
    >
      <div className="panel-head">
        <span>Encounter Timeline{p.live && <span className="playing"> · ▶ LIVE</span>}</span>
        <span className="dim">{p.nearFocus} NEAR CURSOR · ±36H</span>
      </div>
      <div className="panel-body" style={{ paddingBottom: 8 }}>
        <div className="tl-track">
          <div className="tl-axis" />
          {ticks.map((tk, i) => (
            <div key={i} className="tl-tick" style={{ left: `${tk.t * 100}%` }}>
              <span>{fmt(tk.date)}</span>
            </div>
          ))}
          {p.approaches.map((a) => (
            <div
              key={a.id}
              className={`tl-dot ${a.hazardous ? "haz" : "safe"}`}
              style={{ left: `${frac(a.date) * 100}%` }}
              title={`${a.fullname} · ${a.distLd.toFixed(1)} LD`}
            />
          ))}
          <div className="tl-cursor" style={{ left: `${p.focus * 100}%` }} />
        </div>
        <input
          className="range-input"
          type="range"
          min={0}
          max={1000}
          value={Math.round(p.focus * 1000)}
          onChange={(e) => p.onFocus(Number(e.target.value) / 1000)}
          aria-label="Timeline cursor"
        />
        <div className="tl-controls">
          <div className="seg">
            <button aria-pressed={p.live} onClick={p.onToggleLive} title="Auto-advance from now">
              {p.live ? "⏸ PAUSE" : "▶ LIVE"}
            </button>
            <button onClick={() => p.onShift(-p.spanDays)}>◀ PREV</button>
            <button onClick={() => p.onShift(p.spanDays)}>NEXT ▶</button>
          </div>
          <div className="seg">
            {SPANS.map((s) => (
              <button key={s} aria-pressed={p.spanDays === s} onClick={() => p.onSpan(s)}>
                {s}D
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
