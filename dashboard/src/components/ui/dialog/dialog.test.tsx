import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { messages as enMessages } from "@/locales/en";

import { DialogComponent } from "./dialog";

i18n.load({ en: enMessages });
i18n.activate("en");

// Lingui wrapper (same pattern as existing tests)
function Wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}

describe("Dialog", () => {
  it("does not render when closed", () => {
    render(
      <Wrapper>
        <DialogComponent open={false} onOpenChange={vi.fn()} title="Test Dialog">
          <p>Content</p>
        </DialogComponent>
      </Wrapper>,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Test Dialog")).toBeNull();
  });

  it("renders title and content when open", () => {
    render(
      <Wrapper>
        <DialogComponent
          open={true}
          onOpenChange={vi.fn()}
          title="Test Dialog"
          description="Dialog description"
        >
          <p>Dialog body content</p>
        </DialogComponent>
      </Wrapper>,
    );

    expect(screen.getByText("Test Dialog")).toBeInTheDocument();
    expect(screen.getByText("Dialog description")).toBeInTheDocument();
    expect(screen.getByText("Dialog body content")).toBeInTheDocument();
  });

  it("closes when the close button is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <Wrapper>
        <DialogComponent open={true} onOpenChange={onOpenChange} title="Test Dialog">
          <p>Content</p>
        </DialogComponent>
      </Wrapper>,
    );

    const closeButton = screen.getByRole("button", { name: /close/i });
    await user.click(closeButton);

    // base-ui passes (open, eventDetails) — only the open flag matters here
    expect(onOpenChange).toHaveBeenCalled();
    expect(onOpenChange.mock.calls[0][0]).toBe(false);
  });

  it("renders without description gracefully", () => {
    render(
      <Wrapper>
        <DialogComponent open={true} onOpenChange={vi.fn()} title="No Description">
          <p>Content</p>
        </DialogComponent>
      </Wrapper>,
    );

    expect(screen.getByText("No Description")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("renders without title gracefully", () => {
    render(
      <Wrapper>
        <DialogComponent open={true} onOpenChange={vi.fn()}>
          <p>Untitled dialog content</p>
        </DialogComponent>
      </Wrapper>,
    );

    expect(screen.getByText("Untitled dialog content")).toBeInTheDocument();
    // No title header rendered
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("applies custom className", () => {
    const { baseElement } = render(
      <Wrapper>
        <DialogComponent
          open={true}
          onOpenChange={vi.fn()}
          title="Styled Dialog"
          className="custom-dialog"
        >
          <p>Content</p>
        </DialogComponent>
      </Wrapper>,
    );

    // The popup should have the custom class merged in
    const popup = baseElement.querySelector('[data-slot="dialog-popup"]');
    expect(popup).not.toBeNull();
    expect(popup?.className).toContain("custom-dialog");
  });

  it("wires the popup to its positioning styles", () => {
    const { baseElement } = render(
      <Wrapper>
        <DialogComponent open={true} onOpenChange={vi.fn()} title="Centered">
          <p>Content</p>
        </DialogComponent>
      </Wrapper>,
    );

    const popup = baseElement.querySelector('[data-slot="dialog-popup"]') as HTMLElement;
    expect(popup).not.toBeNull();

    // jsdom doesn't compute stylesheet CSS — actual centering is covered by
    // the browser-mode story tests. Here we verify the class wiring.
    expect(popup.className).toContain("popup");
  });

  it("renders backdrop when open", () => {
    const { baseElement } = render(
      <Wrapper>
        <DialogComponent open={true} onOpenChange={vi.fn()} title="With Backdrop">
          <p>Content</p>
        </DialogComponent>
      </Wrapper>,
    );

    const backdrop = baseElement.querySelector('[data-slot="dialog-backdrop"]');
    expect(backdrop).not.toBeNull();
  });

  it("does not render backdrop when closed", () => {
    const { container } = render(
      <Wrapper>
        <DialogComponent open={false} onOpenChange={vi.fn()} title="Hidden">
          <p>Content</p>
        </DialogComponent>
      </Wrapper>,
    );

    const backdrop = container.querySelector('[data-slot="dialog-backdrop"]');
    expect(backdrop).toBeNull();
  });
});
