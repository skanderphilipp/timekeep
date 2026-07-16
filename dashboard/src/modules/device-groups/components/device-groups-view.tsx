import { useCallback, useMemo, useState } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconPlus } from "@tabler/icons-react";

import { Section, Button, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { DataListView } from "@/modules/data-renderer";
import type { ColumnDefinition, TextFieldMetadata, NumberFieldMetadata, TimestampFieldMetadata } from "@/modules/data-renderer";
import { useDeviceGroups } from "../hooks/use-device-groups";
import type { DeviceGroup } from "@/lib/api";
import { useRecordInlineEdit } from "@/modules/record-detail";
import { useOpenRecordInSidePanel, useOpenDetailPanel } from "@/infrastructure/side-panel/hooks/use-side-panel-navigation";

/** Fields that support inline editing in the device group list table. */
const EDITABLE_DEVICE_GROUP_FIELDS = new Set(["name"]);

/** Manually defined columns — device groups don't have a /schema endpoint yet. */
const DEVICE_GROUP_COLUMNS: ColumnDefinition[] = [
  {
    id: "name",
    fieldId: "name",
    header: "Name",
    label: "Name",
    type: "text",
    metadata: { fieldName: "name" } satisfies TextFieldMetadata,
  },
  {
    id: "device_count",
    fieldId: "device_count",
    header: "Devices",
    label: "Devices",
    type: "number",
    metadata: { fieldName: "device_count" } satisfies NumberFieldMetadata,
  },
  {
    id: "description",
    fieldId: "description",
    header: "Description",
    label: "Description",
    type: "text",
    metadata: { fieldName: "description" } satisfies TextFieldMetadata,
  },
  {
    id: "created_at",
    fieldId: "created_at",
    header: "Created",
    label: "Created",
    type: "timestamp",
    metadata: { fieldName: "created_at", format: "date-only" } satisfies TimestampFieldMetadata,
  },
];

/**
 * Device Groups list view — table with name, device count, description, created.
 *
 * Inline editing: name column is click-to-edit.
 * Row click opens the device group detail in the side panel.
 * Client-side search filters by name.
 *
 * Admin actions: Create (side-panel), Edit (side-panel on row click).
 */
export function DeviceGroupsView() {
  const { _ } = useLingui();
  const query = useDeviceGroups();
  const openDetailPanel = useOpenDetailPanel();
  const openRecord = useOpenRecordInSidePanel();

  // ── Search ─────────────────────────────────────────────────────────

  const [search, setSearch] = useState("");

  // ── Inline editing mutation ────────────────────────────────────────

  const editGroup = useRecordInlineEdit("device_group");

  // Mark editable columns
  const columns = useMemo(
    () =>
      DEVICE_GROUP_COLUMNS.map((col) => ({
        ...col,
        editable: EDITABLE_DEVICE_GROUP_FIELDS.has(col.fieldId),
      })),
    [],
  );

  const editingConfig = useMemo(
    () => ({
      onPersist: (rowId: string, field: string, value: unknown) => {
        editGroup.mutate({ rowId, field, value });
      },
      editableColumns: Array.from(EDITABLE_DEVICE_GROUP_FIELDS),
    }),
    [editGroup.mutate],
  );

  // ── Client-side filtering ──────────────────────────────────────────

  const rawData = query.data ?? [];
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rawData;
    return rawData.filter((g) => g.name.toLowerCase().includes(q));
  }, [rawData, search]);

  // ── Handlers ────────────────────────────────────────────────────────

  const handleAdd = useCallback(() => {
    openRecord({
      entityType: "device_group",
      title: _(msg`Add Device Group`),
      isNewRecord: true,
    });
  }, [openRecord, _]);

  const handleRowClick = useCallback((g: DeviceGroup) => {
    openDetailPanel("device_group", g.id, g.name);
  }, [openDetailPanel]);

  const hasActiveFilters = search.length > 0;

  return (
    <>
      <PageHeader
        title={_(msg`Device Groups`)}
        description={_(msg`Organize scanners for department-scoped sync.`)}
        actions={
          <Button size="sm" icon={<IconPlus size={16} />} onClick={handleAdd}>
            {_(msg`Add Group`)}
          </Button>
        }
      />

      <Section>
        <DataListView
          entity="device_group"
          columns={columns}
          data={filtered}
          getRowKey={(g: DeviceGroup) => g.id}
          isLoading={query.isLoading}
          error={query.error?.message ?? null}
          onRetry={() => query.refetch()}
          searchPlaceholder={_(msg`Search by name…`)}
          searchValue={search}
          onSearchChange={setSearch}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={() => setSearch("")}
          onRowClick={handleRowClick}
          editingConfig={editingConfig}
          resultCount={filtered.length}
          emptyState={
            hasActiveFilters ? (
              <EmptyState
                title={_(msg`No groups match`)}
                description={_(msg`Try adjusting your search.`)}
              />
            ) : (
              <EmptyState
                title={_(msg`No device groups`)}
                description={_(msg`Create your first device group to organize scanners.`)}
                action={
                  <Button icon={<IconPlus size={16} />} onClick={handleAdd}>
                    {_(msg`Add Group`)}
                  </Button>
                }
              />
            )
          }
        />
      </Section>
    </>
  );
}
