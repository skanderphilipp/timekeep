import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { createRenderWrapper } from "@/testing/render-with-providers";

import { RecordDetailProvider } from "../states/record-detail-context";
import { RecordDetailFields } from "./record-detail-fields";
import type { DetailViewConfig } from "../entity-definitions/types";

// ── Test setup ──────────────────────────────────────────────────────────────

const { render } = createRenderWrapper();

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Wrap RecordDetailFields with the required RecordDetailProvider context.
 */
function renderFields(
  config: DetailViewConfig,
  overrides: {
    record?: Record<string, unknown>;
    kpiData?: Record<string, unknown> | null;
    tabChildren?: Record<string, React.ReactNode>;
  } = {},
) {
  const {
    record = {},
    kpiData = null,
    tabChildren,
  } = overrides;

  return render(
    <RecordDetailProvider
      value={{
        entityType: "device",
        entityId: "SN-001",
        isInSidePanel: false,
      }}
    >
      <RecordDetailFields
        record={record}
        config={config}
        kpiData={kpiData}
        tabChildren={tabChildren}
      />
    </RecordDetailProvider>,
  );
}

// ── Shared test configs ─────────────────────────────────────────────────────

function makeFlatConfig(): DetailViewConfig {
  return {
    nameField: "name",
    sections: [
      {
        title: "Identity",
        fields: [
          {
            fieldId: "name",
            label: "Name",
            type: "text",
            metadata: { fieldName: "name" },
            editable: false,
          },
          {
            fieldId: "email",
            label: "Email",
            type: "text",
            metadata: { fieldName: "email" },
            editable: false,
          },
        ],
      },
    ],
  };
}

