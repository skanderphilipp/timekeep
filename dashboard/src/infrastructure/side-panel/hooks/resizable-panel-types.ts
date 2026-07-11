// Types + pure helpers for useResizablePanel.

// ── Types ───────────────────────────────────────────────────────────────────────

export interface ResizablePanelConstraints {
  min: number;
  max: number;
  default: number;
}

export type ResizablePanelSide = "left" | "right";

export interface UseResizablePanelOptions {
  side: ResizablePanelSide;
  constraints: ResizablePanelConstraints;
  currentWidth: number;
  onWidthChange: (width: number) => void;
  onCollapse: () => void;
  /** CSS variable name to set during drag (for live preview). */
  cssVariableName?: string;
  /** Called when actual resize begins (after threshold). */
  onResizeStart?: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

export function clampWidth(width: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, width));
}
