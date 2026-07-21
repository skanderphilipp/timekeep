import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import {
  IconFingerprint,
  IconCheck,
  IconX,
  IconLoader,
  IconUsersPlus,
} from "@tabler/icons-react";

import { useEnrollmentSSE, type EnrollmentStatus } from "../hooks/use-enrollment-sse";
import { useEmployeeSync } from "../hooks/use-employee-sync";
import { Button } from "@/components/ui";
import styles from "./enrollment-wizard.module.scss";

type Props = {
  /** Device serial number to enroll on. */
  deviceSn: string;
  /** Employee PIN on the device. */
  employeePin: string;
  /** Employee display name for the UI. */
  employeeName: string;
  /** Employee ID for the Sync to Devices action. */
  employeeId: string;
  /** Called when the panel should close. */
  onClose: () => void;
};

/**
 * Side panel wizard for live fingerprint enrollment.
 *
 * Shows real-time progress via SSE: finger scores (sample 1-3),
 * enrollment completion, and a "Sync to Devices" button after success.
 *
 * HR is NOT blocked — the panel is dismissible. Progress continues
 * in the background and the panel can be re-opened.
 */
export function EnrollmentWizard({
  deviceSn,
  employeePin,
  employeeName,
  employeeId,
  onClose,
}: Props) {
  const { _ } = useLingui();
  const status = useEnrollmentSSE(deviceSn, employeePin, true);
  const syncToDevices = useEmployeeSync(employeeId);

  return (
    <div data-slot="enrollment-wizard" className={styles.wizard}>
      <h2 className={styles.title}>{_(msg`Enroll Fingerprint`)}</h2>

      {/* Employee & Device Info */}
      <div className={styles.info}>
        <div className={styles.infoRow}>
          <span className={styles.label}>{_(msg`Employee`)}</span>
          <span className={styles.value}>{employeeName}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>{_(msg`PIN`)}</span>
          <span className={styles.valuePin}>{employeePin}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>{_(msg`Device`)}</span>
          <span className={styles.value}>{deviceSn}</span>
        </div>
      </div>

      {/* Manual fallback instructions */}
      <p className={styles.hint}>
        {_(
          msg`If the automatic enrollment does not start, use PIN ${employeePin} to enroll manually on the device.`,
        )}
      </p>

      {/* Status Display */}
      <StatusDisplay status={status} />

      {/* Actions */}
      <div className={styles.actions}>
        {status.phase === "enrolled" && (
          <Button
            variant="primary"
            size="sm"
            icon={<IconUsersPlus size={16} />}
            onClick={() => syncToDevices.mutate()}
            loading={syncToDevices.isPending}
          >
            {_(msg`Sync to All Devices`)}
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={onClose}>
          {status.phase === "enrolled" ? _(msg`Done`) : _(msg`Close`)}
        </Button>
      </div>
    </div>
  );
}

/**
 * Renders the current enrollment status with appropriate visuals.
 */
function StatusDisplay({ status }: { status: EnrollmentStatus }) {
  const { _ } = useLingui();

  switch (status.phase) {
    case "connecting":
      return (
        <div data-slot="enrollment-status" className={styles.statusBox} data-status="connecting">
          <IconLoader size={24} className={styles.spinner} />
          <p>{_(msg`Connecting to device...`)}</p>
        </div>
      );

    case "waiting":
      return (
        <div data-slot="enrollment-status" className={styles.statusBox} data-status="waiting">
          <IconFingerprint size={32} className={styles.pulse} />
          <p className={styles.instruction}>
            {_(msg`Ask the employee to place their finger on the scanner.`)}
          </p>
          <div className={styles.samples}>
            {[1, 2, 3].map((n) => {
              const sample = status.samples.find((s) => s.sample === n);
              return (
                <div
                  key={n}
                  data-slot="enrollment-sample-dot"
                  className={styles.sampleDot}
                  data-state={
                    !sample
                      ? "pending"
                      : sample.status === "good"
                        ? "good"
                        : "retry"
                  }
                >
                  <span className={styles.sampleNum}>{n}</span>
                  {sample?.status === "good" && <IconCheck size={12} />}
                  {sample?.status === "retry" && <IconX size={12} />}
                </div>
              );
            })}
          </div>
        </div>
      );

    case "enrolled":
      return (
        <div data-slot="enrollment-status" className={styles.statusBox} data-status="enrolled">
          <IconCheck size={32} className={styles.successIcon} />
          <p className={styles.successText}>
            {_(msg`Fingerprint enrolled successfully!`)}
          </p>
          <p className={styles.templateInfo}>
            {_(msg`Template size`)}: {status.templateSize} {_(msg`bytes`)}
          </p>
          <p className={styles.syncHint}>
            {_(msg`Click "Sync to All Devices" to push this fingerprint to every device.`)}
          </p>
        </div>
      );

    case "failed":
      return (
        <div data-slot="enrollment-status" className={styles.statusBox} data-status="failed">
          <IconX size={32} className={styles.failIcon} />
          <p className={styles.failText}>{_(msg`Enrollment failed.`)}</p>
          <p className={styles.failReason}>{status.reason}</p>
        </div>
      );

    case "disconnected":
      return (
        <div data-slot="enrollment-status" className={styles.statusBox} data-status="disconnected">
          <IconX size={24} />
          <p>{_(msg`Connection lost. The enrollment may still be in progress.`)}</p>
        </div>
      );
  }
}
