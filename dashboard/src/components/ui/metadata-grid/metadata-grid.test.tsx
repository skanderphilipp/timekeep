import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetadataGrid, type MetadataField } from "./metadata-grid";

describe("MetadataGrid", () => {
  const SIMPLE_FIELDS: MetadataField[] = [
    { key: "name", label: "Name", value: "Alice" },
    { key: "role", label: "Role", value: "Admin" },
  ];

  it("renders all visible fields", () => {
    render(<MetadataGrid fields={SIMPLE_FIELDS} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("renders field labels", () => {
    render(<MetadataGrid fields={SIMPLE_FIELDS} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
  });

  it("skips fields with hideIf: true", () => {
    const fields: MetadataField[] = [
      { key: "visible", label: "Visible", value: "Shown" },
      { key: "hidden", label: "Hidden", value: "Gone", hideIf: true },
    ];
    render(<MetadataGrid fields={fields} />);
    expect(screen.getByText("Shown")).toBeInTheDocument();
    expect(screen.queryByText("Gone")).not.toBeInTheDocument();
  });

  it("returns null when all fields are hidden", () => {
    const { container } = render(
      <MetadataGrid
        fields={[
          { key: "a", label: "A", value: "x", hideIf: true },
          { key: "b", label: "B", value: "y", hideIf: true },
        ]}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null for empty fields array", () => {
    const { container } = render(<MetadataGrid fields={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a title when provided", () => {
    render(<MetadataGrid fields={SIMPLE_FIELDS} title="Section" />);
    expect(screen.getByText("Section")).toBeInTheDocument();
  });

  it("renders multiple fields with mixed visibility", () => {
    const fields: MetadataField[] = [
      { key: "a", label: "Always", value: "Yes" },
      { key: "b", label: "Conditional", value: "No", hideIf: false },
      { key: "c", label: "Gone", value: "Nope", hideIf: true },
    ];
    render(<MetadataGrid fields={fields} />);
    expect(screen.getByText("Yes")).toBeInTheDocument();
    expect(screen.getByText("No")).toBeInTheDocument();
    expect(screen.queryByText("Nope")).not.toBeInTheDocument();
  });

  it("renders ReactNode values", () => {
    const fields: MetadataField[] = [
      { key: "badge", label: "Status", value: <span data-testid="custom-badge">Online</span> },
    ];
    render(<MetadataGrid fields={fields} />);
    expect(screen.getByTestId("custom-badge")).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
  });
});
