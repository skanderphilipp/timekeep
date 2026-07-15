import type { Meta, StoryObj } from "@storybook/react";
import { PageShell } from "./page-shell";
import { PageBar } from "../page-bar";
import { Button } from "@/components/ui/button";
import { IconPlus } from "@tabler/icons-react";
import { MemoryRouter } from "react-router-dom";

const meta: Meta<typeof PageShell> = {
  title: "UI/Layout/PageShell",
  component: PageShell,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/devices"]}>
        <Story />
      </MemoryRouter>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PageShell>;

/** Minimal page — just breadcrumbs, no header. */
export const BreadcrumbsOnly: Story = {
  render: () => (
    <div style={{ background: "var(--ao-background-page)", minHeight: 200 }}>
      <PageShell>
        <div style={{ padding: 12 }}>Content goes here.</div>
      </PageShell>
    </div>
  ),
};

/** Page with header bar (title + actions). */
export const WithHeader: Story = {
  render: () => (
    <div style={{ background: "var(--ao-background-page)", minHeight: 200 }}>
      <PageShell
        header={
          <PageBar
            title="Devices"
            description="Manage ZKTeco biometric scanners."
            actions={<Button icon={<IconPlus size={16} />}>Add Device</Button>}
          />
        }
      >
        <div style={{ padding: 12 }}>Content goes here.</div>
      </PageShell>
    </div>
  ),
};

/** Detail page with dynamic breadcrumb label. */
export const DetailPageWithLabel: Story = {
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/devices/CQZ123"]}>
        <Story />
      </MemoryRouter>
    ),
  ],
  render: () => (
    <div style={{ background: "var(--ao-background-page)", minHeight: 200 }}>
      <PageShell
        pageLabel="Front Gate Scanner"
        header={<PageBar title="Front Gate Scanner" />}
      >
        <div style={{ padding: 12 }}>Device detail content.</div>
      </PageShell>
    </div>
  ),
};
