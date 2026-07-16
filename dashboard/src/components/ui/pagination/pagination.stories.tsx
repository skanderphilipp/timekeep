import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { Pagination } from "./pagination";

const meta: Meta<typeof Pagination> = {
  title: "UI/Navigation/Pagination",
  component: Pagination,
  tags: ["autodocs", "level:primitive"],
  argTypes: {
    currentPage: { control: { type: "range", min: 1, max: 20, step: 1 } },
    totalPages: { control: { type: "range", min: 1, max: 20, step: 1 } },
  },
};

export default meta;
type Story = StoryObj<typeof Pagination>;

export const Primary: Story = {
  args: { currentPage: 3, totalPages: 10, onPageChange: fn() },
};

export const AllVariants: Story = {
  name: "All Variants",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--ao-spacing-4)",
        padding: "var(--ao-spacing-4)",
      }}
    >
      <div>
        <span
          style={{
            color: "var(--ao-font-color-tertiary)",
            display: "block",
            fontSize: 12,
            marginBottom: 8,
          }}
        >
          3 pages
        </span>
        <Pagination currentPage={1} totalPages={3} onPageChange={fn()} />
      </div>
      <div>
        <span
          style={{
            color: "var(--ao-font-color-tertiary)",
            display: "block",
            fontSize: 12,
            marginBottom: 8,
          }}
        >
          7 pages, middle
        </span>
        <Pagination currentPage={4} totalPages={7} onPageChange={fn()} />
      </div>
      <div>
        <span
          style={{
            color: "var(--ao-font-color-tertiary)",
            display: "block",
            fontSize: 12,
            marginBottom: 8,
          }}
        >
          15 pages, with ellipsis
        </span>
        <Pagination currentPage={8} totalPages={15} onPageChange={fn()} />
      </div>
    </div>
  ),
};
