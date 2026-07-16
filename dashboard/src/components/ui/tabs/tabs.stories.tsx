import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import {
  IconUser,
  IconCalendarClock,
  IconHistory,
  IconSettings,
  IconUserCircle,
  IconClock,
  IconDeviceDesktop,
} from "@tabler/icons-react";

import { Tabs, Tab, TabPanel } from "./tabs";

/**
 * Tabs — accessible tabbed content using @base-ui/react Tabs primitives.
 *
 * Pill-style active indicator with clear visual distinction between
 * active and inactive tabs. Icons are supported via the `icon` prop
 * and automatically inherit the tab's color.
 *
 * ### Usage
 * ```tsx
 * <Tabs defaultValue="overview" onValueChange={handleTabChange}>
 *   <Tab value="overview" icon={<IconUser size={16} />}>Overview</Tab>
 *   <Tab value="attendance" icon={<IconCalendarClock size={16} />}>Attendance</Tab>
 *   <TabPanel value="overview">Overview content</TabPanel>
 *   <TabPanel value="attendance">Attendance content</TabPanel>
 * </Tabs>
 * ```
 */
const meta: Meta<typeof Tabs> = {
  title: "UI/Navigation/Tabs",
  component: Tabs,
  tags: ["autodocs", "level:primitive"],
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

export const WithIcons: Story = {
  name: "With Icons",
  render: () => (
    <Tabs defaultValue="overview">
      <Tab value="overview" icon={<IconUserCircle size={16} />}>
        Overview
      </Tab>
      <Tab value="attendance" icon={<IconCalendarClock size={16} />}>
        Attendance
      </Tab>
      <Tab value="punches" icon={<IconHistory size={16} />}>
        Punch History
      </Tab>
      <Tab value="settings" icon={<IconSettings size={16} />}>
        Settings
      </Tab>
      <TabPanel value="overview">Employee overview content.</TabPanel>
      <TabPanel value="attendance">Attendance calendar and trends.</TabPanel>
      <TabPanel value="punches">Raw punch records.</TabPanel>
      <TabPanel value="settings">Employee-specific settings.</TabPanel>
    </Tabs>
  ),
};

export const IconsOnly: Story = {
  name: "Icons Only",
  render: () => (
    <Tabs defaultValue="clock">
      <Tab value="clock" icon={<IconClock size={16} />}>
        Time
      </Tab>
      <Tab value="devices" icon={<IconDeviceDesktop size={16} />}>
        Devices
      </Tab>
      <Tab value="users" icon={<IconUser size={16} />}>
        Users
      </Tab>
      <TabPanel value="clock">Time tracking.</TabPanel>
      <TabPanel value="devices">Device management.</TabPanel>
      <TabPanel value="users">User directory.</TabPanel>
    </Tabs>
  ),
};

export const WithDisabled: Story = {
  name: "With Disabled Tab",
  parameters: { controls: { disable: true } },
  render: () => (
    <Tabs defaultValue="active">
      <Tab value="active" icon={<IconUserCircle size={16} />}>
        Active
      </Tab>
      <Tab value="archived" icon={<IconHistory size={16} />} disabled>
        Archived
      </Tab>
      <Tab value="settings" icon={<IconSettings size={16} />}>
        Settings
      </Tab>
      <TabPanel value="active">Active content.</TabPanel>
      <TabPanel value="archived">This tab is disabled and inaccessible.</TabPanel>
      <TabPanel value="settings">Settings content.</TabPanel>
    </Tabs>
  ),
};

export const EmployeeDetail: Story = {
  name: "Context: Employee Detail",
  parameters: { controls: { disable: true } },
  render: () => (
    <Tabs defaultValue="overview">
      <Tab value="overview" icon={<IconUserCircle size={16} />}>
        Overview
      </Tab>
      <Tab value="attendance" icon={<IconCalendarClock size={16} />}>
        Attendance
      </Tab>
      <Tab value="punches" icon={<IconHistory size={16} />}>
        Punch History
      </Tab>
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
        <div style={{ padding: "var(--ao-spacing-4)" }}>Attendance calendar would render here.</div>
      </TabPanel>
      <TabPanel value="punches">
        <div style={{ padding: "var(--ao-spacing-4)" }}>Punch history table would render here.</div>
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
          <Tab value="overview" icon={<IconUserCircle size={16} />}>
            Overview
          </Tab>
          <Tab value="details" icon={<IconSettings size={16} />}>
            Details
          </Tab>
          <TabPanel value="overview">Overview panel — controlled externally.</TabPanel>
          <TabPanel value="details">Details panel — controlled externally.</TabPanel>
        </Tabs>
      </div>
    );
  },
};
