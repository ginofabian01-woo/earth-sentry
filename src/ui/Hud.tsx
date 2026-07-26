import { motion } from "motion/react";

interface Props {
  loading: boolean;
  error: string | null;
  total: number;
  hazardCount: number;
}

export function Hud({ loading, error, total, hazardCount }: Props) {
  return (
    <motion.div
      className="panel title-panel brackets"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
    >
      <div className="panel-head">
        <span>EARTH SENTRY // OBJECT ENCOUNTER SYS</span>
        <span>{loading ? <span className="loading-dot">● LINK</span> : <span className="live">● LIVE</span>}</span>
      </div>
      <div className="panel-body">
        <h1>OBJECT ENCOUNTER MONITOR</h1>
        <div className="sub">SRC · JPL/CNEOS CAD + NASA NEOWS</div>
        <div className="stat-row">
          <div className="stat">
            <span className="n">{total}</span>
            <span className="l">TRACKED APPROACHES</span>
          </div>
          <div className="stat">
            <span className={`n${hazardCount ? " haz" : ""}`}>{hazardCount}</span>
            <span className="l">FLAGGED HAZARD</span>
          </div>
        </div>
        {error && <div className="err">⚠ FEED ERROR — {error}</div>}
      </div>
    </motion.div>
  );
}
