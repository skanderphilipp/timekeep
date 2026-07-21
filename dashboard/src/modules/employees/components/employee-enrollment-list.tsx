import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import {
  IconDeviceDesktop,
  IconUsersGroup,
} from "@tabler/icons-react";

import { MetadataGrid, Text, type MetadataField } from "@/components/ui";
import type { DeviceEnrollmentStatus } from "@/lib/api/employees";

import styles from "./employee-enrollment-list.module.scss";

type EmployeeEnrollmentListProps = {
  enrollments: DeviceEnrollmentStatus[];
};

/**
 * Derive metadata fields for a single enrollment record.
 */
function enrollmentFields(
  enrollment: DeviceEnrollmentStatus,
  _: ReturnType<typeof useLingui>["_"],
): MetadataField[] {
  const bioLabels = enrollment.biometric_types
    .map((t) => {
      switch (t) {
        case "fingerprint":
          return _(msg`Fingerprint`);
        case "face":
          return _(msg`Face`);
        case "palm":
          return _(msg`Palm`);
        case "card":
          return _(msg`RF Card`);
        case "password":
          return _(msg`Password`);
        default:
          return t;
      }
    })
    .join(", ");

  const enrolledDate = new Date(enrollment.enrolled_at * 1000).toLocaleDateString();

  return [
    {
      key: "device",
      label: _(msg`Device`),
      value: enrollment.device_label || enrollment.device_sn,
    },
    {
      key: "group",
      label: _(msg`Group`),
      value: enrollment.group_name || "—",
    },
    {
      key: "biometrics",
      label: _(msg`Biometrics`),
      value: bioLabels || "—",
    },
    {
      key: "fingerprints",
      label: _(msg`Fingerprints`),
      value: enrollment.fingerprint_count > 0
        ? String(enrollment.fingerprint_count)
        : "—",
    },
    {
      key: "card",
      label: _(msg`Card`),
      value: enrollment.card_number || "—",
      hideIf: !enrollment.card_number,
    },
    {
      key: "enrolled",
      label: _(msg`Enrolled`),
      value: enrolledDate,
    },
  ];
}

/**
 * Device enrollment status list for an employee.
 *
 * Shows which devices the employee is registered on, with group
 * context and biometric data. Empty state prompts fingerprint enrollment.
 */
export function EmployeeEnrollmentList({ enrollments }: EmployeeEnrollmentListProps) {
  const { _ } = useLingui();

  if (enrollments.length === 0) {
    return (
      <section data-slot="enrollment-empty" className={styles.statusEmpty}>
        <IconDeviceDesktop size={24} />
        <Text variant="body" color="tertiary">
          {_(msg`Not enrolled on any device yet.`)}
        </Text>
        <Text variant="caption" color="tertiary" className={styles.statusHint}>
          {_(
            msg`Use the "Enroll Fingerprint" button to register this employee on a biometric device.`,
          )}
        </Text>
      </section>
    );
  }

  return (
    <section data-slot="enrollment-list" className={styles.enrollmentList}>
      {enrollments.map((enrollment) => (
        <section
          key={enrollment.device_sn}
          data-slot="enrollment-item"
          className={styles.enrollmentItem}
        >
          <section data-slot="enrollment-header" className={styles.enrollmentHeader}>
            <IconDeviceDesktop size={16} />
            <Text variant="body" weight="medium">
              {enrollment.device_label || enrollment.device_sn}
            </Text>
            {enrollment.group_name && (
              <>
                <IconUsersGroup size={14} />
                <Text variant="caption" color="tertiary" className={styles.groupLabel}>
                  {enrollment.group_name}
                </Text>
              </>
            )}
          </section>
          <MetadataGrid
            fields={enrollmentFields(enrollment, _).filter((f) => !f.hideIf)}
          />
        </section>
      ))}
    </section>
  );
}
