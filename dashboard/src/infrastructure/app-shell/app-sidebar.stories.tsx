import type { Meta, StoryObj } from "@storybook/react";
import {
  IconDashboard,
  IconDevices,
  IconFingerprint,
  IconUsers,
  IconBuilding,
  IconReport,
  IconSettings,
} from "@tabler/icons-react";

import { AppSidebar } from "./app-sidebar";
import type { ResolvedNavItem } from "@/infrastructure/navigation/use-navigation";

// ── Test navigation items ─────────────────────────────────────────────────────

const L = (s: string) => () => s;

const navItems: ResolvedNavItem[] = [
  {
    key: "dashboard",
    label: L("Dashboard"),
    path: "/",
    icon: IconDashboard,
    end: true,
  },
  {
    key: "devices",
    label: L("Devices"),
    icon: IconDevices,
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
    key: "punches",
    label: L("Punches"),
    path: "/punches",
    icon: IconFingerprint,
    end: false,
  },
  {
    key: "employees",
    label: L("Employees"),
    path: "/employees",
    icon: IconUsers,
    end: false,
  },
  {
    key: "departments",
    label: L("Departments"),
    path: "/departments",
    icon: IconBuilding,
    end: false,
  },
  {
    key: "reports",
    label: L("Reports"),
    path: "/reports",
    icon: IconReport,
    end: false,
  },
  {
    key: "settings",
    label: L("Settings"),
    icon: IconSettings,
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
      {
        key: "settings.apiKeys",
        label: L("API Keys"),
        path: "/settings/api-keys",
        icon: undefined,
        end: false,
      },
      {
        key: "settings.endpoints",
        label: L("Endpoints"),
        path: "/settings/endpoints",
        icon: undefined,
        end: false,
      },
      {
        key: "settings.audit",
        label: L("Audit Log"),
        path: "/settings/audit",
        icon: undefined,
        end: false,
      },
    ],
  },
];

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<typeof AppSidebar> = {
  title: "Infrastructure/AppShell/AppSidebar",
  component: AppSidebar,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    isOpen: false,
    isCollapsed: false,
    isMobile: false,
    navItems,
    onClose: () => {},
    onToggleCollapse: () => {},
    colorScheme: "light",
    onToggleTheme: () => {},
    isAuthenticated: true,
    onLogout: () => {},
  },
  decorators: [
    (Story) => (
      <div style={{ display: "flex", height: "100vh", maxWidth: 280 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AppSidebar>;

// ── Stories ───────────────────────────────────────────────────────────────────

/** Default desktop expanded state with all nav items and labels visible. */
export const DesktopExpanded: Story = {
  args: {
    isCollapsed: false,
    isMobile: false,
  },
};

/** Desktop collapsed state — icons only, no labels or footer. */
export const DesktopCollapsed: Story = {
  args: {
    isCollapsed: true,
    isMobile: false,
  },
};

/** Mobile: sidebar closed (off-screen, default state). */
export const MobileClosed: Story = {
  args: {
    isMobile: true,
    isOpen: false,
  },
};

/** Mobile: sidebar open as full-width overlay with close button. */
export const MobileOpen: Story = {
  args: {
    isMobile: true,
    isOpen: true,
  },
};

/** Desktop collapsed with a child route active (highlights parent icon). */
export const DesktopCollapsedActiveChild: Story = {
  args: {
    isCollapsed: true,
    isMobile: false,
  },
};

/** Desktop expanded with Settings group open. */
export const DesktopExpandedSettingsOpen: Story = {
  args: {
    isCollapsed: false,
    isMobile: false,
  },
};
