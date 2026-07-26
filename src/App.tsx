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
import type { CloseApproach, ObjectDetail, OrbitalElements } from "./data/types";
import type { SceneMode } from "./scene/Scene";
import { addDays, isoDate } from "./orbital/time";
import "./ui/hud.css";

export default function App() {
  const glRef = useRef<GLCanvasHandle>(null);

  const [windowStart, setWindowStart] = useState(() => new Date());
  const [spanDays, setSpanDays] = useState(30);
  const [distMaxLd, setDistMaxLd] = useState(20);
  const [scanlines, setScanlines] = useState(true);
  const [mode, setMode] = useState<SceneMode>("approx");
  const [realElements, setRealElements] = useState<(OrbitalElements | null)[]>([]);

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

  // load real orbital elements for in-window objects when heliocentric mode is on
  useEffect(() => {
    if (mode !== "real" || approaches.length === 0) {
      setRealElements([]);
      return;
    }
    let cancelled = false;
    const subset = approaches.slice(0, 24); // cap SBDB lookups
    Promise.all(
      subset.map((ca) => fetchObjectDetail(ca.des).then((d) => d.elements ?? null).catch(() => null)),
    ).then((els) => {
      if (cancelled) return;
      setRealElements(approaches.map((_, i) => (i < els.length ? els[i] : null)));
    });
    return () => {
      cancelled = true;
    };
  }, [mode, approaches]);

  const selected = approaches[selectedIndex] ?? null;
  const hazardCount = useMemo(() => approaches.filter((a) => a.hazardous).length, [approaches]);
  const nearFocus = useMemo(
    () => approaches.filter((a) => Math.abs(a.date.getTime() - focusDate.getTime()) < 36 * 3600 * 1000).length,
    [approaches, focusDate],
  );

  return (
    <>
      <GLCanvas
        ref={glRef}
        approaches={approaches}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        mode={mode}
        simDate={focusDate}
        realElements={realElements}
      />
      <Hud loading={loading} error={error} total={approaches.length} hazardCount={hazardCount} />
      <Legend />
      <Controls
        mode={mode}
        onMode={setMode}
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
