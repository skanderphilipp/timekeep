import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider } from "jotai";

import { EditableCell } from "./editable-cell";
import type { EditableCellEditProps } from "./editable-cell";
import { TextDisplay } from "@/components/ui/display";
import { FieldTextInput } from "@/components/ui/field-input";

// ── Wrapper for Jotai + TanStack Query ────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <JotaiProvider>{children}</JotaiProvider>
    </QueryClientProvider>
  );
}

// ── Meta ──────────────────────────────────────────────────────────────────

const meta: Meta<typeof EditableCell> = {
  title: "UI/DataTable/EditableCell",
  component: EditableCell,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <Providers>
        <Story />
      </Providers>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof EditableCell>;

// ── Shared render props ──────────────────────────────────────────────────

function textDisplay(value: string) {
  return <TextDisplay text={value} />;
}

function textEdit(props: EditableCellEditProps<string>) {
  return (
    <FieldTextInput
      instanceId={props.instanceId}
      value={props.value}
      onChange={props.onChange}
      onEnter={props.onEnter}
      onEscape={props.onEscape}
      onTab={props.onTab}
      onShiftTab={props.onShiftTab}
      onClickOutside={props.onClickOutside}
      autoFocus={props.autoFocus}
    />
  );
}

// eslint-disable-next-line no-console
const log = (rowId: string, columnId: string, value: unknown) =>
  console.log("[EditableCell] persist:", { rowId, columnId, value });

// ── Stories ───────────────────────────────────────────────────────────────

/** Single editable cell — click or focus+type to edit, press Enter/Escape to exit. */
export const SingleCell: Story = {
  render: () => (
    <div style={{ padding: 24, maxWidth: 300 }}>
      <EditableCell<string>
        rowId="row-1"
        columnId="name"
        value="Ahmed Al-Sabah"
        renderDisplay={textDisplay}
        renderEdit={textEdit}
        onPersist={log}
      />
    </div>
  ),
};

/** Two editable cells side by side — Tab navigates between them. */
export const TabNavigation: Story = {
  render: () => (
    <div
      style={{
        display: "flex",
        gap: 16,
        padding: 24,
        maxWidth: 500,
        fontFamily: "var(--ao-font-family)",
      }}
    >
      <div style={{ width: 150 }}>
        <div style={{ fontSize: 11, color: "var(--ao-font-color-tertiary)", marginBottom: 4 }}>Name</div>
        <EditableCell<string>
          rowId="row-1"
          columnId="name"
          value="Ahmed Al-Sabah"
          renderDisplay={textDisplay}
          renderEdit={textEdit}
          onPersist={log}
          editableColumns={["name", "email"]}
        />
      </div>
      <div style={{ width: 200 }}>
        <div style={{ fontSize: 11, color: "var(--ao-font-color-tertiary)", marginBottom: 4 }}>Email</div>
        <EditableCell<string>
          rowId="row-1"
          columnId="email"
          value="ahmed@alsabah.com"
          renderDisplay={textDisplay}
          renderEdit={textEdit}
          onPersist={log}
          editableColumns={["name", "email"]}
        />
      </div>
    </div>
  ),
};

/** Simulates a full editable table row. */
export const TableRow: Story = {
  render: () => {
    const editableColumns = ["name", "email", "department"];

    const employees = [
      { id: "emp-1", name: "Ahmed Al-Sabah", email: "ahmed@alsabah.com", department: "Engineering" },
      { id: "emp-2", name: "Fatima Noor", email: "fatima@alsabah.com", department: "HR" },
    ];

    return (
      <div
        style={{
          fontFamily: "var(--ao-font-family)",
          fontSize: "var(--ao-font-size-sm)",
        }}
      >
        <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 600 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--ao-border-color-medium)" }}>
              <th style={{ padding: "8px 12px", textAlign: "left", width: 180 }}>Name</th>
              <th style={{ padding: "8px 12px", textAlign: "left", width: 220 }}>Email</th>
              <th style={{ padding: "8px 12px", textAlign: "left", width: 150 }}>Department</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} style={{ borderBottom: "1px solid var(--ao-border-color-light)" }}>
                {editableColumns.map((col) => (
                  <td key={col} style={{ padding: "8px 12px" }}>
                    <EditableCell<string>
                      rowId={emp.id}
                      columnId={col}
                      value={(emp as Record<string, string>)[col]}
                      renderDisplay={textDisplay}
                      renderEdit={textEdit}
                      onPersist={log}
                      editableColumns={editableColumns}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  },
};

/** Demonstrates "just start typing" — focus a cell with Tab, then press any letter key. */
export const JustStartTyping: Story = {
  render: () => (
    <div style={{ padding: 24, maxWidth: 350, fontFamily: "var(--ao-font-family)" }}>
      <p style={{ fontSize: 13, color: "var(--ao-font-color-secondary)", marginBottom: 12 }}>
        Focus this cell with <strong>Tab</strong>, then press any letter key. The cell enters edit mode
        and the typed character appears in the input (replacing the original value).
      </p>
      <EditableCell<string>
        rowId="row-1"
        columnId="name"
        value="Click or type to edit"
        renderDisplay={textDisplay}
        renderEdit={textEdit}
        onPersist={log}
      />
    </div>
  ),
};
