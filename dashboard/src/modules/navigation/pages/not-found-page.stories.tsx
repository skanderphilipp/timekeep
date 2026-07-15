import type { Meta, StoryObj } from "@storybook/react";

import { NotFoundPage } from "./not-found-page";

// ── Meta ────────────────────────────────────────────────────────────────

const meta: Meta<typeof NotFoundPage> = {
  title: "Pages/Not Found",
  component: NotFoundPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof NotFoundPage>;

// ── Stories ─────────────────────────────────────────────────────────────

/** 404 page with icon, message, and link back to dashboard. */
export const Default: Story = {
  parameters: { controls: { disable: true } },
  render: () => <NotFoundPage />,
};
