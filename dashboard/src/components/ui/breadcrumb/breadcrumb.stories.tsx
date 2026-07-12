import type { Meta, StoryObj } from "@storybook/react";
import { BrowserRouter } from "react-router-dom";

import { Breadcrumb, type BreadcrumbSegment } from "./breadcrumb";

/**
 * Breadcrumb — standalone navigation landmark for hierarchical page trails.
 *
 * Renders clickable route segments with `/` separators. The last segment
 * is always the current page (non-clickable, `aria-current="page"`).
 * Wraps react-router-dom `<Link>` components and requires a router context.
 *
 * ### Usage
 * ```tsx
 * <Breadcrumb
 *   segments={[
 *     { label: "Devices", path: "/devices" },
 *     { label: "CQZ123", path: "/devices/CQZ123" },
 *   ]}
 * />
 * ```
 *
 * ### Design Tokens
 * - `--ao-font-color-primary` → current page label
 * - `--ao-font-color-secondary` → link color
 * - `--ao-font-color-tertiary` → separator color
 * - `--ao-background-tertiary` → link hover background
 * - `--ao-radius-sm` → link border-radius
 * - `--ao-font-weight-medium` → current page weight
 *
 * ### Accessibility
 * - `aria-label="Breadcrumb"` (Lingui-i18n'd) on the `<nav>`
 * - `aria-current="page"` on the current-page span
 * - Separators marked `aria-hidden="true"`
 */
const meta: Meta<typeof Breadcrumb> = {
  title: "UI/Navigation/Breadcrumb",
  component: Breadcrumb,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <BrowserRouter>
        <Story />
      </BrowserRouter>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Breadcrumb>;

const EMPTY_SEGMENTS: BreadcrumbSegment[] = [];
const DEFAULT_SEGMENTS: BreadcrumbSegment[] = [
  { label: "Devices", path: "/devices" },
  { label: "Main Gate", path: "/devices/CQZ123" },
];
const DEEP_SEGMENTS: BreadcrumbSegment[] = [
  { label: "Dashboard", path: "/" },
  { label: "Devices", path: "/devices" },
  { label: "Main Gate", path: "/devices/CQZ123" },
  { label: "Edit", path: "/devices/CQZ123/edit" },
];

export const Primary: Story = {
  args: { segments: DEFAULT_SEGMENTS },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--ao-spacing-6)",
        padding: "var(--ao-spacing-4)",
      }}
    >
      <Breadcrumb segments={DEFAULT_SEGMENTS} />
      <Breadcrumb segments={DEEP_SEGMENTS} />
      <Breadcrumb segments={EMPTY_SEGMENTS} />
    </div>
  ),
};

/**
 * Real-world usage inside PageBar — the breadcrumb appears above the title row,
 * matching the Reaktly pattern for hierarchical page navigation.
 */
export const ContextInPageBar: Story = {
  name: "Context: Inside PageBar",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--ao-spacing-4)",
        padding: "var(--ao-spacing-4)",
        background: "var(--ao-background-secondary)",
        borderBottom: "1px solid var(--ao-border-color-medium)",
      }}
    >
      <Breadcrumb segments={DEFAULT_SEGMENTS} />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "var(--ao-font-size-md)",
              fontWeight: "var(--ao-font-weight-semibold)",
              color: "var(--ao-font-color-primary)",
            }}
          >
            Main Gate
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "var(--ao-font-size-sm)",
              color: "var(--ao-font-color-tertiary)",
            }}
          >
            ZKTeco biometric scanner #3B
          </p>
        </div>
      </div>
    </div>
  ),
};
