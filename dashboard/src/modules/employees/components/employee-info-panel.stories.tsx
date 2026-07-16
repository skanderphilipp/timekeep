import type { Meta, StoryObj } from "@storybook/react";
import { EmployeeInfoPanel } from "./employee-info-panel";
import type { Employee } from "@/lib/api";

const NOW = Math.floor(Date.now() / 1000);

const activeEmployee: Employee = {
  id: "emp-001",
  pin: "145",
  name: "Ahmed Al-Sabah",
  department: "Engineering",
  external_id: "odoo-42",
  active: true,
  created_at: NOW - 86400 * 30,
  updated_at: NOW - 3600,
};

const minimalEmployee: Employee = {
  id: "emp-002",
  pin: "87",
  name: "Fatima Noor",
  department: null,
  external_id: null,
  active: true,
  created_at: NOW - 86400 * 7,
  updated_at: NOW - 86400 * 7,
};

const meta: Meta<typeof EmployeeInfoPanel> = {
  title: "Modules/Employees/EmployeeInfoPanel",
  component: EmployeeInfoPanel,
  tags: ["autodocs", "level:composite"],
};

export default meta;
type Story = StoryObj<typeof EmployeeInfoPanel>;

export const WithAllFields: Story = {
  args: { employee: activeEmployee },
};

export const MinimalFields: Story = {
  args: { employee: minimalEmployee },
};
