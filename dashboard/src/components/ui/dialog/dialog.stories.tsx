import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { DialogComponent } from "./dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PermissionMultiSelect } from "@/components/ui/permission-multiselect";
import { FormField } from "@/components/ui/form/form-field";

const meta: Meta<typeof DialogComponent> = {
  title: "UI/Dialog",
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

export const Simple: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <div style={{ padding: 20 }}>
        <Button onClick={() => setOpen(true)}>Open Dialog</Button>
        <DialogComponent
          open={open}
          onOpenChange={setOpen}
          title="Simple Dialog"
          description="This is a simple dialog for demonstration."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p>Dialog content goes here.</p>
            <Button onClick={() => setOpen(false)}>Close</Button>
          </div>
        </DialogComponent>
      </div>
    );
  },
};

export const WithForm: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    return (
      <div style={{ padding: 20 }}>
        <Button onClick={() => setOpen(true)}>Open Form Dialog</Button>
        <DialogComponent
          open={open}
          onOpenChange={setOpen}
          title="Create Item"
          description="Fill in the details below."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <FormField label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter name…"
              />
            </FormField>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setOpen(false)}>Save</Button>
            </div>
          </div>
        </DialogComponent>
      </div>
    );
  },
};

export const WithPermissionMultiSelect: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    const [permissions, setPermissions] = useState<string[]>(["read:punches"]);
    const [name, setName] = useState("");
    return (
      <div style={{ padding: 20 }}>
        <Button onClick={() => setOpen(true)}>Open API Key Dialog</Button>
        <DialogComponent
          open={open}
          onOpenChange={setOpen}
          title="New API Key"
          description="Create a key for an integration partner."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <FormField label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Odoo Production Integration"
              />
            </FormField>
            <FormField
              label="Permissions"
              helperText="Scoped permissions for this API key."
            >
              <PermissionMultiSelect
                values={permissions}
                onChange={setPermissions}
                placeholder="Select permissions…"
              />
            </FormField>
            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setOpen(false)}>Create Key</Button>
            </div>
          </div>
        </DialogComponent>
      </div>
    );
  },
};
