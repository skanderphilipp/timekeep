import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FilterDropdown } from "./filter-dropdown";
import { Wrapper, twoFields } from "./filter-dropdown-test-utils";

describe("FilterDropdown interactions", () => {
  it("opens popover with field list when filter button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <FilterDropdown fields={twoFields} />
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: /filter/i }));

    expect(screen.getByText("Filter by")).toBeInTheDocument();
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

  it("transitions to value selector when a field is clicked", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <FilterDropdown fields={twoFields} />
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: /filter/i }));
    await user.click(screen.getByText("Status"));

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
    await user.click(screen.getByTestId("back-status"));

    expect(screen.getByText("Filter by")).toBeInTheDocument();
    expect(screen.queryByTestId("value-status")).toBeNull();
  });

  it("closes popover when clicking outside", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <div data-testid="outside">Outside content</div>
        <FilterDropdown fields={twoFields} />
      </Wrapper>,
    );

    await user.click(screen.getByRole("button", { name: /filter/i }));
    expect(screen.getByText("Filter by")).toBeInTheDocument();

    // Click outside the popover — base-ui handles dismiss via outside press
    await user.click(screen.getByTestId("outside"));

    expect(screen.queryByText("Filter by")).toBeNull();
  });

  it("applies open state to filter button when popover is visible", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <FilterDropdown fields={twoFields} />
      </Wrapper>,
    );

    const filterButton = screen.getByRole("button", { name: /filter/i });
    // base-ui manages aria-expanded on the Popover.Trigger button
    expect(filterButton.getAttribute("aria-expanded")).toBe("false");

    await user.click(filterButton);
    expect(filterButton.getAttribute("aria-expanded")).toBe("true");
  });
});
