import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { FilterDropdown } from "./filter-dropdown";
import { Wrapper, makeChip, twoFields } from "./filter-dropdown-test-utils";

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
        <FilterDropdown fields={twoFields} hasActiveFilters onClear={vi.fn()} />
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
        <FilterDropdown fields={twoFields} actions={<button type="button">Columns</button>} />
      </Wrapper>,
    );

    expect(screen.getByRole("button", { name: "Columns" })).toBeInTheDocument();
  });

  // ── Popover (Step 1: field list) ──
});
