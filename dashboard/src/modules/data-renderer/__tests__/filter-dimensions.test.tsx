import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { Provider as JotaiProvider, createStore } from "jotai";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";

import { FilterDropdown } from "@/components/ui/filter-dropdown/filter-dropdown";
import type { FilterField } from "@/components/ui/filter-dropdown/filter-dropdown";
import { renderFilterDimensions } from "@/modules/data-renderer/components/filter-field-renderers";
import type {
  FilterDimensionMeta,
  FilterRenderContext,
} from "@/modules/data-renderer/hooks/use-filter-fields";

// ── Wrapper ──────────────────────────────────────────────────────────────

function Wrapper({ children }: { children: ReactNode }) {
  const store = createStore();
  return (
    <JotaiProvider store={store}>
      <I18nProvider i18n={i18n}>
        <BrowserRouter>{children}</BrowserRouter>
      </I18nProvider>
    </JotaiProvider>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────

function createMockContext(
  overrides: Partial<FilterRenderContext> = {},
): FilterRenderContext {
  return {
    values: {},
    handlers: {},
    enumOptions: {},
    ...overrides,
  };
}

const statusDim: FilterDimensionMeta = {
  field: "status",
  label: "Status",
  facetKind: "enum",
  uiKind: "enum",
};

const verifyDim: FilterDimensionMeta = {
  field: "verify_mode",
  label: "Method",
  facetKind: "enum",
  uiKind: "enum",
};

const deviceDim: FilterDimensionMeta = {
  field: "device_sn",
  label: "Device",
  facetKind: "reference",
  uiKind: "reference",
};

const dateDim: FilterDimensionMeta = {
  field: "date_range",
  label: "Date Range",
  facetKind: null,
  uiKind: "date-range",
};

const toggleDim: FilterDimensionMeta = {
  field: "anomalies_only",
  label: "Anomalies",
  facetKind: null,
  uiKind: "toggle",
};

// ── renderFilterDimensions ───────────────────────────────────────────────

describe("renderFilterDimensions", () => {
  describe("enum dimensions", () => {
    it("creates a filter field with the correct key and label", () => {
      const context = createMockContext({
        enumOptions: {
          status: [
            { value: "", label: "All Statuses" },
            { value: "check_in", label: "Check In" },
            { value: "check_out", label: "Check Out" },
          ],
        },
        handlers: { status: vi.fn() },
      });

      const fields = renderFilterDimensions([statusDim], context);
      expect(fields).toHaveLength(1);
      expect(fields[0].key).toBe("status");
      expect(fields[0].label).toBe("Status");
    });

    it("skips dimensions without enumOptions", () => {
      const context = createMockContext({ enumOptions: {} });
      const fields = renderFilterDimensions([statusDim], context);
      expect(fields).toHaveLength(0);
    });

    it("skips dimensions with empty enumOptions", () => {
      const context = createMockContext({ enumOptions: { status: [] } });
      const fields = renderFilterDimensions([statusDim], context);
      expect(fields).toHaveLength(0);
    });

    it("calls the handler when a value is selected via the Select", async () => {
      const handleStatus = vi.fn();
      const context = createMockContext({
        values: { status: "" },
        enumOptions: {
          status: [
            { value: "", label: "All Statuses" },
            { value: "check_in", label: "Check In" },
          ],
        },
        handlers: { status: handleStatus },
      });

      const fields = renderFilterDimensions([statusDim], context);
      const user = userEvent.setup();

      render(
        <Wrapper>
          <FilterDropdown fields={fields} />
        </Wrapper>,
      );

      // Open filter dropdown
      await user.click(screen.getByRole("button", { name: /filter/i }));

      // Select "Status" field from the dropdown list
      await user.click(screen.getByText("Status"));

      // The value selector panel now shows a Select.
      // Click its trigger (showing current value "All Statuses") to open the popup.
      const selectTrigger = screen.getByText("All Statuses");
      await user.click(selectTrigger);

      // Select "Check In" from the open popup (rendered in a portal)
      const checkInOption = screen.getByText("Check In");
      await user.click(checkInOption);

      expect(handleStatus).toHaveBeenCalledWith("check_in");
    });
  });

  describe("toggle dimensions", () => {
    it("creates a filter field for toggle type", () => {
      const handleToggle = vi.fn();
      const context = createMockContext({
        toggles: {
          anomalies_only: {
            checked: false,
            onChange: handleToggle,
            label: "Show only anomalous punches",
          },
        },
      });

      const fields = renderFilterDimensions([toggleDim], context);
      expect(fields).toHaveLength(1);
      expect(fields[0].key).toBe("anomalies_only");
    });

    it("skips toggle without matching context entry", () => {
      const context = createMockContext({ toggles: {} });
      const fields = renderFilterDimensions([toggleDim], context);
      expect(fields).toHaveLength(0);
    });
  });

  describe("date-range dimensions", () => {
    it("creates a filter field for date-range type", () => {
      const context = createMockContext({
        dateRange: {
          from: null,
          to: null,
          onChange: vi.fn(),
        },
      });

      const fields = renderFilterDimensions([dateDim], context);
      expect(fields).toHaveLength(1);
      expect(fields[0].key).toBe("date_range");
    });

    it("skips date-range without dateRange context", () => {
      const context = createMockContext({});
      const fields = renderFilterDimensions([dateDim], context);
      expect(fields).toHaveLength(0);
    });
  });

  describe("reference dimensions", () => {
    it("creates a filter field for reference type with facetSearch", () => {
      const context = createMockContext({
        values: { device_sn: "" },
        handlers: { device_sn: vi.fn() },
        enumOptions: {},
        facetSearch: {
          device_sn: {
            entity: "punch",
            dimension: "device_sn",
            context: {},
          },
        },
      });

      const fields = renderFilterDimensions([deviceDim], context);
      expect(fields).toHaveLength(1);
      expect(fields[0].key).toBe("device_sn");
    });

    it("falls back to enumOptions for reference without facetSearch", () => {
      const context = createMockContext({
        values: { device_sn: "" },
        handlers: { device_sn: vi.fn() },
        enumOptions: {
          device_sn: [
            { value: "", label: "All Devices" },
            { value: "DEV-001", label: "Office Entrance" },
          ],
        },
      });

      const fields = renderFilterDimensions([deviceDim], context);
      expect(fields).toHaveLength(1);
    });

    it("creates a field but renders null when no options available", () => {
      const context = createMockContext({
        values: {},
        handlers: {},
        enumOptions: {},
      });

      const fields = renderFilterDimensions([deviceDim], context);
      expect(fields).toHaveLength(1);
      // The value selector renders null when there's nothing to show
      const selector = fields[0].renderValueSelector({
        onApply: () => {},
        onBack: () => {},
      });
      expect(selector).toBeNull();
    });
  });

  describe("multiple dimensions", () => {
    it("returns multiple fields, skipping those without required context", () => {
      const context = createMockContext({
        enumOptions: {
          status: [{ value: "check_in", label: "Check In" }],
          // verify_mode intentionally NOT provided
        },
        handlers: { status: vi.fn() },
        toggles: {
          anomalies_only: {
            checked: false,
            onChange: vi.fn(),
            label: "Show only anomalous",
          },
        },
        dateRange: { from: null, to: null, onChange: vi.fn() },
      });

      const fields = renderFilterDimensions(
        [statusDim, verifyDim, toggleDim, dateDim],
        context,
      );

      // verify_dim skipped (no enumOptions), other 3 render
      expect(fields).toHaveLength(3);
      expect(fields.map((f) => f.key)).toEqual([
        "status",
        "anomalies_only",
        "date_range",
      ]);
    });
  });
});

// ── FilterDropdown ────────────────────────────────────────────────────────

describe("FilterDropdown", () => {
  const mockFields: FilterField[] = [
    {
      key: "status",
      label: "Status",
      renderValueSelector: ({ onApply, onBack }) => (
        <div>
          <button onClick={onBack}>Back</button>
          <button onClick={() => onApply()}>Apply</button>
        </div>
      ),
    },
    {
      key: "device",
      label: "Device",
      renderValueSelector: ({ onApply }) => (
        <button onClick={() => onApply()}>Select Device</button>
      ),
    },
  ];

  it("renders the filter button", () => {
    render(
      <Wrapper>
        <FilterDropdown fields={mockFields} />
      </Wrapper>,
    );

    expect(
      screen.getByRole("button", { name: /filter/i }),
    ).toBeInTheDocument();
  });

  it("shows field list when filter button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <FilterDropdown fields={mockFields} />
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: /filter/i }));

    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Device")).toBeInTheDocument();
  });

  it("shows value selector when a field is selected", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <FilterDropdown fields={mockFields} />
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: /filter/i }));
    await user.click(screen.getByText("Status"));

    expect(screen.getByText("Apply")).toBeInTheDocument();
  });

  it("closes the dropdown when onApply is called", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <FilterDropdown fields={mockFields} />
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: /filter/i }));
    await user.click(screen.getByText("Status"));
    await user.click(screen.getByText("Apply"));

    // After apply, dropdown is closed
    expect(screen.queryByText("Status")).not.toBeInTheDocument();
  });

  it("returns to field list when back is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <FilterDropdown fields={mockFields} />
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: /filter/i }));
    await user.click(screen.getByText("Status"));
    await user.click(screen.getByText("Back"));

    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Device")).toBeInTheDocument();
  });

  it("closes when clicking the backdrop", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <FilterDropdown fields={mockFields} />
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: /filter/i }));

    const backdrop = document.querySelector('[aria-hidden="true"]');
    expect(backdrop).toBeInTheDocument();
    if (backdrop) await user.click(backdrop);

    expect(screen.queryByText("Status")).not.toBeInTheDocument();
  });

  it("handles empty fields array gracefully", () => {
    render(
      <Wrapper>
        <FilterDropdown fields={[]} />
      </Wrapper>,
    );

    expect(
      screen.getByRole("button", { name: /filter/i }),
    ).toBeInTheDocument();
  });
});
