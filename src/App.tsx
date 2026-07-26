import { useEffect, useMemo, useRef, useState } from "react";
import { GLCanvas, type GLCanvasHandle } from "./ui/GLCanvas";
import { Hud } from "./ui/Hud";
import { Timeline } from "./ui/Timeline";
import { Legend } from "./ui/Legend";
import { StatusBar } from "./ui/StatusBar";
import { Controls } from "./ui/Controls";
import { ObjectInspector } from "./ui/ObjectInspector";
import { fetchCloseApproaches } from "./data/jplCad";
import { fetchObjectDetail } from "./data/jplSbdb";
import type { CloseApproach, ObjectDetail } from "./data/types";
import { addDays, isoDate } from "./orbital/time";
import "./ui/hud.css";

export default function App() {
  const glRef = useRef<GLCanvasHandle>(null);

  const [windowStart, setWindowStart] = useState(() => new Date());
  const [spanDays, setSpanDays] = useState(30);
  const [distMaxLd, setDistMaxLd] = useState(20);
  const [scanlines, setScanlines] = useState(true);

  const [approaches, setApproaches] = useState<CloseApproach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [detail, setDetail] = useState<ObjectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [focus, setFocus] = useState(0); // 0..1 cursor across the window

  const windowEnd = useMemo(() => addDays(windowStart, spanDays), [windowStart, spanDays]);
  const focusDate = useMemo(
    () => new Date(windowStart.getTime() + focus * (windowEnd.getTime() - windowStart.getTime())),
    [windowStart, windowEnd, focus],
  );

  // fetch close approaches for the current window / distance filter
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchCloseApproaches({
      dateMin: isoDate(windowStart),
      dateMax: isoDate(windowEnd),
      distMaxLd,
    })
      .then((list) => {
        if (cancelled) return;
        setApproaches(list);
        setSelectedIndex(-1);
        setDetail(null);
      })
      .catch((e) => !cancelled && setError(String(e?.message ?? e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [windowStart, windowEnd, distMaxLd]);

  // fetch detail for the selected object
  useEffect(() => {
    const ca = approaches[selectedIndex];
    if (!ca) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    fetchObjectDetail(ca.des)
      .then((d) => !cancelled && setDetail(d))
      .finally(() => !cancelled && setDetailLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selectedIndex, approaches]);

  const selected = approaches[selectedIndex] ?? null;
  const hazardCount = useMemo(() => approaches.filter((a) => a.hazardous).length, [approaches]);
  const nearFocus = useMemo(
    () => approaches.filter((a) => Math.abs(a.date.getTime() - focusDate.getTime()) < 36 * 3600 * 1000).length,
    [approaches, focusDate],
  );

  return (
    <>
      <GLCanvas ref={glRef} approaches={approaches} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />
      <Hud loading={loading} error={error} total={approaches.length} hazardCount={hazardCount} />
      <Legend />
      <Controls
        distMaxLd={distMaxLd}
        onDistMax={setDistMaxLd}
        scanlines={scanlines}
        onScanlines={setScanlines}
        onReset={() => glRef.current?.resetView()}
      />
      <ObjectInspector approach={selected} detail={detail} loading={detailLoading} onClose={() => setSelectedIndex(-1)} />
      <Timeline
        windowStart={windowStart}
        windowEnd={windowEnd}
        spanDays={spanDays}
        approaches={approaches}
        focus={focus}
        focusDate={focusDate}
        nearFocus={nearFocus}
        onFocus={setFocus}
        onSpan={setSpanDays}
        onShift={(days) => setWindowStart((d) => addDays(d, days))}
      />
      <StatusBar total={approaches.length} distMaxLd={distMaxLd} focusDate={focusDate} loading={loading} />
      <div className="crt-overlay" data-scanlines={scanlines ? "on" : "off"} />
    </>
  );
}
