import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { createRenderWrapper } from "@/testing/render-with-providers";

import { RecordDetailProvider } from "../states/record-detail-context";
import { RecordDetailFields } from "./record-detail-fields";
import type { DetailViewConfig } from "../entity-definitions/types";

/**
 * RED TEST: Empty reference field must allow click-to-edit.
 *
 * When a reference/FK field has no value assigned, the display shows "—".
 * Clicking it must enter inline edit mode so the user can pick a value
 * from the dropdown.
 *
 * Root cause: ReferenceFieldDisplay unconditionally calls stopPropagation(),
 * which blocks the InlineFieldEdit's edit trigger when there's nothing
 * to navigate to (entityId is empty).
 */

const { render } = createRenderWrapper();

afterEach(() => { vi.restoreAllMocks(); });

function renderFields(config: DetailViewConfig, record: Record<string, unknown> = {}) {
  return render(
    <RecordDetailProvider value={{ entityType: "department", entityId: "dept-1", isInSidePanel: false }}>
      <RecordDetailFields record={record} config={config} />
    </RecordDetailProvider>,
  );
}

const configWithEmptyRef: DetailViewConfig = {
  nameField: "name",
  sections: [{
    title: "Overview",
    fields: [{
      fieldId: "name",
      label: "Name",
      type: "text",
      metadata: { fieldName: "name" },
      editable: true,
    }, {
      fieldId: "work_policy_title",
      label: "Work Policy",
      type: "reference",
      metadata: {
        fieldName: "work_policy",
        referenceEntity: "work_policy",
        referenceIdField: "work_policy_id",
        displayField: "work_policy_title",
        options: [
          { value: "wp-1", label: "Standard 9-5" },
          { value: "wp-2", label: "Flexible Hours" },
        ],
      },
      editable: true,
    }],
  }],
};

describe("RecordDetailFields — empty reference field click-to-edit (RED)", () => {
  it("clicking the empty '—' on a reference field enters edit mode", async () => {
    // Department with NO work_policy assigned
    renderFields(configWithEmptyRef, {
      id: "dept-1",
      name: "Engineering",
      work_policy_id: undefined,
      work_policy_title: undefined,
    });

    // The display shows "\u2014" (em dash) for the empty work_policy field
    const emDash = screen.getByText("\u2014");
    expect(emDash).toBeDefined();

    // Click it — with the fix, plain text em dash has no stopPropagation
    // so the click bubbles up to InlineFieldEdit's edit trigger
    fireEvent.click(emDash);

    // After clicking, the Combobox should appear (edit mode entered)
    await waitFor(() => {
      const combobox = document.querySelector('[role="combobox"]');
      expect(combobox, "Combobox must appear after clicking empty reference field").toBeDefined();
    }, { timeout: 2000 });
  });

  it("clicking an assigned reference renders a Tag (not plain text)", async () => {
    // Department WITH a work_policy assigned
    renderFields(configWithEmptyRef, {
      id: "dept-1",
      name: "Engineering",
      work_policy_id: "wp-1",
      work_policy_title: "Standard 9-5",
    });

    // The display shows the policy name in a Tag (via ReferenceFieldDisplay)
    const policyTag = screen.getByText("Standard 9-5");
    expect(policyTag).toBeDefined();

    // Verify the Tag is interactive (rendered as <button> with onClick)
    const button = policyTag.closest("button");
    expect(button, "Assigned reference must render as interactive Tag button").toBeDefined();
  });

  it("clicking the whitespace around an assigned Tag enters edit mode", async () => {
    // Department WITH a work_policy assigned
    renderFields(configWithEmptyRef, {
      id: "dept-1",
      name: "Engineering",
      work_policy_id: "wp-1",
      work_policy_title: "Standard 9-5",
    });

    // Click the [role="button"] wrapper (not the Tag itself) — this enters edit
    const editButton = document.querySelector('[role="button"]') as HTMLElement;
    expect(editButton).toBeDefined();
    fireEvent.click(editButton);

    await waitFor(() => {
      const combobox = document.querySelector('[role="combobox"]');
      expect(combobox).toBeDefined();
    });
  });
});
