import { motion } from "motion/react";

interface Props {
  distMaxLd: number;
  onDistMax: (v: number) => void;
  scanlines: boolean;
  onScanlines: (v: boolean) => void;
  onReset: () => void;
}

const DIST_OPTIONS = [5, 10, 20];

export function Controls({ distMaxLd, onDistMax, scanlines, onScanlines, onReset }: Props) {
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
          <div className="ctl-label">Miss-distance filter (LD)</div>
          <div className="seg">
            {DIST_OPTIONS.map((d) => (
              <button key={d} aria-pressed={distMaxLd === d} onClick={() => onDistMax(d)}>
                ≤{d}
              </button>
            ))}
          </div>
        </div>
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
