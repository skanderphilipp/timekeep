import { useCallback, useMemo, useState } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconRefresh } from "@tabler/icons-react";

import { Button, Section, Text, Select } from "@/components/ui";
import { syncDeviceGroup, type DeviceGroup } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QueryKeys } from "@/lib/query-keys";
import { fetchDepartments } from "@/lib/api/departments";
import type { ComboboxOption } from "@/types/options";

/**
 * Sync section for a device group detail page.
 *
 * Allows syncing employees from a specific department (or all departments)
 * to all devices in this group.
 *
 * This is a domain-specific action component — it does NOT belong in the
 * declarative `DetailViewConfig`. It's injected via `tabChildren.sync`
 * on the `RecordDetailRenderer`.
 */
export function DeviceGroupSyncSection({ group }: { group: DeviceGroup }) {
  const { _ } = useLingui();
  const queryClient = useQueryClient();

  // ── Department options ──────────────────────────────────────────────

  const { data: departments } = useQuery({
    queryKey: ["departments", "options"] as const,
    queryFn: fetchDepartments,
    staleTime: 5 * 60 * 1000,
  });

  const departmentOptions: ComboboxOption[] = useMemo(() => {
    const opts: ComboboxOption[] = [{ value: "", label: _(msg`All Departments`) }];
    if (departments) {
      for (const d of departments) {
        opts.push({ value: d.name, label: d.name });
      }
    }
    return opts;
  }, [departments, _]);

  // ── State ───────────────────────────────────────────────────────────

  const [selectedDepartment, setSelectedDepartment] = useState("");

  // ── Sync mutation ───────────────────────────────────────────────────

  const sync = useMutation({
    mutationFn: () => syncDeviceGroup(group.id, selectedDepartment || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.deviceGroups.all });
    },
  });

  const handleSync = useCallback(() => {
    sync.mutate();
  }, [sync.mutate]);

  const deptLabel = selectedDepartment || _(msg`All Departments`);
  const deviceCount = group.device_count ?? 0;

  return (
    <Section>
      <Text variant="body" color="secondary">
        {_(msg`Sync employees to all devices in this group.`)}
      </Text>

      {/* Department filter */}
      <div style={{ marginTop: 12 }}>
        <Select
          label={_(msg`Department filter`)}
          value={selectedDepartment}
          onChange={setSelectedDepartment}
          options={departmentOptions}
        />
      </div>

      {/* Preview */}
      <div style={{ marginTop: 16, padding: 12, background: "var(--ao-surface-secondary)", borderRadius: 8 }}>
        <Text variant="body">
          {_(msg`Will sync employees from: {dept}`).replace("{dept}", deptLabel)}
        </Text>
        <Text variant="body">
          {_(msg`Target devices: {count}`).replace("{count}", String(deviceCount))}
        </Text>
      </div>

      {/* Sync button */}
      <div style={{ marginTop: 16 }}>
        <Button
          icon={<IconRefresh size={16} />}
          onClick={handleSync}
          disabled={sync.isPending || deviceCount === 0}
        >
          {sync.isPending ? _(msg`Syncing…`) : _(msg`Sync Now`)}
        </Button>
        {sync.isSuccess && (
          <Text variant="body" style={{ marginLeft: 12, color: "var(--ao-color-success)" }}>
            {_(msg`Sync complete`)}
          </Text>
        )}
        {sync.isError && (
          <Text variant="body" style={{ marginLeft: 12, color: "var(--ao-color-danger)" }}>
            {_(msg`Sync failed`)}
          </Text>
        )}
      </div>
    </Section>
  );
}
