import { createRef } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { InfiniteScrollSentinel } from "./infinite-scroll-sentinel";

/**
 * InfiniteScrollSentinel — observed footer row for infinite scrolling lists.
 *
 * Used in employee lists, attendance logs, and device tables. An IntersectionObserver
 * watches this element; when it scrolls into view, the consumer fetches the next page.
 */
const meta: Meta<typeof InfiniteScrollSentinel> = {
  title: "UI/Data Display/InfiniteScrollSentinel",
  component: InfiniteScrollSentinel,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof InfiniteScrollSentinel>;

const sentinelRef = createRef<HTMLDivElement>();

export const Primary: Story = {
  args: {
    ref: sentinelRef,
    children: "Loading more records…",
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
        gap: "var(--ao-spacing-4)",
        padding: "var(--ao-spacing-4)",
      }}
    >
      <div
        style={{
          padding: "var(--ao-spacing-4)",
          border: "1px solid var(--ao-border-color-light)",
          borderRadius: "var(--ao-radius-md)",
        }}
      >
        <InfiniteScrollSentinel ref={sentinelRef}>Loading more records…</InfiniteScrollSentinel>
      </div>
      <div
        style={{
          padding: "var(--ao-spacing-4)",
          border: "1px solid var(--ao-border-color-light)",
          borderRadius: "var(--ao-radius-md)",
        }}
      >
        <InfiniteScrollSentinel ref={sentinelRef}>
          <span
            style={{ color: "var(--ao-font-color-tertiary)", fontSize: "var(--ao-font-size-sm)" }}
          >
            No more records to load.
          </span>
        </InfiniteScrollSentinel>
      </div>
      <div
        style={{
          padding: "var(--ao-spacing-4)",
          border: "1px solid var(--ao-border-color-light)",
          borderRadius: "var(--ao-radius-md)",
        }}
      >
        <InfiniteScrollSentinel ref={sentinelRef} />
      </div>
    </div>
  ),
};

/** Context: bottom of an employee list table with loading indicator. */
export const ContextEmployeeList: Story = {
  name: "Context: Employee List",
  parameters: { controls: { disable: true } },
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "var(--ao-spacing-4)",
        maxWidth: 400,
      }}
    >
      <p
        style={{
          fontSize: "var(--ao-font-size-sm)",
          color: "var(--ao-font-color-secondary)",
          marginBottom: "var(--ao-spacing-2)",
        }}
      >
        Employee List — showing 50 of 312 records
      </p>
      <div
        style={{
          border: "1px solid var(--ao-border-color-light)",
          borderRadius: "var(--ao-radius-md)",
          padding: "var(--ao-spacing-3)",
          marginBottom: "var(--ao-spacing-2)",
        }}
      >
        <span style={{ fontSize: "var(--ao-font-size-sm)" }}>
          Ahmed Al-Rashid — Punch ID: 10042
        </span>
      </div>
      <div
        style={{
          border: "1px solid var(--ao-border-color-light)",
          borderRadius: "var(--ao-radius-md)",
          padding: "var(--ao-spacing-3)",
          marginBottom: "var(--ao-spacing-2)",
        }}
      >
        <span style={{ fontSize: "var(--ao-font-size-sm)" }}>Fatima Hassan — Punch ID: 10043</span>
      </div>
      <InfiniteScrollSentinel ref={sentinelRef}>Loading more records…</InfiniteScrollSentinel>
    </div>
  ),
};
