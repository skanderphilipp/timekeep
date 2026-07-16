import type { Meta } from "@storybook/react";

import {
  TextDisplay,
  BooleanDisplay,
  DateDisplay,
  NumberDisplay,
  SelectDisplay,
  MultiSelectDisplay,
  EllipsisDisplay,
} from "./index";

const meta: Meta = {
  title: "UI/Display/All",
  tags: ["autodocs", "level:primitive"],
};

export default meta;

const stack = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
};
const row = { display: "flex", gap: 12 };

export function TextDisplayStory() {
  return (
    <div style={{ ...stack, maxWidth: 300, padding: 16 }}>
      <TextDisplay text="Ahmed Al-Sabah" />
      <TextDisplay text="Very long employee name that should truncate with ellipsis at the cell boundary" />
      <TextDisplay text="" />
    </div>
  );
}

export function BooleanDisplayStory() {
  return (
    <div style={{ ...row, padding: 16 }}>
      <BooleanDisplay value={true} />
      <BooleanDisplay value={false} />
      <BooleanDisplay value={null} />
      <BooleanDisplay value={undefined} />
    </div>
  );
}

export function DateDisplayStory() {
  return (
    <div style={{ ...stack, maxWidth: 300, padding: 16 }}>
      <DateDisplay value={new Date("2026-07-15")} />
      <DateDisplay value="2026-01-01" />
      <DateDisplay value={null} />
    </div>
  );
}

export function NumberDisplayStory() {
  return (
    <div style={{ ...stack, maxWidth: 200, padding: 16 }}>
      <NumberDisplay value={42} />
      <NumberDisplay value={3.14159} decimals={2} />
      <NumberDisplay value={120} suffix="min" />
      <NumberDisplay value={0} />
      <NumberDisplay value={null} />
    </div>
  );
}

export function SelectDisplayStory() {
  return (
    <div style={{ ...row, padding: 16 }}>
      <SelectDisplay color="accent" label="Active" />
      <SelectDisplay color="green" label="Approved" />
      <SelectDisplay color="red" label="Rejected" />
      <SelectDisplay color="amber" label="Pending" />
    </div>
  );
}

export function MultiSelectDisplayStory() {
  const opts = [
    { value: "admin", label: "Admin", color: "red" as const },
    { value: "write", label: "Write", color: "accent" as const },
    { value: "read", label: "Read", color: "green" as const },
  ];
  return (
    <div style={{ maxWidth: 400, padding: 16 }}>
      <MultiSelectDisplay values={["admin", "write", "read"]} options={opts as any} />
    </div>
  );
}

export function EllipsisDisplayStory() {
  return (
    <div style={{ ...stack, maxWidth: 200, padding: 16 }}>
      <EllipsisDisplay>Short text</EllipsisDisplay>
      <EllipsisDisplay>
        This is a very long piece of text that should be truncated with an ellipsis
      </EllipsisDisplay>
      <EllipsisDisplay maxWidth={120}>
        Even narrower with explicit maxWidth
      </EllipsisDisplay>
    </div>
  );
}

export function TableCellSimulation() {
  const rows = [
    { name: "Ahmed Al-Sabah", active: true, role: "Admin", hours: 160, joined: new Date("2024-03-15") },
    { name: "Omar Khalid", active: false, role: "Viewer", hours: 80, joined: new Date("2025-01-10") },
    { name: "Fatima Noor", active: true, role: "Manager", hours: 140, joined: new Date("2023-11-01") },
  ];

  return (
    <div style={{ fontFamily: "var(--ao-font-family)", fontSize: "var(--ao-font-size-sm)" }}>
      <table style={{ borderCollapse: "collapse", maxWidth: 700, width: "100%" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--ao-border-color-medium)" }}>
            <th style={{ padding: "8px 12px", textAlign: "left", width: 180 }}>Name</th>
            <th style={{ padding: "8px 12px", textAlign: "left", width: 80 }}>Active</th>
            <th style={{ padding: "8px 12px", textAlign: "left", width: 120 }}>Role</th>
            <th style={{ padding: "8px 12px", textAlign: "left", width: 80 }}>Hours</th>
            <th style={{ padding: "8px 12px", textAlign: "left", width: 140 }}>Joined</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} style={{ borderBottom: "1px solid var(--ao-border-color-light)" }}>
              <td style={{ padding: "8px 12px" }}><TextDisplay text={row.name} /></td>
              <td style={{ padding: "8px 12px" }}><BooleanDisplay value={row.active} /></td>
              <td style={{ padding: "8px 12px" }}><SelectDisplay color="accent" label={row.role} /></td>
              <td style={{ padding: "8px 12px" }}><NumberDisplay value={row.hours} suffix="h" /></td>
              <td style={{ padding: "8px 12px" }}><DateDisplay value={row.joined} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
