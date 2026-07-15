import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Section } from "@/components/ui";
import { PageShell, PageBar } from "@/components/layout";
import { DeviceForm } from "../components/device-form";
import { useDeviceForm } from "../hooks/use-device-form";
import { IconDeviceDesktop } from "@tabler/icons-react";

export function DeviceFormPage() {
  const { _ } = useLingui();
  const { isEditing, deviceSn, form } = useDeviceForm();

  return (
    <PageShell
      header={
        <PageBar
          title={
            isEditing ? `${_(msg`Edit`)}: ${form.watch("label") || deviceSn}` : _(msg`Add Device`)
          }
          description={
            isEditing
              ? _(msg`Update scanner connection details.`)
              : _(msg`Register a new biometric scanner.`)
          }
          icon={IconDeviceDesktop}
        />
      }
    >
      <Section>
        <DeviceForm />
      </Section>
    </PageShell>
  );
}
