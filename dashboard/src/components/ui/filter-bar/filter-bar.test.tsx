import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { messages as enMessages } from "@/locales/en";
import userEvent from "@testing-library/user-event";

import { FilterBar, type ActiveFilter } from "./filter-bar";

i18n.load({ en: enMessages });
i18n.activate("en");

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

describe("FilterBar", () => {
  it("renders children inside the filter bar", () => {
    render(
      <Wrapper>
        <FilterBar>
          <input placeholder="Search…" readOnly />
        </FilterBar>
      </Wrapper>,
    );

    expect(screen.getByPlaceholderText("Search…")).toBeInTheDocument();
  });

  it("shows result count when provided", () => {
    render(
      <Wrapper>
        <FilterBar resultCount={42}>
          <span>filters</span>
        </FilterBar>
      </Wrapper>,
    );

    expect(screen.getByText(/42/)).toBeInTheDocument();
  });

  it("does not show count when not provided", () => {
    render(
      <Wrapper>
        <FilterBar>
          <span>filters</span>
        </FilterBar>
      </Wrapper>,
    );

    expect(screen.queryByText(/results/)).toBeNull();
  });

  it("shows reset button when hasActiveFilters and onClear provided", () => {
    const onClear = vi.fn();

    render(
      <Wrapper>
        <FilterBar onClear={onClear} hasActiveFilters>
          <span>filters</span>
        </FilterBar>
      </Wrapper>,
    );

    expect(screen.getByRole("button", { name: /reset/i })).toBeInTheDocument();
  });

  it("does not show reset button when hasActiveFilters is false", () => {
    render(
      <Wrapper>
        <FilterBar onClear={vi.fn()} hasActiveFilters={false}>
          <span>filters</span>
        </FilterBar>
      </Wrapper>,
    );

    expect(screen.queryByRole("button", { name: /reset/i })).toBeNull();
  });

  it("calls onClear when reset button is clicked", async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();

    render(
      <Wrapper>
        <FilterBar onClear={onClear} hasActiveFilters>
          <span>filters</span>
        </FilterBar>
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: /reset/i }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("renders active filter chips", () => {
    const filters: ActiveFilter[] = [
      { key: "pin", label: "PIN: 145", onRemove: vi.fn() },
      { key: "device", label: "SN: DEV-01", onRemove: vi.fn() },
    ];

    render(
      <Wrapper>
        <FilterBar activeFilters={filters}>
          <span>filters</span>
        </FilterBar>
      </Wrapper>,
    );

    expect(screen.getByText("PIN: 145")).toBeInTheDocument();
    expect(screen.getByText("SN: DEV-01")).toBeInTheDocument();
  });

  it("calls onRemove when a filter chip is clicked", async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    const filters: ActiveFilter[] = [
      { key: "pin", label: "PIN: 145", onRemove },
    ];

    render(
      <Wrapper>
        <FilterBar activeFilters={filters}>
          <span>filters</span>
        </FilterBar>
      </Wrapper>,
    );

    const chipButtons = screen.getAllByRole("button");
    const removeBtn = chipButtons.find((btn) =>
      btn.getAttribute("aria-label")?.includes("Remove"),
    );
    expect(removeBtn).toBeDefined();
    await user.click(removeBtn!);

    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("renders search section when search prop is provided", () => {
    render(
      <Wrapper>
        <FilterBar search={<input placeholder="Global search…" readOnly />}>
          <span>filters</span>
        </FilterBar>
      </Wrapper>,
    );

    expect(screen.getByPlaceholderText("Global search…")).toBeInTheDocument();
    const searchSection = document.querySelector('[data-slot="filter-bar-search"]');
    expect(searchSection).toBeInTheDocument();
  });

  it("renders custom actions when actions prop is provided", () => {
    render(
      <Wrapper>
        <FilterBar actions={<button type="button">Export</button>}>
          <span>filters</span>
        </FilterBar>
      </Wrapper>,
    );

    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });

  it("applies sticky CSS class when sticky prop is set", () => {
    const { container } = render(
      <Wrapper>
        <FilterBar sticky>
          <span>filters</span>
        </FilterBar>
      </Wrapper>,
    );

    const root = container.querySelector('[data-slot="filter-bar"]') as HTMLElement;
    expect(root).not.toBeNull();
    // CSS Modules may mangle class names — verify sticky class is present
    expect(root!.className).toContain("sticky");
  });

  it("does not apply sticky CSS class by default", () => {
    const { container } = render(
      <Wrapper>
        <FilterBar>
          <span>filters</span>
        </FilterBar>
      </Wrapper>,
    );

    const root = container.querySelector('[data-slot="filter-bar"]') as HTMLElement;
    expect(root!.className).not.toContain("sticky");
  });
});
