import { useState } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import {
  Dialog,
  Form,
  FormField,
  FormActions,
  Button,
  Input,
  Checkbox,
  Text,
} from "@/components/ui";
import { useEnrollments } from "../hooks/use-enrollments";

type EnrollEmployeeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceSn: string;
};

const BIOMETRIC_OPTIONS = [
  { key: "fingerprint", label: "Fingerprint" },
  { key: "face", label: "Face" },
  { key: "card", label: "Card" },
  { key: "password", label: "Password" },
] as const;

/**
 * Enroll employee dialog — PIN input + biometric type checkboxes.
 *
 * Posts to `POST /api/devices/{sn}/enrollments` on confirm.
 * Handles loading, error display, and success close.
 */
export function EnrollEmployeeDialog({
  open,
  onOpenChange,
  deviceSn,
}: EnrollEmployeeDialogProps) {
  const { _ } = useLingui();
  const { enroll } = useEnrollments(deviceSn);

  const [pin, setPin] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["fingerprint"]);

  const toggleType = (key: string, checked: boolean) => {
    setSelectedTypes((prev) =>
      checked ? [...prev, key] : prev.filter((t) => t !== key),
    );
  };

  const handleSubmit = () => {
    if (!pin.trim()) return;
    enroll.mutate(
      { pin: pin.trim(), biometric_types: selectedTypes },
      {
        onSuccess: () => {
          setPin("");
          setSelectedTypes(["fingerprint"]);
          onOpenChange(false);
        },
      },
    );
  };

  const isValid = pin.trim().length > 0 && selectedTypes.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={_(msg`Enroll Employee`)}
      description={_(msg`Assign an employee PIN and biometric types to this device.`)}
    >
      <Form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <FormField label={_(msg`Employee PIN`)} required>
          <Input
            placeholder={_(msg`e.g. 145`)}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            fullWidth
            autoFocus
          />
        </FormField>

        <FormField label={_(msg`Biometric Types`)}>
          {BIOMETRIC_OPTIONS.map((opt) => (
            <Checkbox
              key={opt.key}
              label={_(msg`${opt.label}`)}
              checked={selectedTypes.includes(opt.key)}
              onCheckedChange={(checked) => toggleType(opt.key, checked)}
            />
          ))}
        </FormField>

        {enroll.error && (
          <Text variant="caption" color="danger">
            {_(msg`Enrollment failed. Check the PIN and try again.`)}
          </Text>
        )}

        <FormActions>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={enroll.isPending}>
            {_(msg`Cancel`)}
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={enroll.isPending} disabled={!isValid}>
            {_(msg`Enroll`)}
          </Button>
        </FormActions>
      </Form>
    </Dialog>
  );
}
