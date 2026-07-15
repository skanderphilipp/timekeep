import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { SidePanelFormContainer } from "@/infrastructure/side-panel/components/side-panel-form-container";
import { SidePanelSubPageRouter } from "@/infrastructure/side-panel/components/side-panel-sub-page-router";
import { DeviceRegisterScanStep } from "./device-register-scan-step";
import { DeviceRegisterConfigureStep } from "./device-register-configure-step";
import { DeviceRegisterTestStep } from "./device-register-test-step";

type DeviceRegisterWizardProps = {
  onClose: () => void;
};

/**
 * Device Registration Wizard — multi-step guided flow inside the side panel.
 *
 * Uses {@link SidePanelSubPageRouter} to manage the step stack:
 *   1. Scan — subnet input → network scan → select discovered device
 *   2. Configure — pre-filled device form (label, port, comm key)
 *   3. Test — provision device → connection test → done
 *
 * Cross-step data flows through Jotai atoms in
 * `infrastructure/state/atoms/wizard.ts`.
 */
export function DeviceRegisterWizard({ onClose }: DeviceRegisterWizardProps) {
  const { _ } = useLingui();

  return (
    <SidePanelFormContainer
      title={_(msg`Register Device`)}
      description={_(msg`Scan your network, configure, and provision a ZKTeco scanner.`)}
      onCancel={onClose}
      saveLabel={_(msg`Register`)}
    >
      <SidePanelSubPageRouter
        stepMap={{
          configure: DeviceRegisterConfigureStep,
          test: DeviceRegisterTestStep,
        }}
      >
        <DeviceRegisterScanStep onClose={onClose} />
      </SidePanelSubPageRouter>
    </SidePanelFormContainer>
  );
}

DeviceRegisterWizard.displayName = "DeviceRegisterWizard";
