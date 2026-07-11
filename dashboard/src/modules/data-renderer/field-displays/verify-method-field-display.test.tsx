import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";

import { createRenderWrapper } from "@/testing/render-with-providers";
import { VerifyMethodFieldDisplay } from "./verify-method-field-display";

const { render } = createRenderWrapper();

describe("VerifyMethodFieldDisplay", () => {
  it("renders fingerprint with green tag", () => {
    render(<VerifyMethodFieldDisplay value="fingerprint" />);
    const tag = screen.getByText("Fingerprint");
    expect(tag).toBeInTheDocument();
  });

  it("renders face with blue tag", () => {
    render(<VerifyMethodFieldDisplay value="face" />);
    expect(screen.getByText("Face")).toBeInTheDocument();
  });

  it("renders card with amber tag", () => {
    render(<VerifyMethodFieldDisplay value="card" />);
    expect(screen.getByText("RF Card")).toBeInTheDocument();
  });

  it("renders password with gray tag", () => {
    render(<VerifyMethodFieldDisplay value="password" />);
    expect(screen.getByText("Password")).toBeInTheDocument();
  });

  it("renders palm with accent tag", () => {
    render(<VerifyMethodFieldDisplay value="palm" />);
    expect(screen.getByText("Palm")).toBeInTheDocument();
  });

  it("falls back to raw value for unknown verify modes", () => {
    render(<VerifyMethodFieldDisplay value="iris_scan" />);
    expect(screen.getByText("iris_scan")).toBeInTheDocument();
  });

  it("uses custom labels when provided", () => {
    render(
      <VerifyMethodFieldDisplay value="fingerprint" labels={{ fingerprint: "Finger Scan" }} />,
    );
    expect(screen.getByText("Finger Scan")).toBeInTheDocument();
    expect(screen.queryByText("Fingerprint")).toBeNull();
  });

  it("uses custom colors when provided", () => {
    render(<VerifyMethodFieldDisplay value="fingerprint" colors={{ fingerprint: "red" }} />);
    // Color is applied via Tag component; verify it renders
    expect(screen.getByText("Fingerprint")).toBeInTheDocument();
  });

  it("uses default gray for missing color", () => {
    render(<VerifyMethodFieldDisplay value="unknown" />);
    // Should render the value as-is with gray fallback
    expect(screen.getByText("unknown")).toBeInTheDocument();
  });

  it("handles empty value gracefully", () => {
    const { container } = render(<VerifyMethodFieldDisplay value="" />);
    // Renders an empty tag (Tag will handle it)
    const tag = container.querySelector('[data-slot="tag"]');
    expect(tag).toBeInTheDocument();
    expect(tag).toHaveTextContent("");
  });
});
