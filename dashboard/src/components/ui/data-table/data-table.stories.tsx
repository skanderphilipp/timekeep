import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { DataTable, type DataTableColumn } from "./data-table";
import { Tag } from "../tag";

type EmployeeRow = {
  id: string;
  name: string;
  pin: string;
  department: string;
  attendance: number;
  status: "active" | "inactive";
  hasAnomalies: boolean;
};

const columns: DataTableColumn<EmployeeRow>[] = [
  { id: "name", header: "Name", accessor: (r) => r.name, sortable: true },
  { id: "pin", header: "PIN", accessor: (r) => r.pin, width: "80px" },
  { id: "department", header: "Department", accessor: (r) => r.department },
  {
    id: "attendance",
    header: "Attendance",
    sortable: true,
    cell: (r) => (
      <span style={{ color: r.attendance >= 90 ? "var(--ao-font-color-success)" : "var(--ao-font-color-warning)" }}>
        {r.attendance}%
      </span>
    ),
  },
  {
    id: "status",
    header: "Status",
    cell: (r) => <Tag text={r.status === "active" ? "Active" : "Inactive"} color={r.status === "active" ? "green" : "gray"} />,
  },
];

const sampleData: EmployeeRow[] = [
  { id: "1", name: "Ahmed Al-Sabah", pin: "145", department: "Operations", attendance: 100, status: "active", hasAnomalies: false },
  { id: "2", name: "Fatima Hassan", pin: "146", department: "Operations", attendance: 95, status: "active", hasAnomalies: false },
  { id: "3", name: "Omar Khalid", pin: "147", department: "Warehouse", attendance: 72, status: "active", hasAnomalies: true },
  { id: "4", name: "Layla Noor", pin: "148", department: "Admin", attendance: 98, status: "active", hasAnomalies: false },
  { id: "5", name: "Bilal Mahmoud", pin: "149", department: "Warehouse", attendance: 0, status: "inactive", hasAnomalies: false },
];

const meta: Meta<typeof DataTable<EmployeeRow>> = {
  title: "UI/Data Display/DataTable",
  component: DataTable<EmployeeRow>,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof DataTable<EmployeeRow>>;

export const Primary: Story = {
  args: {
    columns,
    data: sampleData,
    getRowKey: (r) => r.id,
    sortState: { column: "name", direction: "asc" },
    onSortChange: fn(),
  },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-6)" }}>
      <DataTable columns={columns} data={sampleData} getRowKey={(r) => r.id} sortState={{ column: "name", direction: "asc" }} onSortChange={fn()} />
      <DataTable columns={columns} data={[]} getRowKey={(r) => r.id} emptyState={<p style={{ padding: 16, color: "var(--ao-font-color-tertiary)", textAlign: "center" }}>No employees found.</p>} />
      <DataTable columns={columns} data={[]} getRowKey={(r) => r.id} isLoading />
    </div>
  ),
};

export const ContextEmployeeDirectory: Story = {
  name: "Context: Employee Directory",
  parameters: { controls: { disable: true } },
  args: {
    columns,
    data: sampleData,
    getRowKey: (r) => r.id,
    sortState: { column: "attendance", direction: "asc" },
    onSortChange: fn(),
    onRowClick: fn(),
  },
};
