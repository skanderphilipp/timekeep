import { useEffect } from "react";

// ── Types ───────────────────────────────────────────────────────────────────────

export interface PointerEventData {
  x: number;
  y: number;
}

export type PointerEventListener = (data: PointerEventData) => void;

// ── Hook ────────────────────────────────────────────────────────────────────────

interface UseTrackPointerOptions {
  /** Only active when true — avoids unnecessary listeners. */
  shouldTrackPointer: boolean;
  onMouseMove: PointerEventListener;
  onMouseUp: PointerEventListener;
}

/**
 * Tracks mouse movement and release on `document` during drag/resize operations.
 *
 * Adds `mousemove` and `mouseup` listeners only when `shouldTrackPointer` is true,
 * and cleans up on unmount. This is a building block for drag, resize, and any
 * mouse-follow interaction.
 *
 * Ported from `useTrackPointer`.
 */
export function useTrackPointer({
  shouldTrackPointer,
  onMouseMove,
  onMouseUp,
}: UseTrackPointerOptions) {
  useEffect(() => {
    if (!shouldTrackPointer) return;

    const handleMouseMove = (e: MouseEvent) => {
      onMouseMove({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = (e: MouseEvent) => {
      onMouseUp({ x: e.clientX, y: e.clientY });
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [shouldTrackPointer, onMouseMove, onMouseUp]);
}
