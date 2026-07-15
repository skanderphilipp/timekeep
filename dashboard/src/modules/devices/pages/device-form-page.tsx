import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Section } from "@/components/ui";
import { PageBar, PageLayout, PageBody } from "@/components/layout";
import { DeviceForm } from "../components/device-form";
import { useDeviceForm } from "../hooks/use-device-form";

export function DeviceFormPage() {
  const { _ } = useLingui();
  const { isEditing, deviceSn, form } = useDeviceForm();

  return (
    <PageLayout>
      <PageBar
        title={
          isEditing ? `${_(msg`Edit`)}: ${form.watch("label") || deviceSn}` : _(msg`Add Device`)
        }
        description={
          isEditing
            ? _(msg`Update scanner connection details.`)
            : _(msg`Register a new biometric scanner.`)
        }
      />

      <PageBody>
        <Section>
          <DeviceForm />
        </Section>
      </PageBody>
    </PageLayout>
  );
}
