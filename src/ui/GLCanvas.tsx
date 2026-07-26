import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Renderer } from "../gl/renderer";
import { Scene } from "../scene/Scene";
import type { CloseApproach } from "../data/types";

export interface GLCanvasHandle {
  resetView: () => void;
}

interface Props {
  approaches: CloseApproach[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

/**
 * Boundary between React and the imperative WebGL world. Constructs the
 * Renderer/Scene once, runs its own RAF loop, and receives prop updates via
 * refs so React re-renders never touch the hot path.
 */
export const GLCanvas = forwardRef<GLCanvasHandle, Props>(function GLCanvas(
  { approaches, selectedIndex, onSelect },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useImperativeHandle(ref, () => ({
    resetView() {
      const cam = rendererRef.current?.camera;
      if (cam) {
        cam.frame(9);
      }
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current!;
    let renderer: Renderer;
    try {
      renderer = new Renderer(canvas);
    } catch (err) {
      console.error("[nee] renderer init failed", err);
      return;
    }
    const scene = new Scene(renderer);
    rendererRef.current = renderer;
    sceneRef.current = scene;
    renderer.start(scene.render);

    let downX = 0, downY = 0;
    const onDown = (e: PointerEvent) => { downX = e.clientX; downY = e.clientY; };
    const onUp = (e: PointerEvent) => {
      // treat as a click only if the pointer barely moved (not a drag/orbit)
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
      const rect = canvas.getBoundingClientRect();
      const idx = scene.pickAt(e.clientX - rect.left, e.clientY - rect.top);
      onSelectRef.current(idx);
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);

    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setApproaches(approaches);
  }, [approaches]);

  useEffect(() => {
    sceneRef.current?.select(selectedIndex);
  }, [selectedIndex]);

  return <canvas id="scene" ref={canvasRef} />;
});
