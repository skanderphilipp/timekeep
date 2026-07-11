import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { DialogComponent } from "./dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form/form-field";

/**
 * Dialog — modal overlay for forms, confirmations, and detail views.
 *
 * Used for: create/edit device, add employee, punch correction,
 * API key creation, and delete confirmations.
 */
const meta: Meta<typeof DialogComponent> = {
  title: "UI/Overlays/Dialog",
  component: DialogComponent,
  tags: ["autodocs"],
  argTypes: {
    title: { control: "text" },
    description: { control: "text" },
    open: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof DialogComponent>;

export const Primary: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <div style={{ padding: 20 }}>
        <Button onClick={() => setOpen(true)}>Open Dialog</Button>
        <DialogComponent
          open={open}
          onOpenChange={setOpen}
          title="Create Item"
          description="Fill in the details below."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <FormField label="Name">
              <Input placeholder="Enter name…" />
            </FormField>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => setOpen(false)}>Save</Button>
            </div>
          </div>
        </DialogComponent>
      </div>
    );
  },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => {
    const [openSimple, setOpenSimple] = useState(false);
    const [openForm, setOpenForm] = useState(false);
    const [name, setName] = useState("");
    return (
      <div style={{ display: "flex", gap: "var(--ao-spacing-2)", padding: 20 }}>
        <Button onClick={() => setOpenSimple(true)}>Simple Dialog</Button>
        <Button onClick={() => setOpenForm(true)}>Form Dialog</Button>
        <DialogComponent open={openSimple} onOpenChange={setOpenSimple} title="Simple Dialog" description="This is a simple confirmation.">
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => setOpenSimple(false)}>Cancel</Button>
            <Button onClick={() => setOpenSimple(false)}>Confirm</Button>
          </div>
        </DialogComponent>
        <DialogComponent open={openForm} onOpenChange={setOpenForm} title="Edit Employee" description="Update employee details.">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <FormField label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Employee name…" />
            </FormField>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="secondary" onClick={() => setOpenForm(false)}>Cancel</Button>
              <Button onClick={() => setOpenForm(false)}>Save</Button>
            </div>
          </div>
        </DialogComponent>
      </div>
    );
  },
};

export const ContextPunchCorrection: Story = {
  name: "Context: Punch Correction",
  parameters: { controls: { disable: true } },
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <div style={{ padding: 20 }}>
        <Button onClick={() => setOpen(true)}>Correct Punch</Button>
        <DialogComponent
          open={open}
          onOpenChange={setOpen}
          title="Correct Punch Record"
          description="Manually override a punch record for HR purposes."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ fontSize: 14, color: "var(--ao-font-color-secondary)" }}>
              Employee: Omar Khalid (PIN 147)<br />
              Original: Check In at 09:02 (duplicate)
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="danger" onClick={() => setOpen(false)}>Mark as Corrected</Button>
            </div>
          </div>
        </DialogComponent>
      </div>
    );
  },
};
