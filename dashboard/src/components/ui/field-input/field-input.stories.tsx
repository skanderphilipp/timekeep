import type { Meta } from "@storybook/react";
import { useState } from "react";

import {
  TextDisplay,
  BooleanDisplay,
  DateDisplay,
  NumberDisplay,
  SelectDisplay,
} from "@/components/ui/display";

import {
  FieldTextInput,
  FieldBooleanInput,
  FieldDateInput,
  FieldNumberInput,
  FieldSelectInput,
  FieldMultiSelectInput,
} from "./index";

/**
 * Field Input components — inline editing primitives.
 *
 * No labels, no errors. Designed for table cells and detail views.
 * All exit events (Enter, Escape, Tab, ClickOutside) pass the
 * current draft value to the parent.
 */
const meta: Meta = {
  title: "UI/FieldInput/All",
  tags: ["autodocs"],
};

export default meta;

// ── Helper: edit mode simulator ───────────────────────────────────

function EditSimulator({
  display,
  children,
}: {
  display: React.ReactNode;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div
        style={{
          border: "1px solid var(--ao-accent-accent9)",
          borderRadius: "var(--ao-radius-sm)",
          padding: "4px 0",
          maxWidth: 280,
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      style={{
        cursor: "pointer",
        padding: "4px 8px",
        borderRadius: "var(--ao-radius-sm)",
        border: "1px solid transparent",
        maxWidth: 280,
        minHeight: 28,
        display: "flex",
        alignItems: "center",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor =
          "var(--ao-border-color-medium)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "transparent";
      }}
    >
      {display}
    </div>
  );
}

// ── Text ──────────────────────────────────────────────────────────

export const Text = {
  name: "FieldTextInput",
  render: () => {
    function Demo() {
      const [log, setLog] = useState<string[]>([]);
      const addLog = (msg: string) =>
        setLog((prev) => [...prev.slice(-4), msg]);

      return (
        <div style={{ padding: 16, fontFamily: "var(--ao-font-family)" }}>
          <EditSimulator
            display={
              <span style={{ color: "var(--ao-font-color-primary)" }}>
                Click to edit
              </span>
            }
          >
            <FieldTextInput
              instanceId="story-text"
              value="Ahmed Al-Sabah"
              placeholder="Enter name…"
              autoFocus
              onChange={(v) => addLog(`draft: "${v}"`)}
              onEnter={(v) => addLog(`✅ Enter: "${v}"`)}
              onEscape={() => addLog(`❌ Escape`)}
              onTab={(v) => addLog(`↹ Tab: "${v}"`)}
              onClickOutside={(_, v) => addLog(`👆 Outside: "${v}"`)}
            />
          </EditSimulator>
          <EventLog log={log} />
        </div>
      );
    }
    return <Demo />;
  },
};

// ── Boolean ───────────────────────────────────────────────────────

export const Boolean = {
  name: "FieldBooleanInput",
  render: () => {
    function Demo() {
      const [value, setValue] = useState(true);
      const [log, setLog] = useState<string[]>([]);

      return (
        <div style={{ padding: 16, fontFamily: "var(--ao-font-family)" }}>
          <p style={{ fontSize: 13, marginBottom: 8, color: "var(--ao-font-color-secondary)" }}>
            Click to toggle — fires onToggle immediately
          </p>
          <FieldBooleanInput
            instanceId="story-bool"
            value={value}
            onToggle={(v) => {
              setValue(v);
              setLog((prev) => [
                ...prev.slice(-4),
                `Toggled: ${v ? "Yes" : "No"}`,
              ]);
            }}
          />
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              color: "var(--ao-font-color-tertiary)",
            }}
          >
            <strong>Current:</strong> {value ? "Yes" : "No"}
          </div>
          <EventLog log={log} />
        </div>
      );
    }
    return <Demo />;
  },
};

// ── Date ──────────────────────────────────────────────────────────

export const Date = {
  name: "FieldDateInput",
  render: () => {
    function Demo() {
      const [log, setLog] = useState<string[]>([]);
      const addLog = (msg: string) =>
        setLog((prev) => [...prev.slice(-4), msg]);

      return (
        <div style={{ padding: 16, fontFamily: "var(--ao-font-family)" }}>
          <EditSimulator
            display={<span>📅 Click to pick date</span>}
          >
            <FieldDateInput
              instanceId="story-date"
              value={new Date("2026-07-15")}
              onChange={(d) =>
                addLog(`draft: ${d?.toISOString().slice(0, 10) ?? "null"}`)
              }
              onEnter={(d) =>
                addLog(
                  `✅ Enter: ${d?.toISOString().slice(0, 10) ?? "null"}`,
                )
              }
              onEscape={() => addLog(`❌ Escape`)}
              onClickOutside={() => addLog(`👆 Outside`)}
            />
          </EditSimulator>
          <EventLog log={log} />
        </div>
      );
    }
    return <Demo />;
  },
};

// ── Number ────────────────────────────────────────────────────────

export const Number = {
  name: "FieldNumberInput",
  render: () => {
    function Demo() {
      const [log, setLog] = useState<string[]>([]);
      const addLog = (msg: string) =>
        setLog((prev) => [...prev.slice(-4), msg]);

      return (
        <div style={{ padding: 16, fontFamily: "var(--ao-font-family)" }}>
          <EditSimulator display={<span>42</span>}>
            <FieldNumberInput
              instanceId="story-num"
              value={42}
              placeholder="Enter hours…"
              autoFocus
              onChange={(v) => addLog(`draft: "${v}"`)}
              onEnter={(v) => addLog(`✅ Enter: ${v}`)}
              onEscape={() => addLog(`❌ Escape`)}
              onTab={(v) => addLog(`↹ Tab: ${v}`)}
            />
          </EditSimulator>
          <EventLog log={log} />
        </div>
      );
    }
    return <Demo />;
  },
};

