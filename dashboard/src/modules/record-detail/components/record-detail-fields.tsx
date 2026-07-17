import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { useCallback, type ReactNode } from "react";

import { DetailGrid, DetailItem, MetadataGrid, Separator, Text, Section, Tabs, Tab, TabPanel,InlineFieldEdit } from "@/components/ui";
import type { MetadataField } from "@/components/ui";
import type { EditableCellEditProps } from "@/components/ui";
import { FieldContext, type FieldContextValue } from "@/modules/data-renderer/contexts/field-context";
import { FieldDisplay } from "@/modules/data-renderer/field-displays";
import { FieldEdit } from "@/modules/data-renderer/field-inputs";
import type { ReferenceFieldMetadata } from "@/modules/data-renderer";
import { useRecordDetailContext } from "../states/record-detail-context";
import { useRecordInlineEdit } from "../hooks/use-record-inline-edit";
import { useRecordNavigation } from "../hooks/use-record-navigation";
import type { DetailFieldConfig, DetailSectionConfig, DetailViewConfig } from "../types";
import styles from "./record-detail.module.scss";

type RecordDetailFieldsProps = {
  record: Record<string, unknown>;
  config: DetailViewConfig;
  kpiData?: Record<string, unknown> | null;
  children?: ReactNode;
  /**
   * Custom React content keyed by tab key.
   * Rendered after each tab's declarative sections inside the `<TabPanel>`.
   *
   * Use this for complex tab content that can't be expressed as field configs
   * (forms, lists, charts, buttons).
   *
   * @example
   * tabChildren={{ config: <DeviceForm embedded onSaved={refresh} /> }}
   */
  tabChildren?: Record<string, ReactNode>;
};

const EM_DASH = "\u2014";

/**
 * Resolve a possibly dot-notation key path against a record.
 *
 * @example resolveFieldValue({ work_policy: { work_start: "09:00" } }, "work_policy.work_start") → "09:00"
 */
