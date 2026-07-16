import { describe, it, expect } from "vitest";
import {
  isFieldText,
  isFieldNumber,
  isFieldTimestamp,
  isFieldStatus,
  isFieldEnum,
  isFieldReference,
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
      expect(isFieldText(makeField("number"))).toBe(false);
      expect(isFieldText(makeField("timestamp"))).toBe(false);
      expect(isFieldText(makeField("status"))).toBe(false);
      expect(isFieldText(makeField("reference"))).toBe(false);
    });
  });

  describe("isFieldNumber", () => {
    it("returns true for number fields", () => {
      expect(isFieldNumber(makeField("number"))).toBe(true);
    });

    it("returns false for non-number fields", () => {
      expect(isFieldNumber(makeField("text"))).toBe(false);
      expect(isFieldNumber(makeField("timestamp"))).toBe(false);
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
      expect(isFieldStatus(makeField("enum"))).toBe(false);
      expect(isFieldStatus(makeField("reference"))).toBe(false);
    });
  });

  describe("isFieldEnum", () => {
    it("returns true for enum fields", () => {
      expect(isFieldEnum(makeField("enum"))).toBe(true);
    });

    it("returns false for non-enum fields", () => {
      expect(isFieldEnum(makeField("text"))).toBe(false);
      expect(isFieldEnum(makeField("status"))).toBe(false);
    });
  });

  describe("isFieldReference", () => {
    it("returns true for reference fields", () => {
      expect(isFieldReference(makeField("reference"))).toBe(true);
    });

    it("returns false for non-reference fields", () => {
      expect(isFieldReference(makeField("text"))).toBe(false);
      expect(isFieldReference(makeField("status"))).toBe(false);
      expect(isFieldReference(makeField("enum"))).toBe(false);
    });
  });
});
