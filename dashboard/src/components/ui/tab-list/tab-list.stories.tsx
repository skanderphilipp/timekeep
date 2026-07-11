import type { Meta, StoryObj } from "@storybook/react";
import { TabList, Tab, TabPanel } from "./tab-list";
/**
 * TabList — switch between content panels.
 *
 * Used on employee detail pages (Overview / Attendance / History)
 * and settings pages (Profile / Schedule / Devices).
 */
const meta: Meta<typeof TabList> = {
  title: "UI/Navigation/TabList",
  component: TabList,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof TabList>;

export const Primary: Story = {
  render: () => (
    <TabList defaultTab="overview">
      <Tab id="overview">Overview</Tab>
      <Tab id="details">Details</Tab>
      <Tab id="history">History</Tab>
      <TabPanel id="overview">Overview content — summary metrics and status.</TabPanel>
      <TabPanel id="details">Detail content — full configuration and metadata.</TabPanel>
      <TabPanel id="history">History content — timeline of past events.</TabPanel>
    </TabList>
  ),
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-8)", padding: "var(--ao-spacing-4)" }}>
      <div>
        <TabList defaultTab="active">
          <Tab id="active">Active</Tab>
          <Tab id="archived" disabled>Archived</Tab>
          <TabPanel id="active">Active content.</TabPanel>
          <TabPanel id="archived">This tab is disabled.</TabPanel>
        </TabList>
      </div>
      <div>
        <TabList defaultTab="overview">
          <Tab id="overview">Overview</Tab>
          <Tab id="attendance">Attendance</Tab>
          <Tab id="punches">Punch History</Tab>
          <Tab id="settings">Settings</Tab>
          <TabPanel id="overview">Employee overview content.</TabPanel>
          <TabPanel id="attendance">Attendance calendar and trends.</TabPanel>
          <TabPanel id="punches">Raw punch records.</TabPanel>
          <TabPanel id="settings">Employee-specific settings.</TabPanel>
        </TabList>
      </div>
    </div>
  ),
};

export const ContextEmployeeDetail: Story = {
  name: "Context: Employee Detail Tabs",
  parameters: { controls: { disable: true } },
  render: () => (
    <TabList defaultTab="overview">
      <Tab id="overview">Overview</Tab>
      <Tab id="attendance">Attendance</Tab>
      <Tab id="punches">Punch History</Tab>
      <TabPanel id="overview">
        <div style={{ padding: "var(--ao-spacing-4)" }}>
          <strong>Fatima Hassan</strong> · PIN 146<br />
          Department: Operations · Active<br />
          Attendance: 100% this month
        </div>
      </TabPanel>
      <TabPanel id="attendance">
        <div style={{ padding: "var(--ao-spacing-4)" }}>Attendance calendar would render here.</div>
      </TabPanel>
      <TabPanel id="punches">
        <div style={{ padding: "var(--ao-spacing-4)" }}>Punch history table would render here.</div>
      </TabPanel>
    </TabList>
  ),
};