function resolveFieldValue(record: Record<string, unknown>, key: string): unknown {
  if (!key.includes(".")) {
    return record[key];
  }
  const parts = key.split(".");
  let current: unknown = record;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
export function RecordDetailFields({
  record,
  config,
  kpiData,
  children,
  tabChildren,
}: RecordDetailFieldsProps) {
  const { _ } = useLingui();
  const { entityType, entityId, isInSidePanel } = useRecordDetailContext();
  const editMutation = useRecordInlineEdit(entityType);
  const { navigateToEntity } = useRecordNavigation();

  const handlePersist = useCallback(
    (fieldId: string, value: unknown) => {
      editMutation.mutate({ rowId: entityId, field: fieldId, value });
    },
    [editMutation, entityId],
  );

  const handleNavigate = useCallback(
    (targetEntity: string, targetId: string, label?: string) => {
      navigateToEntity(targetEntity as Parameters<typeof navigateToEntity>[0], targetId, label ?? targetId);
    },
    [navigateToEntity],
  );

  const renderFieldValue = useCallback(
    (field: DetailFieldConfig) => {
      const rawValue = resolveFieldValue(record, field.fieldId) ?? "";

      let resolvedEntityId: string | undefined;
      let referenceIdField: string | undefined;
      let isLoadingOptions = false;
      if (field.type === "reference") {
        const meta = field.metadata as ReferenceFieldMetadata;
        const idRaw = resolveFieldValue(record, meta.referenceIdField);
        resolvedEntityId = idRaw ? String(idRaw) : undefined;
        referenceIdField = meta.referenceIdField;
        isLoadingOptions = field._isLoadingOptions ?? false;
      }
      const displayCtx: FieldContextValue = {
        fieldDefinition: { fieldId: field.fieldId, label: field.label, type: field.type, metadata: field.metadata },
        value: rawValue,
        viewMode: "display",
        entityId: resolvedEntityId,
        onNavigateToEntity: handleNavigate,
        isLoadingOptions,
      };

      const displayNode = (
        <FieldContext.Provider value={displayCtx}>
          <FieldDisplay />
        </FieldContext.Provider>
      );

  if (!field.editable) {
    return displayNode;
  }
      /**
       * For reference fields, edit mode initialises with the ID (not the display name)
       * so the Combobox/Select can match against its option values.
       *
       * Persistence also uses the `referenceIdField` so the backend receives
       * `{ department_id: "uuid" }` rather than `{ department: "Engineering" }`.
       */
      const editValue = referenceIdField
        ? (resolveFieldValue(record, referenceIdField) ?? "")
        : rawValue;

      const editCtx: FieldContextValue = { ...displayCtx, viewMode: "edit" };

      const editNode = (editProps: EditableCellEditProps<unknown>) => (
        <FieldContext.Provider value={editCtx}>
          <FieldEdit {...editProps} />
        </FieldContext.Provider>
      );

      const fieldInstanceId = `record-detail-${entityType}-${entityId}-${field.fieldId}`;

      return (
        <InlineFieldEdit<unknown>
          fieldId={fieldInstanceId}
          value={editValue}
          onPersist={(val) => handlePersist(referenceIdField ?? field.fieldId, val)}
          renderDisplay={({ onClick, displayRef }) => (
            <span
              ref={displayRef}
              onClick={onClick}
              style={{
        cursor: "pointer" ,
      }}
              tabIndex={0}
              role="button"
              aria-label={_(msg`Edit ${field.label}`)}
            >
              {displayNode}
            </span>
          )}
          renderEdit={editNode}
        />
      );
    },
    [entityType, entityId, record, handlePersist, handleNavigate, _],
  );

  // ── Shared section renderer (used by both flat and tab mode) ──────────

  const renderSections = useCallback(
    (sections: DetailSectionConfig[]) => {
      return sections.map((section, sectionIdx) => {
        const fields = section.fields.map((field) => ({
          key: field.fieldId,
          label: field.label,
          value: renderFieldValue(field),
        }));

        if (isInSidePanel) {
          return (
            <Section key={section.title} data-slot="record-detail-section">
              {sectionIdx > 0 && <Separator />}
              <Section data-slot="record-detail-section-header" className={styles.sectionTitle}>
                <Text variant="body" weight="medium">
                  {section.title}
                </Text>
              </Section>
              <DetailGrid>
                {fields.map((f) => (
                  <DetailItem key={f.key} label={f.label}>
                    {f.value}
                  </DetailItem>
                ))}
              </DetailGrid>
            </Section>
          );
        }
        return (
          <Section key={section.title} data-slot="record-detail-section">
            <Text
              variant="body"
              weight="medium"
              className={`${styles.sectionTitle} ${styles.sectionTitleMain}`}
            >
              {section.title}
            </Text>
            <MetadataGrid fields={fields as MetadataField[]} />
          </Section>
        );
      });
    },
    [isInSidePanel, renderFieldValue],
  );

  // ── KPI rendering (shared) ────────────────────────────────────────────

  const renderKpis = (kpiData_: Record<string, unknown> | null | undefined) => {
    if (!kpiData_ || !config.kpis || config.kpis.length === 0) return null;

    return (
      <Section data-slot="record-detail-kpi">
        {isInSidePanel && <Separator />}
        <Section data-slot="record-detail-kpi-header" className={styles.sectionTitle}>
          <Text variant="body" weight="medium">
            {_(msg`Summary`)}
          </Text>
        </Section>
        <DetailGrid>
          {config.kpis.map((kpi) => {
            const rawValue = kpiData_[kpi.key];
            const displayValue =
              typeof rawValue === "number"
                ? kpi.format
                  ? kpi.format(rawValue)
                  : String(rawValue)
                : EM_DASH;
            return (
              <DetailItem key={kpi.key} label={kpi.label}>
                <Text variant="body">{displayValue}</Text>
              </DetailItem>
            );
          })}
        </DetailGrid>
      </Section>
    );
  };

  // ── Tab mode ──────────────────────────────────────────────────────────

  if (config.tabs && config.tabs.length > 0) {
    const defaultTab = config.tabs[0].key;

    return (
      <Section data-slot="record-detail-fields">
        {renderKpis(kpiData)}

        <Tabs
          defaultValue={defaultTab}
          orientation={isInSidePanel ? "vertical" : "horizontal"}
          tabItems={config.tabs!.map((tabConfig) => (
            <Tab key={tabConfig.key} value={tabConfig.key}>
              {tabConfig.title}
            </Tab>
          ))}
          panelItems={config.tabs!.map((tabConfig) => (
            <TabPanel key={tabConfig.key} value={tabConfig.key}>
              {renderSections(tabConfig.sections)}
              {tabChildren?.[tabConfig.key]}
            </TabPanel>
          ))}
        >
          {/* Children placed inside Tabs as extra panels (legacy support) */}
          {children}
        </Tabs>
      </Section>
    );
  }
  // ── Flat mode (fallback) ──────────────────────────────────────────────

  return (
    <Section data-slot="record-detail-fields">
      {renderSections(config.sections ?? [])}

      {renderKpis(kpiData)}

      {children}
    </Section>
  );
}
