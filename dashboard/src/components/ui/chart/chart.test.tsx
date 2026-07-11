import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import type { ComponentProps } from "react";

// ── Mock nivo chart components ────────────────────────────────────────────────
//
// Nivo's ResponsiveBar/Line/Pie use react-virtualized-auto-sizer internally.
// In jsdom, the auto-sizer reads offsetWidth/offsetHeight which are always 0,
// so nivo renders nothing. Since we test our wrapper layer (not nivo),
// we mock the nivo components to render a plain <svg> with data-testid.

vi.mock("@nivo/bar", () => ({
  ResponsiveBar: (_props: Record<string, unknown>) => <svg data-testid="nivo-bar" />,
}));

vi.mock("@nivo/line", () => ({
  ResponsiveLine: (_props: Record<string, unknown>) => <svg data-testid="nivo-line" />,
}));

vi.mock("@nivo/pie", () => ({
  ResponsivePie: (props: Record<string, unknown>) => (
    <svg data-testid="nivo-pie" data-inner={(props.innerRadius as number) ?? 0} />
  ),
}));

import { BarChart } from "./BarChart";
import { LineChart } from "./LineChart";
import { PieChart } from "./PieChart";
import { Chart } from "./chart";

type ChartWrapperProps = ComponentProps<typeof Chart>;

function ChartWrapper(props: ChartWrapperProps) {
  return (
    <I18nProvider i18n={i18n}>
      <Chart {...props} />
    </I18nProvider>
  );
}

const barData = [
  { hour: "06:00", count: 8 },
  { hour: "07:00", count: 22 },
  { hour: "08:00", count: 15 },
];

const lineData = [
  { month: "Mar", rate: 95 },
  { month: "Apr", rate: 92 },
];

const pieData = [
  { name: "Full", value: 195, color: "var(--ao-chart-positive)" },
  { name: "Half", value: 30, color: "var(--ao-chart-warning)" },
];

describe("Chart components", () => {
  describe("BarChart", () => {
    it("renders a container div with explicit height", () => {
      const { container } = render(
        <BarChart data={barData} bars={[{ dataKey: "count" }]} xKey="hour" height={300} />,
      );
      const div = container.firstElementChild as HTMLElement;
      expect(div).not.toBeNull();
      expect(div!.tagName).toBe("DIV");
      expect(div!.style.height).toBe("300px");
      expect(div!.style.width).toBe("100%");
    });

    it("renders the nivo SVG inside the container", () => {
      render(<BarChart data={barData} bars={[{ dataKey: "count" }]} xKey="hour" height={300} />);
      expect(screen.getByTestId("nivo-bar")).toBeDefined();
    });
  });

  describe("LineChart", () => {
    it("renders a container with explicit height", () => {
      const { container } = render(
        <LineChart data={lineData} lines={[{ dataKey: "rate" }]} xKey="month" height={300} />,
      );
      const div = container.firstElementChild as HTMLElement;
      expect(div!.style.height).toBe("300px");
    });

    it("renders the nivo SVG inside the container", () => {
      render(<LineChart data={lineData} lines={[{ dataKey: "rate" }]} xKey="month" height={300} />);
      expect(screen.getByTestId("nivo-line")).toBeDefined();
    });
  });

  describe("PieChart", () => {
    it("renders a container with explicit height", () => {
      const { container } = render(<PieChart data={pieData} height={250} />);
      const div = container.firstElementChild as HTMLElement;
      expect(div!.style.height).toBe("250px");
    });

    it("returns null for empty data", () => {
      const { container } = render(<PieChart data={[]} height={250} />);
      expect(container.firstElementChild).toBeNull();
    });

    it("renders the nivo SVG with data", () => {
      render(<PieChart data={pieData} height={250} />);
      expect(screen.getByTestId("nivo-pie")).toBeDefined();
    });

    it("renders donut when donut=true", () => {
      render(<PieChart data={pieData} donut height={250} />);
      const svg = screen.getByTestId("nivo-pie");
      expect(svg.dataset.inner).not.toBe("0");
    });

    it("renders standard pie when donut=false", () => {
      render(<PieChart data={pieData} donut={false} height={250} />);
      expect(screen.getByTestId("nivo-pie").dataset.inner).toBe("0");
    });
  });

  describe("Chart wrapper", () => {
    it("renders title and description", () => {
      render(
        <ChartWrapper title="Test Chart" description="A test description">
          <BarChart data={barData} bars={[{ dataKey: "count" }]} xKey="hour" height={200} />
        </ChartWrapper>,
      );
      expect(screen.getByText("Test Chart")).toBeDefined();
      expect(screen.getByText("A test description")).toBeDefined();
    });

    it("renders loading state", () => {
      render(
        <ChartWrapper title="Loading" isLoading>
          <div />
        </ChartWrapper>,
      );
      expect(screen.getByRole("status")).toBeDefined();
    });

    it("renders empty state", () => {
      render(
        <ChartWrapper title="Empty" isEmpty emptyMessage="Nothing here">
          <div />
        </ChartWrapper>,
      );
      expect(screen.getByText("No data")).toBeDefined();
    });

    it("renders error state", () => {
      render(
        <ChartWrapper title="Error" error={new Error("Something broke")}>
          <div />
        </ChartWrapper>,
      );
      expect(screen.getByText("Failed to load chart data")).toBeDefined();
      expect(screen.getByText("Something broke")).toBeDefined();
    });
  });
});
