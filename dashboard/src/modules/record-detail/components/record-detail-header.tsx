import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { useCallback } from "react";

import { Heading, Badge, Section,InlineFieldEdit } from "@/components/ui";
import { FieldContext, type FieldContextValue } from "@/modules/data-renderer/contexts/field-context";
import { FieldEdit } from "@/modules/data-renderer/field-inputs";
import type { TextFieldMetadata } from "@/modules/data-renderer";
import type { EditableCellEditProps } from "@/components/ui";
import { useRecordDetailContext } from "../states/record-detail-context";
import { useRecordInlineEdit } from "../hooks/use-record-inline-edit";
import type { DetailViewConfig } from "../types";
import styles from "./record-detail.module.scss";

type RecordDetailHeaderProps = {
  record: Record<string, unknown>;
  config: DetailViewConfig;
};

export function RecordDetailHeader({ record, config }: RecordDetailHeaderProps) {
  const { _ } = useLingui();
  const { entityType, entityId, isInSidePanel } = useRecordDetailContext();
  const editMutation = useRecordInlineEdit(entityType);

  const nameValue = String(record[config.nameField] ?? "");

  const handlePersist = useCallback(
    (value: unknown) => {
      editMutation.mutate({ rowId: entityId, field: config.nameField, value });
    },
    [editMutation, entityId, config.nameField],
  );

  // Synthesize a FieldContext for the name field so FieldEdit dispatches correctly
  const nameFieldId = `record-detail-${entityType}-${entityId}-${config.nameField}`;

  const editCtx: FieldContextValue = {
    fieldDefinition: {
      fieldId: config.nameField,
      label: config.nameField,
      type: "text",
      metadata: { fieldName: config.nameField } satisfies TextFieldMetadata,
    },
    value: nameValue,
    viewMode: "edit",
  };

  const renderNameEdit = useCallback(
    (props: EditableCellEditProps<string>) => (
      <FieldContext.Provider value={editCtx}>
        <FieldEdit {...props} />
      </FieldContext.Provider>
    ),
    [editCtx],
  );

  const isActive = record.active !== undefined
    ? Boolean(record.active)
    : record.status !== undefined
      ? String(record.status) === "active"
      : undefined;

  const headerClass = isInSidePanel
    ? `${styles.headerRow} ${styles.headerRowSidePanel}`
    : `${styles.headerRow} ${styles.headerRowMain}`;

  return (
    <Section data-slot="record-detail-header" className={headerClass}>
      <InlineFieldEdit<string>
        fieldId={nameFieldId}
        value={nameValue}
        onPersist={handlePersist}
        renderDisplay={({ value: v, onClick, displayRef }) => (
          <span
            ref={displayRef}
            onClick={onClick}
            style={{
        cursor: "pointer"
      }}
            tabIndex={0}
            role="button"
            aria-label={_(msg`Edit name`)}
          >
            <Heading level={isInSidePanel ? "h3" : "h2"}>{v}</Heading>
          </span>
        )}
        renderEdit={renderNameEdit}
      />

      {isActive !== undefined && (
        <Badge variant={isActive ? "success" : "neutral"} size="md">
          {isActive ? _(msg`Active`) : _(msg`Inactive`)}
        </Badge>
      )}
    </Section>
  );
}
