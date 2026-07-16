import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider } from "jotai";
import { userEvent, within, expect } from "@storybook/test";

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
  tags: ["autodocs", "level:primitive"],
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
    <div style={{ maxWidth: 300, padding: 24 }}>
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
        fontFamily: "var(--ao-font-family)",
        gap: 16,
        maxWidth: 500,
        padding: 24,
      }}
    >
      <div style={{ width: 150 }}>
        <div style={{ color: "var(--ao-font-color-tertiary)", fontSize: 11, marginBottom: 4 }}>Name</div>
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
        <div style={{ color: "var(--ao-font-color-tertiary)", fontSize: 11, marginBottom: 4 }}>Email</div>
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
        <table style={{ borderCollapse: "collapse", maxWidth: 600, width: "100%" }}>
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
    <div style={{ fontFamily: "var(--ao-font-family)", maxWidth: 350, padding: 24 }}>
      <p style={{ color: "var(--ao-font-color-secondary)", fontSize: 13, marginBottom: 12 }}>
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

// ── Interactive (play) stories ────────────────────────────────────────────

/** Clicks the cell, types a new value, presses Enter. */
export const ClickToEdit: Story = {
  render: () => (
    <div style={{ fontFamily: "var(--ao-font-family)", maxWidth: 300, padding: 24 }}>
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Ahmed Al-Sabah")).toBeDefined();

    const cell = canvas.getByRole("button");
    await userEvent.click(cell);

    const input = canvas.getByRole("textbox") as HTMLInputElement;
    await expect(input).toBeDefined();
    await expect(input.value).toBe("Ahmed Al-Sabah");

    await userEvent.clear(input);
    await userEvent.type(input, "Fatima Noor");
    await expect(input.value).toBe("Fatima Noor");

    await userEvent.keyboard("{Enter}");
  },
};

/** Tab navigates from name to email cell. */
export const TabNavigationInteractive: Story = {
  render: () => (
    <div
      style={{
        display: "flex",
        fontFamily: "var(--ao-font-family)",
        gap: 16,
        maxWidth: 500,
        padding: 24,
      }}
    >
      <div style={{ width: 150 }}>
        <div style={{ color: "var(--ao-font-color-tertiary)", fontSize: 11, marginBottom: 4 }}>Name</div>
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
        <div style={{ color: "var(--ao-font-color-tertiary)", fontSize: 11, marginBottom: 4 }}>Email</div>
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const nameCell = canvas.getAllByRole("button")[0];
    await userEvent.click(nameCell);

    const nameInput = canvas.getByRole("textbox") as HTMLInputElement;
    await expect(nameInput.value).toBe("Ahmed Al-Sabah");

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Fatima Noor");
    await userEvent.keyboard("{Tab}");

    const emailInput = canvas.getByRole("textbox") as HTMLInputElement;
    await expect(emailInput.value).toBe("ahmed@alsabah.com");
  },
};
