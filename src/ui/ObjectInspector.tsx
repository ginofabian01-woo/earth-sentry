import { useEffect, useRef } from "react";
import anime from "animejs";
import { AnimatePresence, motion } from "motion/react";
import { AU_KM, type CloseApproach, type ObjectDetail } from "../data/types";
import { formatUTC } from "../orbital/time";

interface Props {
  approach: CloseApproach | null;
  detail: ObjectDetail | null;
  loading: boolean;
  onClose: () => void;
}

/** Number that eases to its target value using anime.js. */
function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  useEffect(() => {
    const obj = { v: prev.current };
    const anim = anime({
      targets: obj,
      v: value,
      duration: 700,
      easing: "easeOutExpo",
      update: () => {
        if (ref.current) ref.current.textContent = obj.v.toFixed(decimals);
      },
    });
    prev.current = value;
    return () => anim.pause();
  }, [value, decimals]);
  return <span ref={ref}>{value.toFixed(decimals)}</span>;
}

const DEG = 180 / Math.PI;

export function ObjectInspector({ approach, detail, loading, onClose }: Props) {
  return (
    <AnimatePresence>
      {approach && (
        <motion.div
          key={approach.id}
          className="panel inspector brackets"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <div className="panel-head">
            <span>Object Dossier</span>
            <button className="close-x" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <div className="panel-body">
            <div className="name">{approach.fullname}</div>
            <div className="des">DES · {approach.des}</div>

            <div className="sect-label">Encounter</div>
            <Row k="CA EPOCH" v={formatUTC(approach.date)} />
            <div className="kv">
              <span className="k">MISS DIST</span>
              <span className="v big"><AnimatedNumber value={approach.distLd} decimals={2} /> LD</span>
            </div>
            <Row k="MISS DIST" v={`${(approach.distAu * AU_KM).toLocaleString(undefined, { maximumFractionDigits: 0 })} km`} />
            <div className="kv">
              <span className="k">REL VELOCITY</span>
              <span className="v big"><AnimatedNumber value={approach.velKmS} decimals={2} /> km/s</span>
            </div>
            <Row k="EST DIAMETER" v={`${approach.diameterM.toLocaleString(undefined, { maximumFractionDigits: 0 })} m`} />
            <Row k="ABS MAG H" v={approach.h != null ? approach.h.toFixed(1) : "—"} />
            <div className="kv">
              <span className="k">CLASSIFICATION</span>
              <span className={`v ${approach.hazardous ? "haz" : ""}`}>{approach.hazardous ? "⚠ HAZARDOUS" : "NOMINAL"}</span>
            </div>

            <div className="sect-label">Orbit {loading ? "· querying sbdb…" : detail?.elements ? "· sbdb" : ""}</div>
            {detail?.elements ? (
              <>
                <Row k="SEMI-MAJOR a" v={`${detail.elements.a.toFixed(3)} AU`} />
                <Row k="ECCENTRICITY e" v={detail.elements.e.toFixed(3)} />
                <Row k="INCLINATION i" v={`${(detail.elements.i * DEG).toFixed(2)}°`} />
                <Row k="PERIOD" v={`${detail.elements.periodDays.toFixed(0)} d`} />
              </>
            ) : (
              <div className="kv"><span className="dim">{loading ? "…" : "no elements available"}</span></div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="kv">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}
