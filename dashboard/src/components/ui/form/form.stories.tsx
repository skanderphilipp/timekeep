import type { Meta, StoryObj } from "@storybook/react";
import { Form } from "./form";
import { Input } from "../input";
import { Select } from "../select";
import { Button } from "../button";

const meta: Meta<typeof Form> = {
  title: "UI/Forms/Form",
  component: Form,
  tags: ["autodocs", "level:primitive"],
};

export default meta;
type Story = StoryObj<typeof Form>;

export const Primary: Story = {
  render: () => (
    <Form>
      <Input label="Employee Name" placeholder="Ahmed Al-Sabah" />
      <Input label="PIN" placeholder="1234" />
      <div style={{ marginTop: 16 }}>
        <Button variant="primary">Save</Button>
      </div>
    </Form>
  ),
};

export const ContextSettingsForm: Story = {
  name: "Context: Settings Form",
  parameters: { controls: { disable: true } },
  render: () => (
    <Form>
      <Input label="Work Start" type="time" defaultValue="08:00" />
      <Input label="Work End" type="time" defaultValue="17:00" />
      <Input label="Grace Period (minutes)" type="number" defaultValue="15" />
      <div style={{ marginTop: 16 }}>
        <Button variant="primary">Save Settings</Button>
      </div>
    </Form>
  ),
};

export const WithSelect: Story = {
  name: "Mixed: Input + Select (all self-contained)",
  parameters: { controls: { disable: true } },
  render: () => (
    <Form>
      <Input label="Device Name" placeholder="Front Door" required />
      <Select
        label="Device Type"
        required
        placeholder="Select type…"
        options={[]}
        value={undefined}
        onChange={() => {}}
      />
      <div style={{ marginTop: 16 }}>
        <Button variant="primary">Save</Button>
      </div>
    </Form>
  ),
};
