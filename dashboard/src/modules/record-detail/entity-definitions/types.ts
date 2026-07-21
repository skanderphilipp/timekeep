import type { EntityType } from "@/types/entities";
import type {
  FieldType,
  FieldMetadata,
} from "@/modules/data-renderer";
import type { Icon } from "@tabler/icons-react";

// ── Action System Types ────────────────────────────────────────────────────

/** Where an action button renders in the detail view layout. */
export type ActionPlacement = "header" | "footer" | "both";

/** Button variant for action buttons. */
type ActionVariant = "primary" | "secondary" | "ghost" | "danger";

/** A record-level action (edit, delete, sync, etc.) rendered in detail views. */
export type RecordAction = {
  /** Unique action identifier. */
  id: string;
  /** Display label (already translated). */
  label: string;
  /** Tabler icon component. */
  icon?: Icon;
  /** Where to render the action button. */
  placement: ActionPlacement;
  /** Button style variant. */
  variant?: ActionVariant;
  /** Async handler executed on click (after confirm dialog if `confirm` is set). */
  action: () => Promise<void>;
  /** Optional confirmation dialog before executing the action. */
  confirm?: {
    title: string;
    message: string;
  };
  /** If true, renders the button in destructive (red) style. */
  danger?: boolean;
  /** If true, shows a loading spinner on the button. */
  loading?: boolean;
  /** If true, the button is disabled. */
  disabled?: boolean;
};

// ── Detail View Config Types ─────────────────────────────────────────────

/**
 * A single field rendered in a detail view.
 *
 * Extends the generic `FieldDefinition` concept from data-renderer so that
 * `FieldDisplay` and `FieldEdit` can dispatch on `type` without the
 * detail view needing its own rendering logic for badges, timestamps,
 * navigation links, or type-specific inputs.
 *
 * Pattern: `RecordFieldList` wraps every field in `FieldContext`
 * and delegates rendering to `FieldDisplay` / `FieldInput`.
 */
export type DetailFieldConfig = {
  /** Key on the record object — also serves as {@link FieldDefinition.fieldId}. */
  fieldId: string;
  /** Human-readable label shown in the UI. */
  label: string;
  /** Generic field type for display/edit dispatch. */
  type: FieldType;
  /** Type-specific metadata (format, labels, colors, reference target, etc.). */
  metadata: FieldMetadata;
  /** Whether this field supports click-to-edit via InlineFieldEdit. */
  editable: boolean;
  /**
   * Temporary flag set by the renderer when preloaded options for a
   * reference/select field are still being fetched. Read by
   * `RecordDetailFields.renderFieldValue` and threaded into
   * `FieldContextValue.isLoadingOptions`.
   *
   * @internal — transient rendering concern, not persisted.
   */
  _isLoadingOptions?: boolean;
};

/** A named group of fields rendered together under a section heading. */
export type DetailSectionConfig = {
  title: string;
  fields: DetailFieldConfig[];
};

/**
 * A tab in the detail view — contains sections and optional custom content.
 *
 * When `tabs` is defined on the config, `RecordDetailFields` renders a
 * `<Tabs>` component with one `<TabPanel>` per entry. Each panel shows
 * the tab's optional toolbar (if `tabToolbar` is true and content is
 * provided via `tabToolbars`), then the tab's `sections`, then any custom
 * content passed via the renderer's `tabChildren` prop (keyed by `tab.key`).
 *
 * This replaces per-entity tab hacks with declarative configuration.
 * Complex tab content (forms, lists, charts) still uses the `tabChildren`
 * slot — field sections use the config.
 */
export type DetailTabConfig = {
  /** Internal key used as the tab's `value` and `tabChildren`/`tabToolbars` lookup key. */
  key: string;
  /** Display title for the tab (Lingui `_(msg\`...\`)`). */
  title: string;
  /** Optional Tabler icon name (e.g., "info-circle", "settings"). */
  icon?: string;
  /** Sections rendered inside this tab panel. Can be empty for custom-only tabs. */
  sections: DetailSectionConfig[];
  /**
   * Whether this tab reserves space for a toolbar area at the top.
   * When true, `RecordDetailFields` renders a standardized toolbar slot
   * (`<TabToolbar>`) before the tab's sections. The toolbar content is
   * provided by the page via the `tabToolbars` prop on `RecordDetailRenderer`.
   *
   * This enforces consistent toolbar placement and styling across all
   * entity detail views without per-page ad-hoc `<Section>` wrappers.
   */
  tabToolbar?: boolean;
};

