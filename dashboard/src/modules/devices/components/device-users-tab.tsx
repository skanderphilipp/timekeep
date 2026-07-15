import { useState, useMemo } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Badge, SearchInput, Section, Text } from "@/components/ui";
import { DataTableContainer } from "@/modules/data-renderer";
import { DataBoundary } from "@/modules/shared/components";
import type { ColumnDefinition, TextFieldMetadata } from "@/modules/data-renderer/types";
import { useSyncedDeviceUsers } from "../hooks/use-synced-device-users";
import type { SyncedUser } from "@/lib/api";

// ── Column definitions ──────────────────────────────────────────────────

function useColumns() {
  const { _ } = useLingui();

  return useMemo(
    (): ColumnDefinition[] => [
      {
        id: "pin",
        header: _(msg`PIN`),
        fieldId: "pin",
        label: _(msg`PIN`),
        type: "text",
        metadata: { fieldName: "pin", isSortable: false } as TextFieldMetadata,
        isVisible: true,
        width: "120px",
      },
      {
        id: "name",
        header: _(msg`Name`),
        fieldId: "name",
        label: _(msg`Name`),
        type: "text",
        metadata: { fieldName: "name", isSortable: false } as TextFieldMetadata,
        isVisible: true,
      },
      {
        id: "privilege",
        header: _(msg`Role`),
        fieldId: "privilege",
        label: _(msg`Role`),
        type: "text",
        metadata: { fieldName: "privilege", isSortable: false } as TextFieldMetadata,
        isVisible: true,
        width: "100px",
        /**
         * TODO(ENTERPRISE): Replace inline Badge with a dedicated
         * privilege FieldType and PrivilegeFieldDisplay.
         *
         * Phase: Device management polish
         * Impact: Inline render bypasses data-renderer type dispatch.
         * Fix: Add "privilege" FieldType with metadata (thresholds,
         *   labels, colors) and auto-dispatch rendering.
         */
        render: (row: unknown) => {
          const user = row as SyncedUser;
          return user.privilege >= 14 ? (
            <Badge variant="warning" size="sm">
              {_(msg`Admin`)}
            </Badge>
          ) : (
            <Badge variant="neutral" size="sm">
              {_(msg`User`)}
            </Badge>
          );
        },
      },
    ],
    [_],
  );
}

// ── Component ────────────────────────────────────────────────────────────

type DeviceUsersTabProps = {
  deviceSn: string;
};

/**
 * Device users tab — lists all users synced from the device into the local DB.
 *
 * Uses {@link DataTableContainer} (data-renderer) for consistent loading,
 * error, and empty state handling. Client-side search filters the synced
 * user list by PIN or name.
 */
export function DeviceUsersTab({ deviceSn }: DeviceUsersTabProps) {
  const { _ } = useLingui();
  const { data, isLoading, error, refetch } = useSyncedDeviceUsers(deviceSn);
  const [search, setSearch] = useState("");
  const columns = useColumns();

  // Client-side search filter
  const filtered = (data ?? []).filter(
    (u: SyncedUser) =>
      search.length === 0 ||
      u.pin?.includes(search) ||
      u.name?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <Section>
        <SearchInput
          placeholder={_(msg`Search users by name or PIN…`)}
          value={search}
          onChange={setSearch}
        />
      </Section>

      <Section>
        <DataBoundary
          data={isLoading ? undefined : filtered}
          isLoading={isLoading}
          error={error ?? null}
          onRetry={() => refetch()}
        >
          {() => (
            <DataTableContainer
              columns={columns}
              data={filtered}
              getRowKey={(u: SyncedUser) => u.pin}
              entityType="user"
              emptyState={
                <Text variant="body" color="tertiary" style={{ padding: "var(--ao-spacing-6)", textAlign: "center" }}>
                  {_(
                    msg`No users have been synced from this device yet. Users are synced automatically when the engine starts.`,
                  )}
                </Text>
              }
            />
          )}
        </DataBoundary>
      </Section>
    </>
  );
}
