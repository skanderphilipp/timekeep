import { describe, it, expect } from "vitest";
import {
  isFieldText,
  isFieldDeviceSn,
  isFieldUserPin,
  isFieldTimestamp,
  isFieldStatus,
  isFieldDirection,
} from "../guards";
import type { FieldDefinition, FieldMetadata } from "../types";

describe("Field type guards", () => {
  const makeField = (type: string): FieldDefinition<FieldMetadata> => ({
    fieldId: "test",
    label: "Test",
    type: type as FieldDefinition<FieldMetadata>["type"],
    metadata: { fieldName: "test" } as FieldMetadata,
  });

  describe("isFieldText", () => {
    it("returns true for text fields", () => {
      expect(isFieldText(makeField("text"))).toBe(true);
    });

    it("returns false for non-text fields", () => {
      expect(isFieldText(makeField("device_sn"))).toBe(false);
      expect(isFieldText(makeField("timestamp"))).toBe(false);
      expect(isFieldText(makeField("status"))).toBe(false);
    });
  });

  describe("isFieldDeviceSn", () => {
    it("returns true for device_sn fields", () => {
      expect(isFieldDeviceSn(makeField("device_sn"))).toBe(true);
    });

    it("returns false for non-device_sn fields", () => {
      expect(isFieldDeviceSn(makeField("text"))).toBe(false);
      expect(isFieldDeviceSn(makeField("user_pin"))).toBe(false);
    });
  });

  describe("isFieldUserPin", () => {
    it("returns true for user_pin fields", () => {
      expect(isFieldUserPin(makeField("user_pin"))).toBe(true);
    });

    it("returns false for non-user_pin fields", () => {
      expect(isFieldUserPin(makeField("text"))).toBe(false);
      expect(isFieldUserPin(makeField("device_sn"))).toBe(false);
    });
  });

  describe("isFieldTimestamp", () => {
    it("returns true for timestamp fields", () => {
      expect(isFieldTimestamp(makeField("timestamp"))).toBe(true);
    });

    it("returns false for non-timestamp fields", () => {
      expect(isFieldTimestamp(makeField("text"))).toBe(false);
      expect(isFieldTimestamp(makeField("status"))).toBe(false);
    });
  });

  describe("isFieldStatus", () => {
    it("returns true for status fields", () => {
      expect(isFieldStatus(makeField("status"))).toBe(true);
    });

    it("returns false for non-status fields", () => {
      expect(isFieldStatus(makeField("text"))).toBe(false);
      expect(isFieldStatus(makeField("direction"))).toBe(false);
    });
  });

  describe("isFieldDirection", () => {
    it("returns true for direction fields", () => {
      expect(isFieldDirection(makeField("direction"))).toBe(true);
    });

    it("returns false for non-direction fields", () => {
      expect(isFieldDirection(makeField("text"))).toBe(false);
      expect(isFieldDirection(makeField("status"))).toBe(false);
    });
  });
});
