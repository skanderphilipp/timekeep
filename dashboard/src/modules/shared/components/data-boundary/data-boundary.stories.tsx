import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { DataBoundary } from "./data-boundary";

type Item = { id: number; name: string };

const sampleData: Item[] = [
  { id: 1, name: "Item One" },
  { id: 2, name: "Item Two" },
  { id: 3, name: "Item Three" },
];

const meta: Meta<typeof DataBoundary<Item>> = {
  title: "UI/Data Display/DataBoundary",
  component: DataBoundary<Item>,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof DataBoundary<Item>>;

export const Primary: Story = {
  args: {
    data: sampleData,
    isLoading: false,
    error: null,
    children: (items) => (
      <ul>
        {items.map((i) => (
          <li key={i.id}>{i.name}</li>
        ))}
      </ul>
    ),
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
      <div>
        <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>
          Loading
        </p>
        <DataBoundary<Item> data={undefined} isLoading error={null} onRetry={fn()}>
          {(d) => (
            <ul>
              {d.map((i) => (
                <li key={i.id}>{i.name}</li>
              ))}
            </ul>
          )}
        </DataBoundary>
      </div>
      <div>
        <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>
          Error
        </p>
        <DataBoundary<Item>
          data={undefined}
          isLoading={false}
          error={new Error("Network Error")}
          onRetry={fn()}
        >
          {(d) => (
            <ul>
              {d.map((i) => (
                <li key={i.id}>{i.name}</li>
              ))}
            </ul>
          )}
        </DataBoundary>
      </div>
      <div>
        <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>
          Empty
        </p>
        <DataBoundary<Item> data={[]} isLoading={false} error={null}>
          {(d) => (
            <ul>
              {d.map((i) => (
                <li key={i.id}>{i.name}</li>
              ))}
            </ul>
          )}
        </DataBoundary>
      </div>
      <div>
        <p style={{ fontSize: 12, color: "var(--ao-font-color-tertiary)", marginBottom: 8 }}>
          Data
        </p>
        <DataBoundary<Item> data={sampleData} isLoading={false} error={null}>
          {(d) => (
            <ul>
              {d.map((i) => (
                <li key={i.id}>{i.name}</li>
              ))}
            </ul>
          )}
        </DataBoundary>
      </div>
    </div>
  ),
};
