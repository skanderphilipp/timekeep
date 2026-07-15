import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { messages as enMessages } from "@/locales/en";

import { SidePanelFormContainer } from "./side-panel-form-container";

// ── Lingui setup ────────────────────────────────────────────────────────────

i18n.load({ en: enMessages });
i18n.activate("en");

function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function renderContainer(props: Partial<React.ComponentProps<typeof SidePanelFormContainer>> = {}) {
  return render(
    <Wrapper>
      <SidePanelFormContainer
        title="Test Form"
        onCancel={vi.fn()}
        {...props}
      >
        <p>Form content</p>
      </SidePanelFormContainer>
    </Wrapper>,
  );
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("SidePanelFormContainer", () => {
  // ── Header ──────────────────────────────────────────────────────────────

  it("renders the title", () => {
    renderContainer({ title: "Edit Department" });
    expect(screen.getByText("Edit Department")).toBeInTheDocument();
  });

  it("renders a description when provided", () => {
    renderContainer({ description: "Update department details." });
    expect(screen.getByText("Update department details.")).toBeInTheDocument();
  });

  it("does not render a description element when not provided", () => {
    const { container } = renderContainer({ description: undefined });
    // The description paragraph should not exist
    expect(container.querySelector('[data-slot]')).toBeTruthy(); // sanity: container rendered
    // Description is a <p> with specific class — absence of text is the test
    const paragraphs = container.querySelectorAll("p");
    const descriptionParagraphs = Array.from(paragraphs).filter(
      (p) => p.textContent !== "Form content",
    );
    expect(descriptionParagraphs).toHaveLength(0);
  });

  // ── Loading state ────────────────────────────────────────────────────────

  it("shows a spinner when isLoading is true", () => {
    renderContainer({ isLoading: true });
    expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
  });

  it("does not render form content when loading", () => {
    renderContainer({ isLoading: true });
    expect(screen.queryByText("Form content")).not.toBeInTheDocument();
  });

  it("still shows the title when loading", () => {
    renderContainer({ isLoading: true, title: "Loading Form" });
    expect(screen.getByText("Loading Form")).toBeInTheDocument();
  });

  // ── Error state ──────────────────────────────────────────────────────────

  it("shows an error banner when error is provided", () => {
    renderContainer({ error: "Something went wrong" });
    const banner = screen.getByRole("alert");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent("Something went wrong");
  });

  it("does not show an error banner when error is null", () => {
    renderContainer({ error: null });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders error banner with danger variant", () => {
    renderContainer({ error: "Validation failed" });
    const banner = screen.getByRole("alert");
    expect(banner.getAttribute("data-variant")).toBe("danger");
  });

  // ── Footer buttons ───────────────────────────────────────────────────────

  it("renders Cancel and Save buttons", () => {
    renderContainer();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("calls onCancel when the Cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderContainer({ onCancel });

    await user.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("renders the Save button with type=submit and form=side-panel-form", () => {
    renderContainer();
    // The Button component renders a <button> element with [data-slot="button"]
    const saveButton = screen.getByText("Save").closest("button");
    expect(saveButton).not.toBeNull();
    expect(saveButton!.getAttribute("type")).toBe("submit");
    expect(saveButton!.getAttribute("form")).toBe("side-panel-form");
  });

  it("uses a custom saveLabel when provided", () => {
    renderContainer({ saveLabel: "Create Department" });
    expect(screen.getByText("Create Department")).toBeInTheDocument();
    expect(screen.queryByText("Save")).not.toBeInTheDocument();
  });

  // ── Pending state ────────────────────────────────────────────────────────

  it("disables the Cancel button when isPending is true", () => {
    renderContainer({ isPending: true });
    const cancelButton = screen.getByText("Cancel").closest("button");
    expect(cancelButton).not.toBeNull();
    expect(cancelButton).toBeDisabled();
  });

  it("shows loading state on the Save button when isPending is true", () => {
    renderContainer({ isPending: true });
    const saveButton = screen.getByText("Save");
    expect(saveButton.closest("[data-loading]")).not.toBeNull();
  });

  // ── Content rendering ────────────────────────────────────────────────────

  it("renders children as form content", () => {
    renderContainer();
    expect(screen.getByText("Form content")).toBeInTheDocument();
  });

  it("renders complex children (nested elements)", () => {
    render(
      <Wrapper>
        <SidePanelFormContainer title="Complex" onCancel={vi.fn()}>
          <div>
            <label htmlFor="name">Name</label>
            <input id="name" placeholder="Enter name" />
          </div>
        </SidePanelFormContainer>
      </Wrapper>,
    );
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter name")).toBeInTheDocument();
  });

  // ── className ────────────────────────────────────────────────────────────

  it("applies a custom className to the container", () => {
    renderContainer({ className: "custom-container" });
    const container = document.querySelector(".custom-container");
    expect(container).not.toBeNull();
  });

  // ── Default values ───────────────────────────────────────────────────────

  it("defaults isPending to false", () => {
    renderContainer();
    const saveButton = screen.getByText("Save");
    // When not pending, the button should not have the loading attribute
    expect(saveButton.closest("[data-loading]")).toBeNull();
  });

  it("defaults isLoading to false", () => {
    renderContainer();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Form content")).toBeInTheDocument();
  });
});
