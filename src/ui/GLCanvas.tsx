import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Renderer } from "../gl/renderer";
import { Scene, type SceneMode, type PickResult, type ScreenLabel } from "../scene/Scene";
import { SCENE } from "../scene/scale";
import { SAT_LAYERS } from "../scene/satellites";
import type { CloseApproach, OrbitalElements } from "../data/types";
import type { Sat } from "../data/celestrak";

export type SatSelection = Extract<PickResult, { type: "sat" }>;

export interface GLCanvasHandle {
  resetView: () => void;
  clearSatSelection: () => void;
}

interface Props {
  approaches: CloseApproach[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onSelectSat: (sat: SatSelection | null) => void;
  mode: SceneMode;
  simDate: Date;
  realElements: (OrbitalElements | null)[];
  satData: Record<string, Sat[]>;
  satEnabled: Record<string, boolean>;
}

/**
 * Boundary between React and the imperative WebGL world. Constructs the
 * Renderer/Scene once, runs its own RAF loop, and receives prop updates via
 * refs so React re-renders never touch the hot path.
 */
export const GLCanvas = forwardRef<GLCanvasHandle, Props>(function GLCanvas(
  { approaches, selectedIndex, onSelect, onSelectSat, mode, simDate, realElements, satData, satEnabled },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onSelectSatRef = useRef(onSelectSat);
  onSelectSatRef.current = onSelectSat;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const framedFor = (m: SceneMode) => (m === "real" ? SCENE.HELIO_CAM_RADIUS : 9);

  useImperativeHandle(ref, () => ({
    resetView() {
      rendererRef.current?.camera.frame(framedFor(modeRef.current));
    },
    clearSatSelection() {
      sceneRef.current?.clearSelectedSat();
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current!;
    let renderer: Renderer;
    try {
      renderer = new Renderer(canvas);
    } catch (err) {
      console.error("[earth-sentry] renderer init failed", err);
      return;
    }
    const scene = new Scene(renderer);
    rendererRef.current = renderer;
    sceneRef.current = scene;

    // imperative label overlay — updated every frame without React re-renders
    scene.setOnLabels((labels: ScreenLabel[]) => {
      const host = labelsRef.current;
      if (!host) return;
      while (host.childElementCount < labels.length) {
        const el = document.createElement("div");
        el.className = "sat-label";
        el.innerHTML = '<span class="dot"></span><span class="txt"></span>';
        host.appendChild(el);
      }
      while (host.childElementCount > labels.length) host.removeChild(host.lastChild!);
      labels.forEach((l, i) => {
        const el = host.children[i] as HTMLElement;
        el.style.transform = `translate(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px)`;
        (el.firstElementChild as HTMLElement).style.background =
          `rgb(${l.color.map((c) => Math.round(c * 255)).join(",")})`;
        (el.lastElementChild as HTMLElement).textContent = l.name;
      });
    });

    renderer.start(scene.render);

    let downX = 0, downY = 0;
    const onDown = (e: PointerEvent) => { downX = e.clientX; downY = e.clientY; };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return; // ignore drags
      const rect = canvas.getBoundingClientRect();
      const res = scene.pickAt(e.clientX - rect.left, e.clientY - rect.top);
      if (res.type === "sat") {
        onSelectSatRef.current(res);
        onSelectRef.current(-1);
      } else if (res.type === "neo") {
        onSelectRef.current(res.index);
        onSelectSatRef.current(null);
      } else {
        onSelectRef.current(-1);
        onSelectSatRef.current(null);
      }
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);

    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      scene.setOnLabels(null);
      renderer.dispose(); // stops the RAF loop first
      scene.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setApproaches(approaches);
  }, [approaches]);

  useEffect(() => {
    sceneRef.current?.setRealElements(realElements);
  }, [realElements]);

  useEffect(() => {
    sceneRef.current?.setSimDate(simDate);
  }, [simDate]);

  useEffect(() => {
    sceneRef.current?.setMode(mode);
    rendererRef.current?.camera.frame(framedFor(mode));
  }, [mode]);

  useEffect(() => {
    sceneRef.current?.select(selectedIndex);
  }, [selectedIndex]);

  // push loaded satellite element sets into the scene
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    for (const layer of SAT_LAYERS) {
      const sats = satData[layer.key];
      if (sats) scene.setSatelliteLayer(layer.key, sats, layer.style, !!layer.trail);
    }
  }, [satData]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    for (const layer of SAT_LAYERS) scene.setSatelliteEnabled(layer.key, !!satEnabled[layer.key]);
  }, [satEnabled]);

  return (
    <>
      <canvas id="scene" ref={canvasRef} />
      <div className="sat-labels" ref={labelsRef} aria-hidden="true" />
    </>
  );
});
