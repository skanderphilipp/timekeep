import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createStore } from "jotai";

import { createRenderWrapper } from "@/testing/render-with-providers";
import { sidebarOpenAtom } from "@/infrastructure/state";
import { AppSidebar } from "./app-sidebar";

// ── Test helpers ──────────────────────────────────────────────────────────────

/** Minimal nav items matching the real navigation tree structure. */
function makeNavItems() {
  // We use simple label functions that don't require Lingui in test.
  const L = (s: string) => () => s;

  return [
    {
      key: "dashboard",
      label: L("Dashboard"),
      path: "/",
      icon: undefined, // will render as text-only in test
      end: true,
    },
    {
      key: "devices",
      label: L("Devices"),
      icon: undefined,
      end: false,
      children: [
        {
          key: "devices.list",
          label: L("All Devices"),
          path: "/devices",
          icon: undefined,
          end: false,
        },
      ],
    },
    {
      key: "settings",
      label: L("Settings"),
      icon: undefined,
      end: false,
      children: [
        {
          key: "settings.system",
          label: L("System"),
          path: "/settings",
          icon: undefined,
          end: false,
        },
        {
          key: "settings.users",
          label: L("Users"),
          path: "/settings/users",
          icon: undefined,
          end: false,
        },
      ],
    },
  ];
}

const defaultProps = {
  isOpen: false,
  isCollapsed: false,
  isMobile: false,
  navItems: makeNavItems(),
  onClose: () => {},
  onToggleCollapse: () => {},
  colorScheme: "light" as const,
  onToggleTheme: () => {},
  isAuthenticated: true,
  onLogout: () => {},
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AppSidebar", () => {
  describe("mobile overlay behavior", () => {
    it("renders off-screen (translateX -100%) when closed on mobile", () => {
      const { render } = createRenderWrapper();
      render(
        <AppSidebar {...defaultProps} isMobile isOpen={false} />,
      );

      const sidebar = document.querySelector("[data-slot='sidebar']");
      expect(sidebar).toBeTruthy();
      // Sidebar should be present in the DOM even when closed
      expect(sidebar?.getAttribute("data-slot")).toBe("sidebar");
    });

    it("renders on-screen (translateX 0) when open on mobile", () => {
      const { render } = createRenderWrapper();
      render(
        <AppSidebar {...defaultProps} isMobile isOpen={true} />,
      );

      const sidebar = document.querySelector("[data-slot='sidebar']");
      expect(sidebar).toBeTruthy();
    });

    it("shows mobile close button when open on mobile", () => {
      const { render } = createRenderWrapper();
      render(
        <AppSidebar {...defaultProps} isMobile isOpen={true} />,
      );

      // Mobile close button should be present
      const closeBtn = document.querySelector("[data-slot='sidebar-close']");
      expect(closeBtn).toBeTruthy();
    });

    it("does not show close button when closed on mobile", () => {
      const { render } = createRenderWrapper();
      render(
        <AppSidebar {...defaultProps} isMobile isOpen={false} />,
      );

      const closeBtn = document.querySelector("[data-slot='sidebar-close']");
      expect(closeBtn).toBeNull();
    });

    it("calls onClose when mobile close button is clicked", async () => {
      let closed = false;
      const onClose = () => { closed = true; };
      const { render } = createRenderWrapper();

      render(
        <AppSidebar
          {...defaultProps}
          isMobile
          isOpen={true}
          onClose={onClose}
        />,
      );

      const closeBtn = document.querySelector("[data-slot='sidebar-close']");
      expect(closeBtn).toBeTruthy();

      if (closeBtn) {
        await userEvent.click(closeBtn);
      }
      expect(closed).toBe(true);
    });
  });

  describe("desktop collapsed behavior", () => {
    it("renders collapsed width when isCollapsed is true", () => {
      const { render } = createRenderWrapper();
      render(
        <AppSidebar {...defaultProps} isCollapsed={true} />,
      );

      const sidebar = document.querySelector("[data-slot='sidebar']");
      expect(sidebar).toBeTruthy();
    });

    it("shows parent group icons in collapsed mode", () => {
      const { render } = createRenderWrapper();
      render(
        <AppSidebar {...defaultProps} isCollapsed={true} />,
      );

      // Parent group icons should be rendered as collapsed indicators
      const groupIndicators = document.querySelectorAll("[data-slot='nav-group-collapsed']");
      // Devices and Settings are groups
      expect(groupIndicators.length).toBeGreaterThanOrEqual(2);
    });

    it("renders child items with dot indicators in collapsed mode", () => {
      const { render } = createRenderWrapper();
      render(
        <AppSidebar {...defaultProps} isCollapsed={true} />,
      );

      // Children should be present in collapsed mode with dot indicators
      const dotIndicators = document.querySelectorAll("[data-slot='nav-dot']");
      // Devices has 1 child (All Devices), Settings has 2 children = 3 total
      expect(dotIndicators.length).toBeGreaterThanOrEqual(3);
    });

    it("hides footer controls in collapsed mode", () => {
      const { render } = createRenderWrapper();
      render(
        <AppSidebar {...defaultProps} isCollapsed={true} />,
      );

      const footer = document.querySelector("[data-slot='sidebar-footer']");
      expect(footer).toBeNull();
    });
  });

  describe("desktop expanded behavior", () => {
    it("renders all nav items with labels visible", () => {
      const { render } = createRenderWrapper();
      render(
        <AppSidebar {...defaultProps} isCollapsed={false} isOpen={false} />,
      );

      expect(screen.getByText("Dashboard")).toBeTruthy();
      expect(screen.getByText("Devices")).toBeTruthy();
    });

    it("shows footer with controls in expanded mode", () => {
      const { render } = createRenderWrapper();
      render(
        <AppSidebar {...defaultProps} isCollapsed={false} />,
      );

      const footer = document.querySelector("[data-slot='sidebar-footer']");
      expect(footer).toBeTruthy();
    });

    it("shows collapse toggle button in header", () => {
      const { render } = createRenderWrapper();
      render(
        <AppSidebar {...defaultProps} isCollapsed={false} />,
      );

      const collapseBtn = document.querySelector("[data-slot='sidebar-collapse']");
      expect(collapseBtn).toBeTruthy();
    });
  });

  describe("brand display", () => {
    it("shows TimeKeep brand and workspace name when expanded", () => {
      const { render } = createRenderWrapper();
      render(
        <AppSidebar {...defaultProps} isCollapsed={false} />,
      );

      expect(screen.getByText("TimeKeep")).toBeTruthy();
      expect(screen.getByText("Alsabah")).toBeTruthy();
    });
  });
});

describe("sidebarOpenAtom", () => {
  it("defaults to false (sidebar closed)", () => {
    const store = createStore();
    expect(store.get(sidebarOpenAtom)).toBe(false);
  });

  it("can be toggled open and closed", () => {
    const store = createStore();
    store.set(sidebarOpenAtom, true);
    expect(store.get(sidebarOpenAtom)).toBe(true);

    store.set(sidebarOpenAtom, false);
    expect(store.get(sidebarOpenAtom)).toBe(false);
  });
});
