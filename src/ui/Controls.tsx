import { motion } from "motion/react";
import type { SceneMode } from "../scene/Scene";
import { SAT_LAYERS } from "../scene/satellites";

interface Props {
  mode: SceneMode;
  onMode: (m: SceneMode) => void;
  distMaxLd: number;
  onDistMax: (v: number) => void;
  scanlines: boolean;
  onScanlines: (v: boolean) => void;
  onReset: () => void;
  satEnabled: Record<string, boolean>;
  onToggleSat: (key: string) => void;
}

const DIST_OPTIONS = [5, 10, 20];

export function Controls({
  mode, onMode, distMaxLd, onDistMax, scanlines, onScanlines, onReset, satEnabled, onToggleSat,
}: Props) {
  return (
    <motion.div
      className="panel controls brackets"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05, type: "spring", stiffness: 260, damping: 26 }}
    >
      <div className="panel-head"><span>Console</span></div>
      <div className="panel-body">
        <div className="ctl-group">
          <div className="ctl-label">View mode</div>
          <div className="seg">
            <button aria-pressed={mode === "approx"} onClick={() => onMode("approx")}>GEOCENTRIC</button>
            <button aria-pressed={mode === "real"} onClick={() => onMode("real")}>HELIO ORBITS</button>
          </div>
        </div>
        <div className="ctl-group">
          <div className="ctl-label">Miss-distance filter (LD)</div>
          <div className="seg">
            {DIST_OPTIONS.map((d) => (
              <button key={d} aria-pressed={distMaxLd === d} onClick={() => onDistMax(d)}>
                ≤{d}
              </button>
            ))}
          </div>
        </div>
        {mode === "approx" && (
          <div className="ctl-group">
            <div className="ctl-label">Orbital traffic (geocentric)</div>
            {SAT_LAYERS.map((l) => (
              <div
                key={l.key}
                className="toggle sat-toggle"
                data-on={!!satEnabled[l.key]}
                onClick={() => onToggleSat(l.key)}
                role="button"
              >
                <span>
                  <i className="sat-swatch" style={{ background: `rgb(${l.style.color.map((c) => Math.round(c * 255)).join(",")})` }} />
                  {l.label}
                  <span
                    className="info"
                    tabIndex={0}
                    role="img"
                    aria-label={`${l.label}: ${l.hint}`}
                    data-hint={l.hint}
                    onClick={(e) => e.stopPropagation()}
                  >i</span>
                </span>
                <span className="sw"><i /></span>
              </div>
            ))}
          </div>
        )}
        <div className="ctl-group">
          <div className="ctl-label">Display</div>
          <div className="toggle" data-on={scanlines} onClick={() => onScanlines(!scanlines)} role="button">
            <span>SCANLINES</span>
            <span className="sw"><i /></span>
          </div>
        </div>
        <div className="ctl-group">
          <button className="btn" onClick={onReset}>⟲ RESET VIEW</button>
        </div>
      </div>
    </motion.div>
  );
}
