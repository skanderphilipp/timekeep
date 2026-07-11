import type { Meta, StoryObj } from "@storybook/react";
import { Form } from "./form";
import { FormField } from "./form-field";
import { Input } from "../input";
import { Button } from "../button";

const meta: Meta<typeof Form> = {
  title: "UI/Forms/Form",
  component: Form,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Form>;

export const Primary: Story = {
  render: () => (
    <Form>
      <FormField label="Employee Name">
        <Input placeholder="Employee Name" />
      </FormField>
      <FormField label="PIN">
        <Input placeholder="PIN" />
      </FormField>
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
      <FormField label="Work Start">
        <Input defaultValue="08:00" />
      </FormField>
      <FormField label="Work End">
        <Input defaultValue="17:00" />
      </FormField>
      <FormField label="Grace Period (minutes)">
        <Input defaultValue="15" />
      </FormField>
      <div style={{ marginTop: 16 }}>
        <Button variant="primary">Save Settings</Button>
      </div>
    </Form>
  ),
};
