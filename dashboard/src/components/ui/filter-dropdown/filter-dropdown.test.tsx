import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { messages as enMessages } from "@/locales/en";
import userEvent from "@testing-library/user-event";

import { FilterDropdown, type FilterChip, type FilterField } from "./filter-dropdown";

i18n.load({ en: enMessages });
i18n.activate("en");

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeField(key: string, label: string): FilterField {
  return {
    key,
    label,
    renderValueSelector: ({ onBack }) => (
      <div data-testid={`value-${key}`}>
        <span>Value selector for {label}</span>
        <button type="button" onClick={onBack} data-testid={`back-${key}`}>
          Back
        </button>
      </div>
    ),
  };
}

function makeChip(key: string, label: string, onRemove = vi.fn()): FilterChip {
  return { key, label, onRemove };
}

const twoFields = [makeField("status", "Status"), makeField("date", "Date")];

// ── Tests ────────────────────────────────────────────────────────────────────

describe("FilterDropdown", () => {
  // ── Rendering ──

  it("renders the filter button", () => {
    render(
      <Wrapper>
        <FilterDropdown fields={twoFields} />
      </Wrapper>,
    );

    expect(screen.getByRole("button", { name: /filter/i })).toBeInTheDocument();
  });

  it("does not show reset button when no active filters", () => {
    render(
      <Wrapper>
        <FilterDropdown fields={twoFields} />
      </Wrapper>,
    );

    expect(screen.queryByRole("button", { name: /reset/i })).toBeNull();
  });

  it("shows reset button when hasActiveFilters and onClear provided", () => {
    render(
      <Wrapper>
        <FilterDropdown
          fields={twoFields}
          hasActiveFilters
          onClear={vi.fn()}
        />
      </Wrapper>,
    );

    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  it("shows result count when provided", () => {
    render(
      <Wrapper>
        <FilterDropdown fields={twoFields} resultCount={42} />
      </Wrapper>,
    );

    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it("renders active filter chips", () => {
    const chips = [makeChip("status", "Status: Check In"), makeChip("device", "Device: Main Gate")];

    render(
      <Wrapper>
        <FilterDropdown fields={twoFields} activeFilters={chips} />
      </Wrapper>,
    );

    expect(screen.getByText("Status: Check In")).toBeInTheDocument();
    expect(screen.getByText("Device: Main Gate")).toBeInTheDocument();
  });

  it("renders custom actions slot", () => {
    render(
      <Wrapper>
        <FilterDropdown
          fields={twoFields}
          actions={<button type="button">Columns</button>}
        />
      </Wrapper>,
    );

    expect(screen.getByRole("button", { name: "Columns" })).toBeInTheDocument();
  });

  // ── Popover (Step 1: field list) ──

  it("opens popover with field list when filter button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <FilterDropdown fields={twoFields} />
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: /filter/i }));

    // Field list header
    expect(screen.getByText("Filter by")).toBeInTheDocument();
    // Field items
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
  });

  it("toggles popover closed when filter button is clicked again", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <FilterDropdown fields={twoFields} />
      </Wrapper>,
    );

    const filterButton = screen.getByRole("button", { name: /filter/i });

    await user.click(filterButton);
    expect(screen.getByText("Filter by")).toBeInTheDocument();

    await user.click(filterButton);
    expect(screen.queryByText("Filter by")).toBeNull();
  });

  // ── Step 2: value selector ──

  it("transitions to value selector when a field is clicked", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <FilterDropdown fields={twoFields} />
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: /filter/i }));
    await user.click(screen.getByText("Status"));

    // Should now show the value selector, not the field list
    expect(screen.queryByText("Filter by")).toBeNull();
    expect(screen.getByTestId("value-status")).toBeInTheDocument();
  });

  it("returns to field list when back button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <FilterDropdown fields={twoFields} />
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: /filter/i }));
    await user.click(screen.getByText("Status"));

    // Click back button in the value selector
    await user.click(screen.getByTestId("back-status"));

    // Should return to field list
    expect(screen.getByText("Filter by")).toBeInTheDocument();
    expect(screen.queryByTestId("value-status")).toBeNull();
  });

  // ── Chip removal ──

  it("calls onRemove when a chip remove button is clicked", async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    const chips = [makeChip("status", "Status: Check In", onRemove)];

    render(
      <Wrapper>
        <FilterDropdown fields={twoFields} activeFilters={chips} />
      </Wrapper>,
    );

    // Find the remove button — the chip HTML is:
    // <span class="chip"><span class="chipLabel">...</span><button class="chipRemove">...</button></span>
    const labelSpan = screen.getByText("Status: Check In");
    const chipSpan = labelSpan.parentElement!;
    const removeBtn = within(chipSpan).getByRole("button");
    await user.click(removeBtn);

    expect(onRemove).toHaveBeenCalledOnce();
  });

  // ── Reset ──

  it("calls onClear when reset button is clicked", async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();

    render(
      <Wrapper>
        <FilterDropdown
          fields={twoFields}
          hasActiveFilters
          onClear={onClear}
        />
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: /reset/i }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  // ── Backdrop closes popover ──

  it("closes popover when backdrop is clicked", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <FilterDropdown fields={twoFields} />
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: /filter/i }));
    expect(screen.getByText("Filter by")).toBeInTheDocument();

    // Click the backdrop
    const backdrop = document.querySelector('[aria-hidden="true"]')!;
    await user.click(backdrop);

    expect(screen.queryByText("Filter by")).toBeNull();
  });

  // ── Edge cases ──

  it("handles empty fields array gracefully", () => {
    render(
      <Wrapper>
        <FilterDropdown fields={[]} />
      </Wrapper>,
    );

    // Filter button still renders
    expect(screen.getByRole("button", { name: /filter/i })).toBeInTheDocument();
  });

  it("does not render chips row when activeFilters is empty array", () => {
    render(
      <Wrapper>
        <FilterDropdown fields={twoFields} activeFilters={[]} />
      </Wrapper>,
    );

    // No chip elements should be present
    const chipContainer = document.querySelector('[class*="chips"]');
    expect(chipContainer).toBeNull();
  });

  it("does not render chips row when activeFilters is undefined", () => {
    render(
      <Wrapper>
        <FilterDropdown fields={twoFields} />
      </Wrapper>,
    );

    const chipContainer = document.querySelector('[class*="chips"]');
    expect(chipContainer).toBeNull();
  });

  it("applies open state class to filter button when popover is open", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <FilterDropdown fields={twoFields} />
      </Wrapper>,
    );

    const filterButton = screen.getByRole("button", { name: /filter/i });

    // Initially not open
    expect(filterButton.getAttribute("aria-expanded")).toBe("false");

    await user.click(filterButton);
    expect(filterButton.getAttribute("aria-expanded")).toBe("true");
  });
});
