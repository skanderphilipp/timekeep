/**
 * Unit tests for IpInput and IpPortInput components.
 *
 * These would have caught Bug #1: IP/Port Input Validation Broken.
 * The bug was that `onAccept` passed `mask.unmaskedValue` (dots stripped)
 * to `isValidIpv4()`, which expects dotted format.
 *
 * Fix verified: `mask.value` (with dots) is now used.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";

import { IpInput, isValidIpv4 } from "@/components/ui/ip-input";
import { IpPortInput } from "@/components/ui/ip-port-input";

// ─── Lingui wrapper: needed because IpPortInput uses useLingui() ──────

function withLingui(ui: React.ReactElement) {
  // i18n is already loaded with English messages in vitest.setup.ts
  return <I18nProvider i18n={i18n}>{ui}</I18nProvider>;
}

// ─── isValidIpv4 Unit Tests ──────────────────────────────────────────

describe("isValidIpv4", () => {
  it("accepts valid IPv4 addresses", () => {
    expect(isValidIpv4("192.168.1.1")).toBe(true);
    expect(isValidIpv4("10.0.0.1")).toBe(true);
    expect(isValidIpv4("255.255.255.255")).toBe(true);
    expect(isValidIpv4("0.0.0.0")).toBe(true);
    expect(isValidIpv4("100.64.0.16")).toBe(true);
    expect(isValidIpv4("88.201.39.242")).toBe(true);
  });

  it("rejects incomplete addresses without dots", () => {
    // This is the bug scenario: unmasked value like "19216810074"
    // The bug was that onAccept passed mask.unmaskedValue (dots stripped)
    // to isValidIpv4, which expects dotted format. The fix uses mask.value.
    expect(isValidIpv4("19216810074")).toBe(false);
    expect(isValidIpv4("192168174")).toBe(false);
  });

  it("rejects out-of-range octets", () => {
    expect(isValidIpv4("256.0.0.0")).toBe(false);
    expect(isValidIpv4("192.168.300.1")).toBe(false);
  });

  it("rejects non-IP strings", () => {
    expect(isValidIpv4("")).toBe(false);
    expect(isValidIpv4("not-an-ip")).toBe(false);
    expect(isValidIpv4("192.168.1")).toBe(false); // only 3 octets
  });

  it("accepts leading zeros in octets (current regex behavior)", () => {
    // The regex `[01]?\d\d?` allows patterns like 01, 001, 099.
    // The doc comment says leading zeros are NOT allowed but the regex
    // permits them. This is a known laxity — devices still work.
    expect(isValidIpv4("192.168.001.001")).toBe(true);
    expect(isValidIpv4("192.168.1.01")).toBe(true);
  });
});

// ─── IpInput Component Tests ─────────────────────────────────────────

describe("IpInput", () => {
  it("renders an input field", () => {
    render(<IpInput placeholder="Enter IP" />);
    const input = screen.getByPlaceholderText("Enter IP");
    expect(input).toBeInTheDocument();
  });

  it("renders label when provided", () => {
    render(<IpInput label="Device IP" />);
    expect(screen.getByText("Device IP")).toBeInTheDocument();
  });

  it("renders error message when provided", () => {
    render(<IpInput error="Invalid IP address" />);
    expect(screen.getByText("Invalid IP address")).toBeInTheDocument();
  });

  it("renders helper text when no error", () => {
    render(<IpInput helperText="e.g. 192.168.1.100" />);
    expect(screen.getByText("e.g. 192.168.1.100")).toBeInTheDocument();
  });

  it("hides helper text when error is shown", () => {
    render(<IpInput error="Error" helperText="Helper" />);
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.queryByText("Helper")).not.toBeInTheDocument();
  });
});

// ─── IpPortInput Component Tests ─────────────────────────────────────

describe("IpPortInput", () => {
  it("renders IP and port input fields", () => {
    render(withLingui(<IpPortInput />));
    // The component renders two input fields
    const inputs = screen.getAllByRole("textbox");
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it("renders label when provided", () => {
    render(withLingui(<IpPortInput label="Device Address" />));
    expect(screen.getByText("Device Address")).toBeInTheDocument();
  });

  it("renders error message", () => {
    render(withLingui(<IpPortInput error="Host is required" />));
    expect(screen.getByText("Host is required")).toBeInTheDocument();
  });

  it("calls onChange with IP and port when user types a valid IP", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(withLingui(<IpPortInput onChange={onChange} />));

    const inputs = screen.getAllByRole("textbox");
    const ipInput = inputs[0]; // First input is IP

    // Type a valid IP — the mask will format it with dots
    await user.click(ipInput);
    await user.keyboard("19216810074"); // Simulate typing raw digits

    // onChange should have been called with the formatted IP
    const calls = onChange.mock.calls;
    expect(calls.length).toBeGreaterThan(0);

    // The LAST call should contain a valid IP (the bug was that it stayed empty)
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.ip).not.toBe("");
    expect(isValidIpv4(lastCall.ip)).toBe(true);
  });

  it("calls onChange with empty ip when invalid input is entered", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(withLingui(<IpPortInput onChange={onChange} />));

    const inputs = screen.getAllByRole("textbox");
    const ipInput = inputs[0];

    await user.click(ipInput);
    await user.keyboard("999"); // Incomplete IP

    expect(onChange).toHaveBeenCalled();
    // The IP should be empty for incomplete input
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.ip).toBe("");
  });
});