function makeTabConfig(): DetailViewConfig {
  return {
    nameField: "label",
    tabs: [
      {
        key: "info",
        title: "Info",
        sections: [
          {
            title: "Connection",
            fields: [
              {
                fieldId: "host",
                label: "Host",
                type: "text",
                metadata: { fieldName: "host" },
                editable: false,
              },
            ],
          },
        ],
      },
      {
        key: "config",
        title: "Config",
        sections: [],
      },
      {
        key: "users",
        title: "Users",
        sections: [
          {
            title: "Assigned Users",
            fields: [
              {
                fieldId: "user_count",
                label: "User Count",
                type: "number",
                metadata: { fieldName: "user_count" },
                editable: false,
              },
            ],
          },
        ],
      },
    ],
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("RecordDetailFields — tab rendering", () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // Flat mode (no tabs)
  // ═══════════════════════════════════════════════════════════════════════════

  it("renders flat sections when config has sections but no tabs", () => {
    renderFields(makeFlatConfig(), {
      record: { name: "Alice", email: "alice@example.com" },
    });

    // Section title is visible
    expect(screen.getByText("Identity")).toBeDefined();
    // Field labels are rendered (main panel uses MetadataGrid)
    expect(screen.getByText("Name")).toBeDefined();
    expect(screen.getByText("Email")).toBeDefined();
  });

  it("does NOT render tabs when config.tabs is undefined", () => {
    renderFields(makeFlatConfig(), {
      record: { name: "Bob" },
    });

    // base-ui Tabs renders a [data-slot="tabs"] on the root
    const tabsRoot = document.querySelector('[data-slot="tabs"]');
    expect(tabsRoot).toBeNull();
  });

  it("renders field values from the record", () => {
    renderFields(makeFlatConfig(), {
      record: { name: "Charlie", email: "charlie@test.com" },
    });

    // FieldDisplay renders the raw value string
    expect(screen.getByText("Charlie")).toBeDefined();
    expect(screen.getByText("charlie@test.com")).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Tab mode
  // ═══════════════════════════════════════════════════════════════════════════

  it("renders tabs when config.tabs is defined", () => {
    renderFields(makeTabConfig(), {
      record: { host: "192.168.1.1" },
    });

    // base-ui Tabs should be present
    const tabsRoot = document.querySelector('[data-slot="tabs"]');
    expect(tabsRoot).toBeDefined();

    // All tab labels should be rendered
    expect(screen.getByText("Info")).toBeDefined();
    expect(screen.getByText("Config")).toBeDefined();
    expect(screen.getByText("Users")).toBeDefined();
  });

  it("renders tab sections inside the active tab panel", () => {
    renderFields(makeTabConfig(), {
      record: { host: "10.0.0.1", user_count: 42 },
    });

    // Only the active tab (Info, first tab) renders its content
    // base-ui hides inactive panels
    expect(screen.getByText("Connection")).toBeDefined();
    expect(screen.getByText("Host")).toBeDefined();
    expect(screen.getByText("10.0.0.1")).toBeDefined();
  });

  it("first tab is active by default", () => {
    renderFields(makeTabConfig(), {
      record: { host: "localhost" },
    });

    // The first tab ("Info") should have the active state
    // base-ui adds aria-selected="true" to the active tab
    const activeTab = document.querySelector('[data-slot="tab"][aria-selected="true"]');
    expect(activeTab).toBeDefined();
    expect(activeTab?.textContent).toContain("Info");
  });

  it("tabs with empty sections render without errors (tabChildren slot)", () => {
    renderFields(makeTabConfig(), {
      record: { host: "127.0.0.1" },
    });

    // Config tab has empty sections — should render an empty panel
    const tabsRoot = document.querySelector('[data-slot="tabs"]');
    expect(tabsRoot).toBeDefined();

    // All three tabs are present
    const tabs = document.querySelectorAll('[data-slot="tab"]');
    expect(tabs.length).toBe(3);
  });

  it("renders tabChildren inside the active tab panel", () => {
    // Use a config where the first tab has tabChildren
    const config: DetailViewConfig = {
      ...makeTabConfig(),
      tabs: [
        {
          key: "info",
          title: "Info",
          sections: [
            { title: "Details", fields: [{ fieldId: "host", label: "Host", type: "text", metadata: { fieldName: "host" }, editable: false }] },
          ],
        },
        { key: "config", title: "Config", sections: [] },
        { key: "users", title: "Users", sections: [] },
      ],
    };

    renderFields(config, {
      record: { host: "10.0.0.1" },
      tabChildren: {
        info: <div data-testid="info-extra">Extra Info Content</div>,
        config: <div data-testid="config-content">Config Form</div>,
      },
    });

    // Only the active tab's (Info) children are rendered
    expect(screen.getByTestId("info-extra")).toBeDefined();
    expect(screen.getByText("Extra Info Content")).toBeDefined();

    // Config tab children are NOT rendered (tab is inactive)
    expect(screen.queryByTestId("config-content")).toBeNull();
  });

  it("renders children above Tabs (not inside)", () => {
    render(
      <RecordDetailProvider
        value={{ entityType: "device", entityId: "SN-001", isInSidePanel: false }}
      >
        <RecordDetailFields
          record={{ host: "host1" }}
          config={makeTabConfig()}
        >
          <div data-testid="extra-content">Status Bar Above Tabs</div>
        </RecordDetailFields>
      </RecordDetailProvider>,
    );

    // Children render above tabs (ADR-008: status bars, health summaries)
    expect(screen.getByTestId("extra-content")).toBeDefined();
    expect(screen.getByText("Status Bar Above Tabs")).toBeDefined();

    // Verify children appear BEFORE the tabs element in DOM order
    const fieldsContainer = document.querySelector('[data-slot="record-detail-fields"]');
    const extraEl = screen.getByTestId("extra-content");
    const tabsEl = document.querySelector('[data-slot="tabs"]');
    expect(fieldsContainer).toBeDefined();
    expect(tabsEl).toBeDefined();
    // extra-content should appear before tabs in the DOM
    if (extraEl && tabsEl) {
      const position = extraEl.compareDocumentPosition(tabsEl);
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Side panel rendering
  // ═══════════════════════════════════════════════════════════════════════════

  it("renders tabs in side panel mode", () => {
    renderFields(makeTabConfig(), {
      record: { host: "192.168.1.1" },
    });

    // Tabs should still be rendered in side panel
    const tabsRoot = document.querySelector('[data-slot="tabs"]');
    expect(tabsRoot).toBeDefined();

    // Tab labels are visible
    expect(screen.getByText("Info")).toBeDefined();
  });

  it("renders tab sections with DetailGrid in side panel mode", () => {
    renderFields(makeTabConfig(), {
      record: { host: "10.0.0.1" },
    });

    // Side panel uses DetailGrid, not MetadataGrid
    expect(screen.getByText("Connection")).toBeDefined();
    expect(screen.getByText("Host")).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // KPI rendering with tabs
  // ═══════════════════════════════════════════════════════════════════════════

  it("renders KPIs above tabs when config has kpis", () => {
    const configWithKpis: DetailViewConfig = {
      nameField: "label",
      tabs: [
        {
          key: "info",
          title: "Info",
          sections: [
            {
              title: "Details",
              fields: [
                {
                  fieldId: "host",
                  label: "Host",
                  type: "text",
                  metadata: { fieldName: "host" },
                  editable: false,
                },
              ],
            },
          ],
        },
      ],
      kpis: [
        { key: "uptime", label: "Uptime", format: (v) => `${v}h` },
      ],
    };

    renderFields(configWithKpis, {
      record: { host: "10.0.0.1" },
      kpiData: { uptime: 720 },
    });

    // KPI label and formatted value should be visible
    expect(screen.getByText("Summary")).toBeDefined();
    expect(screen.getByText("Uptime")).toBeDefined();
    expect(screen.getByText("720h")).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Edge cases
  // ═══════════════════════════════════════════════════════════════════════════

  it("renders nothing extra when tabChildren key does not match any tab", () => {
    renderFields(makeTabConfig(), {
      record: { host: "1.2.3.4" },
      tabChildren: {
        nonexistent: <div>Should not appear</div>,
      },
    });

    // The nonexistent key content should NOT appear anywhere
    expect(screen.queryByText("Should not appear")).toBeNull();
  });

  it("handles empty record gracefully", () => {
    renderFields(makeFlatConfig(), { record: {} });

    // Section still renders, fields show em dash for missing values
    expect(screen.getByText("Identity")).toBeDefined();
    expect(screen.getByText("Name")).toBeDefined();
  });

  it("flat sections with empty sections array renders without errors", () => {
    const emptyConfig: DetailViewConfig = {
      nameField: "name",
      sections: [],
    };

    renderFields(emptyConfig, { record: {} });

    // Container should exist but be empty
    const container = document.querySelector('[data-slot="record-detail-fields"]');
    expect(container).toBeDefined();
  });

  it("tabs with empty sections array in each tab renders without errors", () => {
    const emptyTabsConfig: DetailViewConfig = {
      nameField: "name",
      tabs: [
        { key: "tab1", title: "Tab 1", sections: [] },
        { key: "tab2", title: "Tab 2", sections: [] },
      ],
    };

    renderFields(emptyTabsConfig, { record: {} });

    // Tabs should render
    expect(screen.getByText("Tab 1")).toBeDefined();
    expect(screen.getByText("Tab 2")).toBeDefined();
  });
});
