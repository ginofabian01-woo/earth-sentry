import { AnimatePresence, motion } from "motion/react";
import type { SatSelection } from "./GLCanvas";
import { SAT_LAYERS } from "../scene/satellites";

interface Props {
  sat: SatSelection | null;
  onClose: () => void;
}

const layerLabel = (key: string) => SAT_LAYERS.find((l) => l.key === key)?.label ?? key.toUpperCase();

export function SatelliteInspector({ sat, onClose }: Props) {
  return (
    <AnimatePresence>
      {sat && (
        <motion.div
          key={sat.noradId}
          className="panel inspector brackets"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="panel-head">
            <span>Satellite Track</span>
            <button className="close-x" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <div className="panel-body">
            <div className="name">{sat.name}</div>
            <div className="des">NORAD · {sat.noradId}</div>

            <div className="sect-label">Telemetry · live</div>
            <div className="kv">
              <span className="k">ALTITUDE</span>
              <span className="v big">{sat.altitudeKm.toLocaleString(undefined, { maximumFractionDigits: 0 })} km</span>
            </div>
            <div className="kv">
              <span className="k">SPEED</span>
              <span className="v big">{sat.speedKmS.toFixed(2)} km/s</span>
            </div>
            <div className="kv">
              <span className="k">LAYER</span>
              <span className="v">{layerLabel(sat.layerKey)}</span>
            </div>
            <div className="kv">
              <span className="k">SOURCE</span>
              <span className="v">CELESTRAK · SGP4</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
