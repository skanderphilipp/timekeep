import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Switch } from "./switch";

/**
 * Switch — on/off control for settings and filters. Built on @base-ui/react.
 *
 * Used in the punches page ("Show only anomalies") and settings page.
 */
const meta: Meta<typeof Switch> = {
	title: "UI/Inputs/Switch",
	component: Switch,
	tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Switch>;

export const Primary: Story = {
	render: () => {
		const [checked, setChecked] = useState(false);
		return <Switch checked={checked} onCheckedChange={setChecked} label="Show only anomalies" />;
	},
};

export const AllVariants: Story = {
	name: "All Variants",
	parameters: { controls: { disable: true } },
	render: () => {
		const [checked1, setChecked1] = useState(true);
		const [checked2, setChecked2] = useState(false);
		return (
			<div style={{ display: "flex", flexDirection: "column", gap: "var(--ao-spacing-4)", padding: "var(--ao-spacing-4)" }}>
				<div style={{ display: "flex", gap: "var(--ao-spacing-4)", alignItems: "center" }}>
					<Switch checked={checked1} onCheckedChange={setChecked1} label="Checked" />
					<span>Checked with label</span>
				</div>
				<div style={{ display: "flex", gap: "var(--ao-spacing-4)", alignItems: "center" }}>
					<Switch checked={checked2} onCheckedChange={setChecked2} label="Unchecked" />
					<span>Unchecked with label</span>
				</div>
				<div style={{ display: "flex", gap: "var(--ao-spacing-4)", alignItems: "center" }}>
					<Switch defaultChecked />
					<span>No label (uncontrolled)</span>
				</div>
				<div style={{ display: "flex", gap: "var(--ao-spacing-4)", alignItems: "center" }}>
					<Switch checked disabled label="Disabled" />
					<span>Disabled</span>
				</div>
			</div>
		);
	},
};

export const ContextAnomalyFilter: Story = {
	name: "Context: Anomaly Filter",
	parameters: { controls: { disable: true } },
	render: () => {
		const [checked, setChecked] = useState(true);
		return (
			<div style={{ padding: "var(--ao-spacing-4)", display: "flex", alignItems: "center", gap: "var(--ao-spacing-3)" }}>
				<Switch checked={checked} onCheckedChange={setChecked} label="Show only anomalies" />
				<span style={{ color: "var(--ao-font-color-secondary)", fontSize: 14 }}>
					{checked ? "3 anomalies detected" : "Showing all punches"}
				</span>
			</div>
		);
	},
};
