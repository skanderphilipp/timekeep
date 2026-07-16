import type { Meta, StoryObj } from "@storybook/react";
import { Provider, createStore } from "jotai";
import {
  IconDashboard,
  IconDevices,
  IconFingerprint,
  IconReport,
  IconSettings,
  IconPlus,
} from "@tabler/icons-react";

import { SidePanelCmdk } from "./side-panel-cmdk";
import {
  commandRegistryAtom,
} from "@/infrastructure/commands/command-registry";
import type { CommandRegistry, Command } from "@/infrastructure/commands/command-types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeStore(registry: CommandRegistry) {
  const store = createStore();
  store.set(commandRegistryAtom, registry);
  return store;
}

const DEMO_GLOBAL_COMMANDS: Command[] = [
  {
    id: "demo-dashboard",
    label: "Dashboard",
    description: "Attendance overview",
    icon: IconDashboard,
    keywords: ["home"],
    scope: { type: "global" },
    action: () => {},
  },
  {
    id: "demo-devices",
    label: "Devices",
    description: "Manage biometric scanners",
    icon: IconDevices,
    keywords: ["scanner"],
    scope: { type: "global" },
    action: () => {},
  },
  {
    id: "demo-punches",
    label: "Punch Records",
    description: "View attendance data",
    icon: IconFingerprint,
    keywords: ["attendance"],
    scope: { type: "global" },
    action: () => {},
  },
  {
    id: "demo-reports",
    label: "Reports",
    description: "Attendance reports",
    icon: IconReport,
    keywords: ["export"],
    scope: { type: "global" },
    action: () => {},
  },
  {
    id: "demo-settings",
    label: "Settings",
    description: "Configuration",
    icon: IconSettings,
    keywords: ["config"],
    scope: { type: "global" },
    action: () => {},
  },
];

const DEMO_PAGE_COMMANDS: Command[] = [
  {
    id: "demo-add-device",
    label: "Add Device",
    description: "Register a new scanner",
    icon: IconPlus,
    keywords: ["new"],
    scope: { type: "page", pageId: "devices.list" },
    action: () => {},
  },
];

// ── Meta ──────────────────────────────────────────────────────────────────────

const meta: Meta<typeof SidePanelCmdk> = {
  title: "Infrastructure/SidePanelCmdk",
  component: SidePanelCmdk,
  tags: ["autodocs", "level:layout"],
  decorators: [
    (Story) => (
      <div
        style={{
          background: "var(--ao-background-primary)",
          border: "1px solid var(--ao-border-color-light)",
          borderRadius: "var(--ao-radius-md)",
          height: "500px",
          overflow: "hidden",
          width: "400px",
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SidePanelCmdk>;

// ── Stories ───────────────────────────────────────────────────────────────────

/** Empty — no commands registered. Shows the search input + empty state message. */
export const Empty: Story = {
  decorators: [
    (Story) => {
      const store = makeStore({ global: [] });
      return (
        <Provider store={store}>
          <Story />
        </Provider>
      );
    },
  ],
  args: {
    onClose: () => {},
  },
};

/** Global commands only — no page context. Shows all commands without page grouping. */
export const GlobalOnly: Story = {
  decorators: [
    (Story) => {
      const store = makeStore({ global: DEMO_GLOBAL_COMMANDS });
      return (
        <Provider store={store}>
          <Story />
        </Provider>
      );
    },
  ],
  args: {
    onClose: () => {},
  },
};

/** Global + contextual commands. Contextual commands appear first under "Page commands". */
export const WithContextualCommands: Story = {
  decorators: [
    (Story) => {
      const store = makeStore({
        global: DEMO_GLOBAL_COMMANDS,
        "devices.list": DEMO_PAGE_COMMANDS,
      });
      return (
        <Provider store={store}>
          <Story />
        </Provider>
      );
    },
  ],
  args: {
    onClose: () => {},
  },
};

/** Simulates a search query. Only matching commands are shown. */
export const SearchFiltered: Story = {
  decorators: [
    (Story) => {
      const store = makeStore({
        global: DEMO_GLOBAL_COMMANDS,
        "devices.list": DEMO_PAGE_COMMANDS,
      });
      return (
        <Provider store={store}>
          <Story />
        </Provider>
      );
    },
  ],
  args: {
    onClose: () => {},
  },
  play: async ({ canvasElement }) => {
    // Wait for the search input to be focused, then type "Device"
    const input = canvasElement.querySelector<HTMLInputElement>('[data-slot="cmdk-search"] input');
    if (input) {
      await new Promise((r) => setTimeout(r, 100)); // wait for auto-focus
      input.focus();
      input.value = "Device";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  },
};