// ── Select ────────────────────────────────────────────────────────

export const Select = {
  name: "FieldSelectInput",
  render: () => {
    function Demo() {
      const [value, setValue] = useState<string | undefined>(undefined);
      const [log, setLog] = useState<string[]>([]);

      return (
        <div style={{ padding: 16, fontFamily: "var(--ao-font-family)" }}>
          <p style={{ fontSize: 13, marginBottom: 8, color: "var(--ao-font-color-secondary)" }}>
            Selection triggers onOptionSelected immediately — no Enter needed
          </p>
          <div style={{ maxWidth: 280 }}>
            <FieldSelectInput
              instanceId="story-select"
              value={value}
              options={[
                { value: "admin", label: "Admin" },
                { value: "manager", label: "Manager" },
                { value: "viewer", label: "Viewer" },
              ]}
              onOptionSelected={(v) => {
                setValue(v);
                setLog((prev) => [
                  ...prev.slice(-4),
                  `✅ Selected: ${v}`,
                ]);
              }}
              onEscape={() =>
                setLog((prev) => [...prev.slice(-4), "❌ Escape"])
              }
              placeholder="Select role…"
            />
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              color: "var(--ao-font-color-tertiary)",
            }}
          >
            <strong>Current:</strong> {value ?? "none"}
          </div>
          <EventLog log={log} />
        </div>
      );
    }
    return <Demo />;
  },
};

// ── MultiSelect ───────────────────────────────────────────────────

export const MultiSelect = {
  name: "FieldMultiSelectInput",
  render: () => {
    function Demo() {
      const [values, setValues] = useState<string[]>(["admin"]);
      const [log, setLog] = useState<string[]>([]);

      return (
        <div style={{ padding: 16, fontFamily: "var(--ao-font-family)" }}>
          <p style={{ fontSize: 13, marginBottom: 8, color: "var(--ao-font-color-secondary)" }}>
            Each toggle persists immediately — no confirmation step
          </p>
          <div style={{ maxWidth: 360 }}>
            <FieldMultiSelectInput
              instanceId="story-multi"
              values={values}
              options={[
                { value: "admin", label: "Admin" },
                { value: "write", label: "Write" },
                { value: "read", label: "Read" },
                { value: "audit", label: "Audit" },
              ]}
              onOptionSelected={(v) => {
                setValues(v);
                setLog((prev) => [
                  ...prev.slice(-4),
                  `Selected: [${v.join(", ")}]`,
                ]);
              }}
              onEscape={() =>
                setLog((prev) => [...prev.slice(-4), "❌ Escape"])
              }
              placeholder="Select permissions…"
            />
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 12,
              color: "var(--ao-font-color-tertiary)",
            }}
          >
            <strong>Current:</strong>{" "}
            {values.length ? values.join(", ") : "none"}
          </div>
          <EventLog log={log} />
        </div>
      );
    }
    return <Demo />;
  },
};

// ── Side-by-side Display vs Edit ──────────────────────────────────

export const DisplayVsEdit = {
  name: "Display vs Edit — Side by Side",
  render: () => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 16,
        padding: 16,
        fontFamily: "var(--ao-font-family)",
        fontSize: "var(--ao-font-size-sm)",
      }}
    >
      <div
        style={{
          border: "1px solid var(--ao-border-color-medium)",
          borderRadius: 8,
          padding: 12,
        }}
      >
        <p
          style={{
            fontWeight: 600,
            marginBottom: 12,
            fontSize: 11,
            textTransform: "uppercase",
            color: "var(--ao-font-color-tertiary)",
          }}
        >
          Display (read-only)
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <TextDisplay text="Ahmed Al-Sabah" />
          <BooleanDisplay value={true} />
          <DateDisplay value={new Date("2026-07-15")} />
          <NumberDisplay value={42} />
          <SelectDisplay color="accent" label="Admin" />
        </div>
      </div>

      <div
        style={{
          border: "1px solid var(--ao-accent-accent9)",
          borderRadius: 8,
          padding: 12,
          background: "var(--ao-background-transparent-lighter)",
        }}
      >
        <p
          style={{
            fontWeight: 600,
            marginBottom: 12,
            fontSize: 11,
            textTransform: "uppercase",
            color: "var(--ao-font-color-tertiary)",
          }}
        >
          Edit (inline editing)
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <FieldTextInput instanceId="side-text" value="Ahmed Al-Sabah" />
          <FieldBooleanInput instanceId="side-bool" value={true} />
          <FieldDateInput
            instanceId="side-date"
            value={new Date("2026-07-15")}
          />
          <FieldNumberInput instanceId="side-num" value={42} />
          <FieldSelectInput
            instanceId="side-select"
            value="admin"
            options={[
              { value: "admin", label: "Admin" },
              { value: "viewer", label: "Viewer" },
            ]}
            onOptionSelected={() => {}}
          />
        </div>
      </div>
    </div>
  ),
};

// ── Helper: event log ─────────────────────────────────────────────

function EventLog({ log }: { log: string[] }) {
  return (
    <div
      style={{
        marginTop: 16,
        fontSize: 11,
        fontFamily: "monospace",
        color: "var(--ao-font-color-tertiary)",
      }}
    >
      <strong>Event log:</strong>
      {log.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
}
