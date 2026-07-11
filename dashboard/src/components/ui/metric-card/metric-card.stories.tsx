import type { Meta, StoryObj } from "@storybook/react";
import { MetricCard } from "./metric-card";
import { CardGrid } from "../card-grid";
import {
  IconUsers,
  IconUserX,
  IconClockExclamation,
  IconClockCheck,
  IconCalendarStats,
  IconClockHour4,
  IconClockPlus,
  IconPercentage,
} from "@tabler/icons-react";

/**
 * MetricCard — single KPI display with icon, value, label, and sub-label.
 *
 * Color-coded for quick scanning: green = good, red = problem, amber = warning.
 * Always used inside CardGrid for 4-across layout on dashboard and reports.
 */
const meta: Meta<typeof MetricCard> = {
  title: "UI/Data Display/MetricCard",
  component: MetricCard,
  tags: ["autodocs"],
  argTypes: {
    color: {
      control: "select",
      options: ["green", "red", "amber", "accent"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof MetricCard>;

export const Primary: Story = {
  args: {
    icon: <IconUsers size={24} />,
    label: "Present",
    value: 42,
    sub: "of 50",
    color: "green",
  },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <CardGrid>
      <MetricCard icon={<IconUsers size={24} />} label="Present" value={42} sub="of 50" color="green" />
      <MetricCard icon={<IconUserX size={24} />} label="Absent" value={8} sub="of 50" color="red" />
      <MetricCard icon={<IconClockExclamation size={24} />} label="Late" value={3} sub="today" color="amber" />
      <MetricCard icon={<IconClockCheck size={24} />} label="On Time" value={39} sub="today" color="green" />
    </CardGrid>
  ),
};

export const ContextDashboardMetrics: Story = {
  name: "Context: Dashboard Metrics",
  parameters: { controls: { disable: true } },
  render: () => (
    <CardGrid>
      <MetricCard icon={<IconUsers size={24} />} label="Present" value={42} sub="of 50" color="green" />
      <MetricCard icon={<IconUserX size={24} />} label="Absent" value={8} sub="of 50" color="red" />
      <MetricCard icon={<IconClockExclamation size={24} />} label="Late" value={3} sub="today" color="amber" />
      <MetricCard icon={<IconClockCheck size={24} />} label="On Time" value={39} sub="today" color="green" />
    </CardGrid>
  ),
};

export const ContextReportMetrics: Story = {
  name: "Context: Report Metrics",
  parameters: { controls: { disable: true } },
  render: () => (
    <CardGrid>
      <MetricCard icon={<IconCalendarStats size={24} />} label="Work Days" value={22} sub="this month" color="accent" />
      <MetricCard icon={<IconClockHour4 size={24} />} label="Avg Hours" value={8.2} sub="per day" color="accent" />
      <MetricCard icon={<IconClockPlus size={24} />} label="Overtime" value={12.5} sub="total hours" color="accent" />
      <MetricCard icon={<IconPercentage size={24} />} label="Absence Rate" value={4.2} sub="this month" color="amber" />
    </CardGrid>
  ),
};
