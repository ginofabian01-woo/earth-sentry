import { formatUTC } from "../orbital/time";
import { NASA_KEY } from "../data/client";

interface Props {
  total: number;
  distMaxLd: number;
  focusDate: Date;
  loading: boolean;
  live: boolean;
}

export function StatusBar({ total, distMaxLd, focusDate, loading, live }: Props) {
  return (
    <div className="panel statusbar">
      <span>
        <span className={loading ? "" : "live"}>◈</span> {loading ? "SYNCING" : "NOMINAL"}
      </span>
      <span className="sep">|</span>
      <span><span className="k">OBJECTS</span> <span className="v">{total}</span></span>
      <span className="sep">|</span>
      <span><span className="k">FILTER</span> <span className="v">≤{distMaxLd} LD</span></span>
      <span className="sep">|</span>
      <span>
        <span className="k">CURSOR</span> <span className="v">{formatUTC(focusDate)}</span>
        {live && <span className="live"> ▶</span>}
      </span>
      <span className="right">
        <span className="k">KEY</span> <span className="v">{NASA_KEY === "DEMO_KEY" ? "DEMO_KEY" : "PRIVATE"}</span>
      </span>
    </div>
  );
}
