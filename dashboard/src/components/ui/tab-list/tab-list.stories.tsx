import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";

import { Tabs, Tab, TabPanel } from "./tab-list";

/**
 * Tabs — accessible tabbed content using @base-ui/react Tabs primitives.
 *
 * Built-in keyboard navigation (arrow keys, Home/End), roving tabindex,
 * and an animated active indicator. Use on employee detail pages
 * (Overview / Attendance / Punch History) and settings screens.
 *
 * ### Usage
 * ```tsx
 * <Tabs defaultValue="overview" onValueChange={handleTabChange}>
 *   <Tab value="overview">Overview</Tab>
 *   <Tab value="attendance">Attendance</Tab>
 *   <TabPanel value="overview">Overview content</TabPanel>
 *   <TabPanel value="attendance">Attendance content</TabPanel>
 * </Tabs>
 * ```
 */
const meta: Meta<typeof Tabs> = {
  title: "UI/Navigation/TabList",
  component: Tabs,
  tags: ["autodocs"],
  argTypes: {
    defaultValue: { control: "text" },
    orientation: {
      control: "select",
      options: ["horizontal", "vertical"],
    },
  },
  args: {
    onValueChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof Tabs>;

// ── Stories ─────────────────────────────────────────────────────────────────────

export const Primary: Story = {
  render: () => (
    <Tabs defaultValue="overview">
      <Tab value="overview">Overview</Tab>
      <Tab value="details">Details</Tab>
      <Tab value="history">History</Tab>
      <TabPanel value="overview">Overview content — summary metrics and status.</TabPanel>
      <TabPanel value="details">Detail content — full configuration and metadata.</TabPanel>
      <TabPanel value="history">History content — timeline of past events.</TabPanel>
    </Tabs>
  ),
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--ao-spacing-8)",
        padding: "var(--ao-spacing-4)",
      }}
    >
      <div>
        <h3 style={{ marginBlockEnd: "var(--ao-spacing-2)", fontSize: "var(--ao-font-size-sm)" }}>
          Horizontal with disabled tab
        </h3>
        <Tabs defaultValue="active">
          <Tab value="active">Active</Tab>
          <Tab value="archived" disabled>
            Archived
          </Tab>
          <TabPanel value="active">Active content.</TabPanel>
          <TabPanel value="archived">This tab is disabled and inaccessible.</TabPanel>
        </Tabs>
      </div>

      <div>
        <h3 style={{ marginBlockEnd: "var(--ao-spacing-2)", fontSize: "var(--ao-font-size-sm)" }}>
          Employee detail tabs
        </h3>
        <Tabs defaultValue="overview">
          <Tab value="overview">Overview</Tab>
          <Tab value="attendance">Attendance</Tab>
          <Tab value="punches">Punch History</Tab>
          <Tab value="settings">Settings</Tab>
          <TabPanel value="overview">Employee overview content.</TabPanel>
          <TabPanel value="attendance">Attendance calendar and trends.</TabPanel>
          <TabPanel value="punches">Raw punch records.</TabPanel>
          <TabPanel value="settings">Employee-specific settings.</TabPanel>
        </Tabs>
      </div>

      <div>
        <h3 style={{ marginBlockEnd: "var(--ao-spacing-2)", fontSize: "var(--ao-font-size-sm)" }}>
          Vertical orientation
        </h3>
        <Tabs defaultValue="profile" orientation="vertical">
          <Tab value="profile">Profile</Tab>
          <Tab value="schedule">Schedule</Tab>
          <Tab value="devices">Devices</Tab>
          <TabPanel value="profile">Profile settings content.</TabPanel>
          <TabPanel value="schedule">Schedule configuration content.</TabPanel>
          <TabPanel value="devices">Device management content.</TabPanel>
        </Tabs>
      </div>
    </div>
  ),
};

export const ContextEmployeeDetail: Story = {
  name: "Context: Employee Detail Tabs",
  parameters: { controls: { disable: true } },
  render: () => (
    <Tabs defaultValue="overview">
      <Tab value="overview">Overview</Tab>
      <Tab value="attendance">Attendance</Tab>
      <Tab value="punches">Punch History</Tab>
      <TabPanel value="overview">
        <div style={{ padding: "var(--ao-spacing-4)" }}>
          <strong>Fatima Hassan</strong> · PIN 146
          <br />
          Department: Operations · Active
          <br />
          Attendance: 100% this month
        </div>
      </TabPanel>
      <TabPanel value="attendance">
        <div style={{ padding: "var(--ao-spacing-4)" }}>
          Attendance calendar would render here.
        </div>
      </TabPanel>
      <TabPanel value="punches">
        <div style={{ padding: "var(--ao-spacing-4)" }}>
          Punch history table would render here.
        </div>
      </TabPanel>
    </Tabs>
  ),
};

export const Controlled: Story = {
  name: "Controlled",
  parameters: { controls: { disable: true } },
  render: function ControlledStory() {
    const [tab, setTab] = useState("overview");

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--ao-spacing-4)",
        }}
      >
        <p style={{ fontSize: "var(--ao-font-size-sm)", color: "var(--ao-font-color-secondary)" }}>
          Active tab: <code>{tab}</code>
        </p>
        <Tabs value={tab} onValueChange={setTab}>
          <Tab value="overview">Overview</Tab>
          <Tab value="details">Details</Tab>
          <TabPanel value="overview">Overview panel — controlled externally.</TabPanel>
          <TabPanel value="details">Details panel — controlled externally.</TabPanel>
        </Tabs>
      </div>
    );
  },
};


