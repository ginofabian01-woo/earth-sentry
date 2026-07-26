import { motion } from "motion/react";

export function Legend() {
  return (
    <motion.div
      className="panel legend brackets"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1, type: "spring", stiffness: 240, damping: 26 }}
    >
      <div className="panel-head"><span>Legend</span></div>
      <div className="panel-body">
        <div className="row"><span className="dot safe" /> NOMINAL PASS</div>
        <div className="row"><span className="dot haz" /> POTENTIALLY HAZARDOUS</div>
        <div className="row"><span className="dot safe" style={{ width: 14, height: 14 }} /> SIZE ∝ DIAMETER</div>
        <div className="row dim">RADIUS ∝ MISS DISTANCE (LOG)</div>
      </div>
    </motion.div>
  );
}
