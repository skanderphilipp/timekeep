import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { FilterDropdown } from "./filter-dropdown";
import { Wrapper, twoFields } from "./filter-dropdown-test-utils";

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

  it("handles empty fields array gracefully", () => {
    render(
      <Wrapper>
        <FilterDropdown fields={[]} />
      </Wrapper>,
    );

    expect(screen.getByRole("button", { name: /filter/i })).toBeInTheDocument();
  });
});
