import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import {
  IconLayoutGrid,
  IconCalendarEvent,
  IconTimeline,
  IconTable,
  IconList,
} from "@tabler/icons-react";

import { ToggleGroup, Toggle } from "./toggle-group";

/**
 * ToggleGroup — a segmented button group for view switchers, filters, toolbars.
 *
 * Built on @base-ui/react/toggle-group. Keyboard navigable (arrow keys, Home/End),
 * roving tabindex, proper ARIA roles. Use with `<Toggle>` children.
 *
 * ### Usage
 * ```tsx
 * <ToggleGroup value={[viewType]} onValueChange={([v]) => setViewType(v)}>
 *   <Toggle value="table">Table</Toggle>
 *   <Toggle value="calendar">Calendar</Toggle>
 * </ToggleGroup>
 * ```
 */
const meta: Meta<typeof ToggleGroup> = {
  title: "UI/Navigation/ToggleGroup",
  component: ToggleGroup,
  tags: ["autodocs"],
  argTypes: {
    multiple: { control: "boolean" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof ToggleGroup>;

// ── Stories ─────────────────────────────────────────────────────────────────────

export const Primary: Story = {
  args: {
    value: ["table"],
    onValueChange: fn(),
  },
  render: (args) => (
    <ToggleGroup {...args}>
      <Toggle value="table">Table</Toggle>
      <Toggle value="calendar">Calendar</Toggle>
      <Toggle value="timeline">Timeline</Toggle>
    </ToggleGroup>
  ),
};

export const WithIcons: Story = {
  name: "With Icons",
  parameters: { controls: { disable: true } },
  render: function WithIconsStory() {
    const [view, setView] = useState<string[]>(["grid"]);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-4)" }}>
        <p style={{ fontSize: "var(--ao-font-size-sm)", color: "var(--ao-font-color-secondary)" }}>
          Active: {view[0]}
        </p>
        <ToggleGroup value={view} onValueChange={setView}>
          <Toggle value="grid" icon={<IconLayoutGrid size={14} />}>
            Grid
          </Toggle>
          <Toggle value="list" icon={<IconList size={14} />}>
            List
          </Toggle>
          <Toggle value="calendar" icon={<IconCalendarEvent size={14} />}>
            Calendar
          </Toggle>
        </ToggleGroup>
      </div>
    );
  },
};

export const ViewSwitcher: Story = {
  name: "Context: View Switcher",
  parameters: { controls: { disable: true } },
  render: function ViewSwitcherStory() {
    const [viewType, setViewType] = useState<string[]>(["table"]);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-4)" }}>
        <p style={{ fontSize: "var(--ao-font-size-sm)", color: "var(--ao-font-color-secondary)" }}>
          Current view: <strong>{viewType[0]}</strong>
        </p>
        <ToggleGroup value={viewType} onValueChange={setViewType}>
          <Toggle value="table" icon={<IconTable size={14} />}>
            Table
          </Toggle>
          <Toggle value="calendar" icon={<IconCalendarEvent size={14} />}>
            Calendar
          </Toggle>
          <Toggle value="timeline" icon={<IconTimeline size={14} />}>
            Timeline
          </Toggle>
        </ToggleGroup>
        <div
          style={{
            padding: "var(--ao-spacing-6)",
            background: "var(--ao-background-secondary)",
            borderRadius: "var(--ao-radius-md)",
            textAlign: "center",
            color: "var(--ao-font-color-tertiary)",
            fontSize: "var(--ao-font-size-sm)",
          }}
        >
          Content area for the <strong>{viewType[0]}</strong> view
        </div>
      </div>
    );
  },
};

export const Multiple: Story = {
  name: "Multiple Selection",
  parameters: { controls: { disable: true } },
  render: function MultipleStory() {
    const [selected, setSelected] = useState<string[]>(["active", "verified"]);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-4)" }}>
        <p style={{ fontSize: "var(--ao-font-size-sm)", color: "var(--ao-font-color-secondary)" }}>
          Selected: {selected.length > 0 ? selected.join(", ") : "none"}
        </p>
        <ToggleGroup multiple value={selected} onValueChange={setSelected}>
          <Toggle value="active">Active</Toggle>
          <Toggle value="verified">Verified</Toggle>
          <Toggle value="archived">Archived</Toggle>
          <Toggle value="suspended">Suspended</Toggle>
        </ToggleGroup>
      </div>
    );
  },
};

export const Disabled: Story = {
  name: "Disabled Group",
  parameters: { controls: { disable: true } },
  render: () => (
    <ToggleGroup disabled value={["table"]} onValueChange={fn()}>
      <Toggle value="table">Table</Toggle>
      <Toggle value="calendar">Calendar</Toggle>
      <Toggle value="timeline">Timeline</Toggle>
    </ToggleGroup>
  ),
};

export const DisabledItem: Story = {
  name: "Disabled Item",
  parameters: { controls: { disable: true } },
  render: function DisabledItemStory() {
    const [view, setView] = useState<string[]>(["table"]);

    return (
      <ToggleGroup value={view} onValueChange={setView}>
        <Toggle value="table">Table</Toggle>
        <Toggle value="calendar">Calendar</Toggle>
        <Toggle value="timeline" disabled>
          Timeline
        </Toggle>
      </ToggleGroup>
    );
  },
};