/** KPI keys that appear as stat cards (main panel) or detail items (side panel). */
export type KpiConfig = {
  key: string;
  label: string;
  /** Function to format the raw value from the KPI record. */
  format?: (value: number) => string;
};

/** Complete detail view configuration for one entity type. */
export type DetailViewConfig = {
  /** Which field is the primary name (rendered as heading, inline editable). */
  nameField: string;
  /** Flat sections rendered below the header. Used for simple entities. */
  sections?: DetailSectionConfig[];
  /**
   * Tabbed sections. When defined, takes precedence over flat `sections`.
   * Each tab renders its own set of sections inside a `<TabPanel>`.
   */
  tabs?: DetailTabConfig[];
  /** KPI keys to render (optional). */
  kpis?: KpiConfig[];
};

// ── Entity Definition ────────────────────────────────────────────────────

/**
 * Context provided to action factories so they can create
 * fully-functional RecordAction objects with translated labels
 * and hook-backed callbacks (toast, navigation, query client).
 */
export type ActionFactoryContext = {
  entityId: string;
  /** Lingui translation function. Cast from Lingui's I18n._ signature. */
  _: (descriptor: { message?: string; id: string }) => string;
  /** Toast notification function. */
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
  };
  /** React Router navigate function. */
  navigate: (path: string) => void;
  /** TanStack Query client for cache invalidation. */
  invalidateQueries: (queryKey: readonly unknown[]) => void;
};

/**
 * Creates record-level actions for a specific entity.
 * Called inside a React hook so it has access to i18n, toast, navigation, etc.
 */
export type ActionFactory = (ctx: ActionFactoryContext) => RecordAction[];

/**
 * Single source of truth for an entity's detail view configuration,
 * data fetching, mutation, and actions.
 *
 * Now the single source of truth — three old registries have been eliminated:
 *   - DETAIL_VIEW_CONFIGS → inlined as detailConfig (✅ removed)
 *   - INLINE_EDIT_REGISTRY → replaced by updateById / listQueryKey / idField (✅ removed)
 *   - useRecordDetail switch → replaced by fetchById (✅ removed)
 *
 * Architecture: timekeep/.notes/architecture/record-detail-enterprise-plan.md
 */
export type EntityDefinition = {
  /** Which entity type this definition is for. */
  entityType: EntityType;

  /** Field layout, sections, tabs, KPIs. */
  detailConfig: DetailViewConfig;

  /** Fetch a single record by ID. Returns null when not found. */
  fetchById: (id: string) => Promise<Record<string, unknown> | null>;

  /**
   * Update a single field on an existing record.
   * Optional — entities without this are read-only in detail views.
   */
  updateById?: (
    id: string,
    field: string,
    value: unknown,
  ) => Promise<Record<string, unknown>>;

  /**
   * Create a new record from accumulated field data.
   * Optional — entities without this cannot be created via the detail view.
   */
  createFn?: (data: Record<string, unknown>) => Promise<Record<string, unknown>>;

  /**
   * Delete a record by ID.
   * Optional — entities without this have no delete action.
   */
  deleteFn?: (id: string) => Promise<void>;

  /** Query key for the list view (used for cache invalidation after mutations). */
  listQueryKey: () => readonly unknown[];

  /**
   * Primary key field name on row objects for optimistic cache matching.
   * Most entities use `"id"`; devices use `"serial_number"`.
   */
  idField: string;

  /**
   * Factory that creates record-level actions (sync, delete, copy ID, etc.)
   * with fully-translated labels and hook-backed callbacks.
   *
   * Called inside a React hook so it has access to i18n, toast,
   * navigation, and query client. Returns an empty array if the
   * entity has no actions.
   */
  actionFactory?: ActionFactory;
};
