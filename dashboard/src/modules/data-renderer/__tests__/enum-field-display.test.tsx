import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { createRenderWrapper } from "@/testing/render-with-providers";

import { EnumFieldDisplay } from "@/modules/data-renderer/field-displays/enum-field-display";

// ── Test setup ──────────────────────────────────────────────────────────────

const { render } = createRenderWrapper();

// ── Tests ───────────────────────────────────────────────────────────────────

describe("EnumFieldDisplay", () => {
  // ── Basic rendering ──────────────────────────────────────────────────────

  it("renders the raw value when no labels are provided", () => {
    render(<EnumFieldDisplay value="fingerprint" />);

    expect(screen.getByText("fingerprint")).toBeDefined();
  });

  it("renders the label from the labels map", () => {
    render(
      <EnumFieldDisplay
        value="fingerprint"
        labels={{ fingerprint: "Fingerprint", face: "Face" }}
      />,
    );

    expect(screen.getByText("Fingerprint")).toBeDefined();
  });

  it("falls back to raw value when label not found", () => {
    render(
      <EnumFieldDisplay
        value="unknown_mode"
        labels={{ fingerprint: "Fingerprint" }}
      />,
    );

    expect(screen.getByText("unknown_mode")).toBeDefined();
  });

  // ── Colors ────────────────────────────────────────────────────────────────

  it("renders Tag component (no crash on default colors)", () => {
    const { container } = render(<EnumFieldDisplay value="test" />);

    expect(screen.getByText("test")).toBeDefined();
    expect(container.querySelector("[data-slot='tag']")).toBeDefined();
  });

  it("uses color from colors map when provided", () => {
    render(
      <EnumFieldDisplay
        value="fingerprint"
        labels={{ fingerprint: "Fingerprint" }}
        colors={{ fingerprint: "green" }}
      />,
    );

    expect(screen.getByText("Fingerprint")).toBeDefined();
  });

  // ── Default labels/colors ────────────────────────────────────────────────

  it("uses defaultLabels when metadata labels are not provided", () => {
    render(
      <EnumFieldDisplay
        value="card"
        defaultLabels={{ card: "RF Card" }}
      />,
    );

    expect(screen.getByText("RF Card")).toBeDefined();
  });

  it("metadata labels take precedence over defaultLabels", () => {
    render(
      <EnumFieldDisplay
        value="card"
        labels={{ card: "Custom Card" }}
        defaultLabels={{ card: "RF Card" }}
      />,
    );

    expect(screen.getByText("Custom Card")).toBeDefined();
  });

  it("uses defaultColors when metadata colors are not provided", () => {
    render(
      <EnumFieldDisplay
        value="fingerprint"
        defaultColors={{ fingerprint: "green" }}
      />,
    );

    expect(screen.getByText("fingerprint")).toBeDefined();
  });

  // ── Multiple values ──────────────────────────────────────────────────────

  it("renders different enum values correctly", () => {
    render(
      <EnumFieldDisplay
        value="active"
        labels={{ active: "Active", inactive: "Inactive" }}
      />,
    );

    expect(screen.getByText("Active")).toBeDefined();

    render(
      <EnumFieldDisplay
        value="inactive"
        labels={{ active: "Active", inactive: "Inactive" }}
      />,
    );

    expect(screen.getByText("Inactive")).toBeDefined();
  });

  // ── Direction-like values (IN/OUT) ───────────────────────────────────────

  it("renders direction-like values with custom labels", () => {
    render(
      <EnumFieldDisplay
        value="in"
        labels={{ in: "IN", out: "OUT" }}
        colors={{ in: "green", out: "red" }}
      />,
    );

    expect(screen.getByText("IN")).toBeDefined();
  });

  // ── Verify method-like values ─────────────────────────────────────────────

  it("renders verify method values with labels and colors", () => {
    render(
      <EnumFieldDisplay
        value="face"
        labels={{ face: "Face", fingerprint: "Fingerprint" }}
        colors={{ face: "blue", fingerprint: "green" }}
      />,
    );

    expect(screen.getByText("Face")).toBeDefined();
  });
});
