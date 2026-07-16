import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "./input";

/**
 * Input — self-contained text field.
 *
 * Handles its own label, error, helper text, adornments, password
 * show/hide toggle, size variants, and autoGrow (content-aware
 * width expansion). Aligned with Twenty's TextInput pattern.
 *
 * Compose with FormField for Select, Toggle, and other non-text
 * controls that need external label/error management.
 */
const meta: Meta<typeof Input> = {
  title: "UI/Inputs/Input",
  component: Input,
  tags: ["autodocs", "level:primitive"],
  argTypes: {
    disabled: { control: "boolean" },
    placeholder: { control: "text" },
    sizeVariant: { control: "select", options: ["sm", "md"] },
    autoGrow: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

// ── Basic variants ──────────────────────────────────────────────

export const Primary: Story = {
  args: { placeholder: "Search employees…", label: "Employee" },
};

export const WithHelper: Story = {
  args: {
    label: "Email",
    placeholder: "ahmed@alsabah.com",
    type: "email",
    helperText: "We'll never share your email.",
  },
};

export const WithError: Story = {
  args: {
    label: "Username",
    value: "bad",
    error: "Username must be at least 4 characters.",
    required: true,
  },
};

export const Disabled: Story = {
  args: {
    label: "Read-only",
    value: "Cannot edit",
    disabled: true,
  },
};

// ── Password ────────────────────────────────────────────────────

export const Password: Story = {
  name: "Password (with show/hide)",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ maxWidth: 320, padding: "var(--ao-spacing-4)" }}>
      <Input
        label="Password"
        type="password"
        placeholder="Enter your password"
        defaultValue="secret123"
      />
    </div>
  ),
};

// ── Size variants ───────────────────────────────────────────────

export const SizeVariants: Story = {
  name: "Size Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--ao-spacing-4)",
        padding: "var(--ao-spacing-4)",
        maxWidth: 320,
      }}
    >
      <Input label="Small (28px)" sizeVariant="sm" placeholder="sm size…" />
      <Input label="Medium (32px)" sizeVariant="md" placeholder="md size (default)…" />
    </div>
  ),
};

// ── autoGrow ────────────────────────────────────────────────────

export const AutoGrow: Story = {
  name: "autoGrow",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ maxWidth: 500, padding: "var(--ao-spacing-4)" }}>
      <p style={{ color: "var(--ao-font-color-tertiary)", fontSize: 12, marginBottom: 8 }}>
        Type to see the input grow with content (inline-edit pattern)
      </p>
      <Input
        label="Display Name"
        placeholder="Type something…"
        autoGrow
        defaultValue=""
      />
    </div>
  ),
};

// ── Context: inline form usage ──────────────────────────────────

export const ContextInlineForm: Story = {
  name: "Context: Inline Form (no FormField wrapper)",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--ao-spacing-4)",
        padding: "var(--ao-spacing-4)",
        maxWidth: 400,
      }}
    >
      <Input label="Name" placeholder="Device name" required />
      <Input label="Email" type="email" placeholder="admin@example.com" />
      <Input
        label="Password"
        type="password"
        placeholder="Enter password"
        helperText="At least 8 characters"
      />
    </div>
  ),
};
