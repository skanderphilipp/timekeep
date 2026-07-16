/**
 * modules/record-detail — Unified Record Detail View Module
 *
 * Replaces all duplicated per-entity detail view files with a single,
 * context-aware renderer that adapts to main panel or side panel layout
 * based on an `isInSidePanel` prop.
 *
 * Architecture: follow ADR-008
 *   timekeep/.notes/architecture/adr/008-record-detail-unification.md
 *
 * Twenty reference:
 *   twenty-front/src/modules/object-record/record-show/components/PageLayoutRecordPageRenderer.tsx
 *   twenty-front/src/modules/ui/layout/contexts/LayoutRenderingContext.tsx
 */

// ── Context ────────────────────────────────────────────────────────────────────
export {
  RecordDetailProvider,
  useRecordDetailContext,
} from "./states/record-detail-context";
export type { RecordDetailContextValue } from "./states/record-detail-context";

// ── Hooks ─────────────────────────────────────────────────────────────────────
export { useRecordDetail } from "./hooks/use-record-detail";
export { useRecordInlineEdit } from "./hooks/use-record-inline-edit";
export type { CellUpdate } from "./hooks/use-record-inline-edit";
export { useRecordNavigation } from "./hooks/use-record-navigation";

// ── Components ────────────────────────────────────────────────────────────────
export { RecordDetailRenderer } from "./components/record-detail-renderer";
export { RecordDetailShell, RecordDetailLoading, RecordDetailNotFound } from "./components/record-detail-shell";
export { RecordDetailHeader } from "./components/record-detail-header";
export { RecordDetailFields } from "./components/record-detail-fields";
export { RecordDetailStates } from "./components/record-detail-states";
export { RecordDetailActions } from "./components/record-detail-actions";

// ── Types ─────────────────────────────────────────────────────────────────────
export { DETAIL_VIEW_CONFIGS } from "./types";
export type {
  DetailFieldConfig,
  DetailSectionConfig,
  DetailTabConfig,
  KpiConfig,
  DetailViewConfig,
} from "./types";

// Re-export types used by consumers of the detail view config
export type {
  FieldType,
  FieldMetadata,
  TextFieldMetadata,
  NumberFieldMetadata,
  TimestampFieldMetadata,
  StatusFieldMetadata,
  EnumFieldMetadata,
  ReferenceFieldMetadata,
  ArrayFieldMetadata,
} from "@/modules/data-renderer";
