import { describe, it, expect } from "vitest";
import { parseIpPort } from "./ip-port-input";
import { DEFAULT_ZKTECO_PORT } from "@/lib/constants";

describe("parseIpPort", () => {
  it("parses a valid ip:port string", () => {
    const result = parseIpPort("192.168.1.100:4370");
    expect(result).toEqual({ ip: "192.168.1.100", port: 4370 });
  });

  it("parses ip and port separated by space", () => {
    const result = parseIpPort("10.0.0.1 8080");
    expect(result).toEqual({ ip: "10.0.0.1", port: 8080 });
  });

  it("parses IP only and defaults to ZKTeco port", () => {
    const result = parseIpPort("192.168.1.100");
    expect(result).toEqual({ ip: "192.168.1.100", port: DEFAULT_ZKTECO_PORT });
  });

  it("returns null for empty string", () => {
    expect(parseIpPort("")).toBeNull();
  });

  it("returns null for whitespace only", () => {
    expect(parseIpPort("   ")).toBeNull();
  });

  it("returns null for invalid IP", () => {
    expect(parseIpPort("999.999.999.999:4370")).toBeNull();
  });

  it("returns null for missing port after colon", () => {
    expect(parseIpPort("192.168.1.100:")).toBeNull();
  });

  it("returns null for non-numeric port", () => {
    expect(parseIpPort("192.168.1.100:abc")).toBeNull();
  });

  it("clamps port to valid range", () => {
    // Port 99999 is 5 digits (matches \d{1,5}) and gets clamped to 65535
    const result = parseIpPort("192.168.1.100:99999");
    expect(result).toEqual({ ip: "192.168.1.100", port: 65535 });
  });

  it("trims whitespace around input", () => {
    const result = parseIpPort("  192.168.1.100:4370  ");
    expect(result).toEqual({ ip: "192.168.1.100", port: 4370 });
  });

  it("handles localhost IP", () => {
    const result = parseIpPort("127.0.0.1:3000");
    expect(result).toEqual({ ip: "127.0.0.1", port: 3000 });
  });

  it("handles zero-padded octets (regex allows them)", () => {
    // The IPv4 regex pattern allows zero-padded octets like "001"
    const result = parseIpPort("192.168.001.001:4370");
    expect(result).toEqual({ ip: "192.168.001.001", port: 4370 });
  });

  it("handles null byte injection safely", () => {
    const result = parseIpPort("192.168.1.1\0:4370");
    expect(result).toBeNull();
  });
});
