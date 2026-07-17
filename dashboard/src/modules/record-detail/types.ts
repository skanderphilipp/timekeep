import type { EntityType } from "@/types/entities";
import type {
  FieldType,
  FieldMetadata,
  TextFieldMetadata,
  NumberFieldMetadata,
  TimestampFieldMetadata,
  StatusFieldMetadata,
  ReferenceFieldMetadata,
  ArrayFieldMetadata,
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
 * Pattern: Twenty's `RecordFieldList` wraps every field in `FieldContext`
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
 * the tab's `sections` followed by any custom content passed via the
 * renderer's `tabChildren` prop (keyed by `tab.key`).
 *
 * This replaces per-entity tab hacks (e.g., `DeviceDetailContent`) with
 * declarative configuration. Complex tab content (forms, lists, charts)
 * still uses the `tabChildren` slot — field sections use the config.
 */
export type DetailTabConfig = {
  /** Internal key used as the tab's `value` and `tabChildren` lookup key. */
  key: string;
  /** Display title for the tab (Lingui `_(msg\`...\`)`). */
  title: string;
  /** Optional Tabler icon name (e.g., "info-circle", "settings"). */
  icon?: string;
  /** Sections rendered inside this tab panel. Can be empty for custom-only tabs. */
  sections: DetailSectionConfig[];
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

// ── Registry ──────────────────────────────────────────────────────────────────

/**
 * Registry mapping entity types to their detail view configurations.
 *
 * To add a new entity detail view, add an entry here. No new components needed.
 * Complex entities (device with tabs/charts, punch with anomaly flags) can
 * pass custom children to the renderer for specialized sections.
 *
 * Each field now carries a `type` + `metadata` so `FieldDisplay` and `FieldEdit`
 * dispatch to the correct rendering without manual type-specific if/else chains.
 *
 * Nested field paths (dot notation) are supported via `resolveFieldValue`:
 *   `fieldId: "work_policy.work_start"` → accesses `record.work_policy?.work_start`
 */
export const DETAIL_VIEW_CONFIGS: Partial<Record<EntityType, DetailViewConfig>> = {
  employee: {
    nameField: "name",
    sections: [
      {
        title: "Identity",
        fields: [
          {
            fieldId: "pin",
            label: "PIN",
            type: "text",
            metadata: { fieldName: "pin" } satisfies TextFieldMetadata,
            editable: false,
          },
          {
            /**
             * Department reference — editable via Combobox.
             *
             * Display: shows department name as a clickable Tag.
             * Edit: selects from loaded departments, persists `department_id`.
             *
             * Options are auto-loaded in RecordDetailRendererInner and merged
             * into the metadata at render time.
             */
            fieldId: "department",
            label: "Department",
            type: "reference",
            metadata: {
              fieldName: "department",
              referenceEntity: "department",
              referenceIdField: "department_id",
              displayField: "department",
            } satisfies ReferenceFieldMetadata,
            editable: true,
          },
          {
            fieldId: "external_id",
            label: "External ID",
            type: "text",
            metadata: { fieldName: "external_id" } satisfies TextFieldMetadata,
            editable: true,
          },
          {
            fieldId: "active",
            label: "Status",
            type: "status",
            metadata: {
              fieldName: "active",
              labels: { true: "Active", false: "Inactive" },
              colors: { true: "green", false: "gray" },
            } satisfies StatusFieldMetadata,
            editable: true,
          },
          {
            fieldId: "created_at",
            label: "Created",
            type: "timestamp",
            metadata: {
              fieldName: "created_at",
              format: "date-only",
            } satisfies TimestampFieldMetadata,
            editable: false,
          },
        ],
      },
    ],
    kpis: [
      { key: "present_days", label: "Present Days", format: (v) => String(v) },
      { key: "avg_hours_per_day", label: "Avg Hours/Day", format: (v) => `${v.toFixed(1)}h` },
      { key: "late_days", label: "Late Days", format: (v) => String(v) },
      { key: "absent_days", label: "Absent Days", format: (v) => String(v) },
    ],
  },

  department: {
    nameField: "name",
    tabs: [
      {
        key: "details",
        title: "Details",
        sections: [
          {
            title: "Overview",
            fields: [
              {
                fieldId: "employee_count",
                label: "Employees",
                type: "number",
                metadata: { fieldName: "employee_count" } satisfies NumberFieldMetadata,
                editable: false,
              },
              {
                fieldId: "created_at",
                label: "Created",
                type: "timestamp",
                metadata: {
                  fieldName: "created_at",
                  format: "date-only",
                } satisfies TimestampFieldMetadata,
                editable: false,
              },
            ],
          },
        ],
      },
      {
        key: "policy",
        title: "Work Policy",
        sections: [
          {
            title: "Schedule",
            fields: [
              {
                fieldId: "work_policy.work_start",
                label: "Work Start",
                type: "text",
                metadata: { fieldName: "work_start", inputType: "time" } satisfies TextFieldMetadata,
                editable: true,
              },
              {
                fieldId: "work_policy.work_end",
                label: "Work End",
                type: "text",
                metadata: { fieldName: "work_end", inputType: "time" } satisfies TextFieldMetadata,
                editable: true,
              },
              {
                fieldId: "work_policy.late_threshold_minutes",
                label: "Late Threshold (min)",
                type: "number",
                metadata: { fieldName: "late_threshold_minutes" } satisfies NumberFieldMetadata,
                editable: true,
              },
              {
                fieldId: "work_policy.min_hours_for_full_day",
                label: "Min Hours / Full Day",
                type: "number",
                metadata: { fieldName: "min_hours_for_full_day" } satisfies NumberFieldMetadata,
                editable: true,
              },
              {
                fieldId: "work_policy.daily_overtime_after_hours",
                label: "Overtime After (h)",
                type: "number",
                metadata: { fieldName: "daily_overtime_after_hours" } satisfies NumberFieldMetadata,
                editable: true,
              },
              {
                /**
                 * Working days array — renders as day-of-week tags via positionLabels.
                 *
                 * Each index maps to a weekday name. The boolean value at that
                 * position controls the Tag color (green = working, gray = off).
                 *
                 * @example [true, true, true, true, true, false, false]
                 *   → Mon Tue Wed Thu Fri (Sat, Sun dimmed)
                 */
                fieldId: "work_policy.working_days",
                label: "Working Days",
                type: "array",
                metadata: {
                  fieldName: "working_days",
                  positionLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                } satisfies ArrayFieldMetadata,
                editable: false,
              },
            ],
          },
        ],
      },
    ],
  },


  work_policy: {
    nameField: "title",
    sections: [
      {
        title: "Schedule",
        fields: [
          {
            fieldId: "title",
            label: "Title",
            type: "text",
            metadata: { fieldName: "title" } satisfies TextFieldMetadata,
            editable: true,
          },
          {
            fieldId: "description",
            label: "Description",
            type: "text",
            metadata: { fieldName: "description" } satisfies TextFieldMetadata,
            editable: true,
          },
          {
            fieldId: "work_start",
            label: "Work Start",
            type: "text",
            metadata: { fieldName: "work_start", inputType: "time" } satisfies TextFieldMetadata,
            editable: true,
          },
          {
            fieldId: "work_end",
            label: "Work End",
            type: "text",
            metadata: { fieldName: "work_end", inputType: "time" } satisfies TextFieldMetadata,
            editable: true,
          },
          {
            fieldId: "late_threshold_minutes",
            label: "Late Threshold (min)",
            type: "number",
            metadata: { fieldName: "late_threshold_minutes" } satisfies NumberFieldMetadata,
            editable: true,
          },
          {
            fieldId: "min_hours_for_full_day",
            label: "Min Hours / Full Day",
            type: "number",
            metadata: { fieldName: "min_hours_for_full_day" } satisfies NumberFieldMetadata,
            editable: true,
          },
          {
            fieldId: "daily_overtime_after_hours",
            label: "Overtime After (h)",
            type: "number",
            metadata: { fieldName: "daily_overtime_after_hours" } satisfies NumberFieldMetadata,
            editable: true,
          },
          {
            fieldId: "working_days",
            label: "Working Days",
            type: "array",
            metadata: {
              fieldName: "working_days",
              positionLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            } satisfies ArrayFieldMetadata,
            editable: true,
          },
        ],
      },
    ],
  },

  device: {
    nameField: "label",
    tabs: [
      {
        key: "info",
        title: "Device Info",
        sections: [
          {
            title: "Connection",
            fields: [
              {
                fieldId: "host",
                label: "Host",
                type: "text",
                metadata: { fieldName: "host" } satisfies TextFieldMetadata,
                editable: true,
              },
              {
                fieldId: "port",
                label: "Port",
                type: "number",
                metadata: { fieldName: "port" } satisfies NumberFieldMetadata,
                editable: true,
              },
              {
                fieldId: "serial_number",
                label: "Serial Number",
                type: "text",
                metadata: { fieldName: "serial_number" } satisfies TextFieldMetadata,
                editable: false,
              },
              {
                fieldId: "vendor",
                label: "Vendor",
                type: "text",
                metadata: { fieldName: "vendor" } satisfies TextFieldMetadata,
                editable: true,
              },
              /**
               * Device group membership.
               *
               * `group_id` is optional — devices without a group show an em-dash.
               * The `device_group` entity provides the group name lookup.
               */
              {
                fieldId: "group_id",
                label: "Group",
                type: "reference",
                metadata: {
                  fieldName: "group_id",
                  referenceEntity: "device_group",
                  referenceIdField: "group_id",
                  displayField: "group_id",
                } satisfies ReferenceFieldMetadata,
                editable: false,
              },
              {
                fieldId: "push_enabled",
                label: "Push Enabled",
                type: "status",
                metadata: {
                  fieldName: "push_enabled",
                  labels: { true: "Yes", false: "No" },
                  colors: { true: "green", false: "gray" },
                } satisfies StatusFieldMetadata,
                editable: true,
              },
            ],
          },
          {
            title: "Hardware",
            fields: [
              {
                fieldId: "model",
                label: "Model",
                type: "text",
                metadata: { fieldName: "model" } satisfies TextFieldMetadata,
                editable: true,
              },
              {
                fieldId: "firmware_version",
                label: "Firmware",
                type: "text",
                metadata: { fieldName: "firmware_version" } satisfies TextFieldMetadata,
                editable: false,
              },
              {
                fieldId: "platform",
                label: "Platform",
                type: "text",
                metadata: { fieldName: "platform" } satisfies TextFieldMetadata,
                editable: false,
              },
              {
                fieldId: "mac_address",
                label: "MAC Address",
                type: "text",
                metadata: { fieldName: "mac_address" } satisfies TextFieldMetadata,
                editable: false,
              },
            ],
          },
          {
            title: "Status",
            fields: [
              {
                fieldId: "status",
                label: "Connection",
                type: "status",
                metadata: {
                  fieldName: "status",
                  labels: { online: "Online", offline: "Offline" },
                  colors: { online: "green", offline: "red" },
                } satisfies StatusFieldMetadata,
                editable: false,
              },
              {
                fieldId: "last_seen",
                label: "Last Seen",
                type: "timestamp",
                metadata: { fieldName: "last_seen" } satisfies TimestampFieldMetadata,
                editable: false,
              },
              {
                fieldId: "adms_active",
                label: "ADMS Active",
                type: "status",
                metadata: {
                  fieldName: "adms_active",
                  labels: { true: "Yes", false: "No" },
                  colors: { true: "green", false: "gray" },
                } satisfies StatusFieldMetadata,
                editable: false,
              },
              {
                fieldId: "sdk_poll_active",
                label: "SDK Poll",
                type: "status",
                metadata: {
                  fieldName: "sdk_poll_active",
                  labels: { true: "Active", false: "Inactive" },
                  colors: { true: "green", false: "gray" },
                } satisfies StatusFieldMetadata,
                editable: false,
              },
            ],
          },
          {
            title: "Capacity",
            fields: [
              {
                fieldId: "user_count",
                label: "Users",
                type: "text",
                metadata: { fieldName: "user_count" } satisfies TextFieldMetadata,
                editable: false,
              },
              {
                fieldId: "record_count",
                label: "Records",
                type: "text",
                metadata: { fieldName: "record_count" } satisfies TextFieldMetadata,
                editable: false,
              },
              {
                fieldId: "fingerprint_count",
                label: "Fingerprints",
                type: "text",
                metadata: { fieldName: "fingerprint_count" } satisfies TextFieldMetadata,
                editable: false,
              },
              {
                fieldId: "last_sync_at",
                label: "Last Sync",
                type: "timestamp",
                metadata: { fieldName: "last_sync_at" } satisfies TimestampFieldMetadata,
                editable: false,
              },
            ],
          },
        ],
      },
      {
        key: "config",
        title: "Config",
        sections: [],
      },
      {
        key: "users",
        title: "Users on Device",
        sections: [],
      },
    ],
  },

  punch: {
    nameField: "user_pin",
    sections: [
      {
        title: "Details",
        fields: [
          {
            /**
             * Employee reference — navigable FK.
             *
             * Uses `user_pin` as the FK because the backend `GET /api/employees/{id}`
             * supports both UUID and PIN lookups (tries UUID first, falls back to PIN).
             */
            fieldId: "employee_name",
            label: "Employee",
            type: "reference",
            metadata: {
              fieldName: "employee_name",
              referenceEntity: "employee",
              referenceIdField: "user_pin",
              displayField: "employee_name",
            } satisfies ReferenceFieldMetadata,
            editable: false,
          },
          {
            fieldId: "timestamp",
            label: "Time",
            type: "timestamp",
            metadata: { fieldName: "timestamp" } satisfies TimestampFieldMetadata,
            editable: false,
          },
          {
            fieldId: "status",
            label: "Status",
            type: "status",
            metadata: {
              fieldName: "status",
              labels: { check_in: "Check In", check_out: "Check Out" },
              colors: { check_in: "green", check_out: "blue" },
            } satisfies StatusFieldMetadata,
            editable: false,
          },
          {
            fieldId: "verify_mode",
            label: "Method",
            type: "text",
            metadata: { fieldName: "verify_mode" } satisfies TextFieldMetadata,
            editable: false,
          },
          {
            /**
             * Device reference — navigable FK.
             *
             * Uses `device_sn` as the FK (serial number). The backend
             * `GET /api/devices/{sn}` resolves by serial number directly.
             */
            fieldId: "device_label",
            label: "Device",
            type: "reference",
            metadata: {
              fieldName: "device_label",
              referenceEntity: "device",
              referenceIdField: "device_sn",
              displayField: "device_label",
            } satisfies ReferenceFieldMetadata,
            editable: false,
          },
          {
            fieldId: "work_code",
            label: "Work Code",
            type: "text",
            metadata: { fieldName: "work_code" } satisfies TextFieldMetadata,
            editable: false,
          },
        ],
      },
      {
        title: "Flags",
        fields: [
          {
            fieldId: "is_anomaly",
            label: "Status",
            type: "status",
            metadata: {
              fieldName: "is_anomaly",
              labels: { true: "Anomaly", false: "Normal" },
              colors: { true: "amber", false: "green" },
            } satisfies StatusFieldMetadata,
            editable: false,
          },
          {
            fieldId: "anomaly_type",
            label: "Type",
            type: "text",
            metadata: { fieldName: "anomaly_type" } satisfies TextFieldMetadata,
            editable: false,
          },
        ],
      },
    ],
  },

  user: {
    nameField: "username",
    sections: [
      {
        title: "Account",
        fields: [
          {
            fieldId: "display_name",
            label: "Display Name",
            type: "text",
            metadata: { fieldName: "display_name" } satisfies TextFieldMetadata,
            editable: true,
          },
          {
            fieldId: "role",
            label: "Role",
            type: "text",
            metadata: { fieldName: "role" } satisfies TextFieldMetadata,
            editable: true,
          },
          {
            fieldId: "active",
            label: "Status",
            type: "status",
            metadata: {
              fieldName: "active",
              labels: { true: "Active", false: "Inactive" },
              colors: { true: "green", false: "gray" },
            } satisfies StatusFieldMetadata,
            editable: true,
          },
          {
            fieldId: "created_at",
            label: "Created",
            type: "timestamp",
            metadata: {
              fieldName: "created_at",
              format: "date-only",
            } satisfies TimestampFieldMetadata,
            editable: false,
          },
          {
            fieldId: "updated_at",
            label: "Updated",
            type: "timestamp",
            metadata: {
              fieldName: "updated_at",
              format: "date-only",
            } satisfies TimestampFieldMetadata,
            editable: false,
          },
        ],
      },
    ],
  },

  api_key: {
    nameField: "name",
    sections: [
      {
        title: "Details",
        fields: [
          {
            fieldId: "prefix",
            label: "Key Prefix",
            type: "text",
            metadata: { fieldName: "prefix" } satisfies TextFieldMetadata,
            editable: false,
          },
          {
            fieldId: "revoked",
            label: "Status",
            type: "status",
            metadata: {
              fieldName: "revoked",
              labels: { true: "Revoked", false: "Active" },
              colors: { true: "red", false: "green" },
            } satisfies StatusFieldMetadata,
            editable: false,
          },
          {
            fieldId: "permissions",
            label: "Permissions",
            type: "text",
            metadata: { fieldName: "permissions" } satisfies TextFieldMetadata,
            editable: false,
          },
          {
            fieldId: "created_by",
            label: "Created By",
            type: "text",
            metadata: { fieldName: "created_by" } satisfies TextFieldMetadata,
            editable: false,
          },
          {
            fieldId: "created_at",
            label: "Created",
            type: "timestamp",
            metadata: {
              fieldName: "created_at",
              format: "date-only",
            } satisfies TimestampFieldMetadata,
            editable: false,
          },
          {
            fieldId: "expires_at",
            label: "Expires",
            type: "timestamp",
            metadata: {
              fieldName: "expires_at",
              format: "date-only",
            } satisfies TimestampFieldMetadata,
            editable: false,
          },
          {
            fieldId: "last_used_at",
            label: "Last Used",
            type: "timestamp",
            metadata: {
              fieldName: "last_used_at",
              format: "date-only",
            } satisfies TimestampFieldMetadata,
            editable: false,
          },
        ],
      },
    ],
  },

  audit: {
    nameField: "action",
    sections: [
      {
        title: "Event",
        fields: [
          {
            fieldId: "actor",
            label: "Actor",
            type: "text",
            metadata: { fieldName: "actor" } satisfies TextFieldMetadata,
            editable: false,
          },
          {
            fieldId: "action",
            label: "Action",
            type: "text",
            metadata: { fieldName: "action" } satisfies TextFieldMetadata,
            editable: false,
          },
          {
            fieldId: "resource",
            label: "Resource",
            type: "text",
            metadata: { fieldName: "resource" } satisfies TextFieldMetadata,
            editable: false,
          },
          {
            fieldId: "timestamp",
            label: "Timestamp",
            type: "timestamp",
            metadata: { fieldName: "timestamp" } satisfies TimestampFieldMetadata,
            editable: false,
          },
          {
            fieldId: "status",
            label: "Status",
            type: "status",
            metadata: {
              fieldName: "status",
              labels: { success: "Success", failed: "Failed" },
              colors: { success: "green", failed: "red" },
            } satisfies StatusFieldMetadata,
            editable: false,
          },
        ],
      },
    ],
  },

  device_group: {
    nameField: "name",
    tabs: [
      {
        key: "details",
        title: "Details",
        icon: "info-circle",
        sections: [
          {
            title: "Info",
            fields: [
              {
                fieldId: "device_count",
                label: "Devices",
                type: "number",
                metadata: { fieldName: "device_count" } satisfies NumberFieldMetadata,
                editable: false,
              },
              {
                fieldId: "department_ids",
                label: "Departments",
                type: "array",
                metadata: {
                  fieldName: "department_ids",
                } satisfies ArrayFieldMetadata,
                editable: true,
              },
              {
                fieldId: "description",
                label: "Description",
                type: "text",
                metadata: { fieldName: "description" } satisfies TextFieldMetadata,
                editable: true,
              },
              {
                fieldId: "created_at",
                label: "Created",
                type: "timestamp",
                metadata: {
                  fieldName: "created_at",
                  format: "date-only",
                } satisfies TimestampFieldMetadata,
                editable: false,
              },
              {
                fieldId: "updated_at",
                label: "Updated",
                type: "timestamp",
                metadata: {
                  fieldName: "updated_at",
                  format: "date-only",
                } satisfies TimestampFieldMetadata,
                editable: false,
              },
            ],
          },
        ],
      },
      {
        key: "devices",
        title: "Devices",
        icon: "devices",
        sections: [],
      },
      {
        key: "sync",
        title: "Sync",
        icon: "refresh",
        sections: [],
      },
    ],
  },

  endpoint: {
    nameField: "name",
    sections: [
      {
        title: "Configuration",
        fields: [
          {
            fieldId: "kind",
            label: "Type",
            type: "text",
            metadata: { fieldName: "kind" } satisfies TextFieldMetadata,
            editable: false,
          },
          {
            fieldId: "enabled",
            label: "Status",
            type: "status",
            metadata: {
              fieldName: "enabled",
              labels: { true: "Enabled", false: "Disabled" },
              colors: { true: "green", false: "gray" },
            } satisfies StatusFieldMetadata,
            editable: false,
          },
          {
            fieldId: "created_at",
            label: "Created",
            type: "timestamp",
            metadata: {
              fieldName: "created_at",
              format: "date-only",
            } satisfies TimestampFieldMetadata,
            editable: false,
          },
          {
            fieldId: "updated_at",
            label: "Updated",
            type: "timestamp",
            metadata: {
              fieldName: "updated_at",
              format: "date-only",
            } satisfies TimestampFieldMetadata,
            editable: false,
          },
        ],
      },
    ],
  },
};
