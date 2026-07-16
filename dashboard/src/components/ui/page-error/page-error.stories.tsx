import type { Meta, StoryObj } from "@storybook/react";
import { PageError } from "./page-error";

/**
 * PageError — full-page error state with optional retry.
 *
 * Shown when a data-fetching hook fails (network error, 500, etc.).
 * The retry button re-triggers the query.
 */
const meta: Meta<typeof PageError> = {
  title: "UI/Feedback/PageError",
  component: PageError,
  tags: ["autodocs", "level:primitive"],
};

export default meta;
type Story = StoryObj<typeof PageError>;

export const Primary: Story = {
  args: {
    onRetry: () => {},
  },
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
      <PageError onRetry={() => {}} />
      <PageError />
    </div>
  ),
};

export const ContextDashboardError: Story = {
  name: "Context: Dashboard Error",
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ padding: "var(--ao-spacing-8)" }}>
      <PageError onRetry={() => {}} />
      <p style={{ color: "var(--ao-font-color-tertiary)", marginTop: 16, textAlign: "center" }}>
        The backend may be restarting. Attendance data is not lost — it resumes when the server
        comes back.
      </p>
    </div>
  ),
};
