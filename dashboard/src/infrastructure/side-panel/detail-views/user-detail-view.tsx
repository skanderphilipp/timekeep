import { useMemo } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DetailGrid, DetailItem } from "@/components/ui/detail-grid";
import { ListItem } from "@/components/ui/list-item";
import { useEntityDetail } from "../hooks/use-entity-detail";
import { usePunchData } from "@/modules/punches/hooks/use-punch-data";
import type { Employee } from "@/lib/api/employees";

type UserDetailViewProps = {
	userPin: string;
};

/**
 * UserDetailView — rendered inside the SidePanel when a user PIN
 * is clicked in the punches table.
 *
 * Shows employee identity + recent punch history for that PIN.
 */
export function UserDetailView({ userPin }: UserDetailViewProps) {
	const { _ } = useLingui();
	const { data: rawData, isLoading: empLoading, error: empError } = useEntityDetail("user", userPin);
	const employee = rawData as Employee | null;

	// Fetch recent punches for this PIN
	const today = useMemo(() => new Date().toISOString().split("T")[0], []);
	const lastWeek = useMemo(() => {
		const d = new Date();
		d.setDate(d.getDate() - 7);
		return d.toISOString().split("T")[0];
	}, []);

	const { data: punchData, isLoading: punchesLoading } = usePunchData({
		user_pin: userPin,
		since: lastWeek,
		until: today,
		limit: 20,
		sort_order: "desc",
	});

	const punches = punchData?.punches ?? [];

	// ── Loading ────────────────────────────────────────────────────────

	if (empLoading) {
		return (
			<div style={{ padding: "24px" }}>
				<Text variant="body" color="tertiary">
					{_(msg`Loading user details…`)}
				</Text>
			</div>
		);
	}

	if (empError) {
		return (
			<div style={{ padding: "24px" }}>
				<Text variant="body" color="danger">
					{_(msg`Failed to load user details.`)}
				</Text>
			</div>
		);
	}

	// ── Render ─────────────────────────────────────────────────────────

	return (
		<div style={{ padding: "0" }}>
			{/* Header */}
			<div style={{ padding: "16px 24px" }}>
				<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
					<Heading level="h3" color="primary">
						{employee?.name ?? userPin}
					</Heading>
					{employee && (
						<Badge variant={employee.active ? "success" : "neutral"}>
							{employee.active ? _(msg`Active`) : _(msg`Inactive`)}
						</Badge>
					)}
				</div>
				<Text variant="caption" color="tertiary">
					PIN: {userPin}
				</Text>
			</div>

			<Separator />

			{employee ? (
				<>
					<DetailGrid>
						<DetailItem label={_(msg`Name`)}>
							<Text variant="body">{employee.name}</Text>
						</DetailItem>

						{employee.department && (
							<DetailItem label={_(msg`Department`)}>
								<Text variant="body">{employee.department}</Text>
							</DetailItem>
						)}

						{employee.external_id && (
							<DetailItem label={_(msg`External ID`)}>
								<Text variant="body">{employee.external_id}</Text>
							</DetailItem>
						)}

						<DetailItem label={_(msg`Added`)}>
							<Text variant="body">
								{new Date(employee.created_at * 1000).toLocaleDateString()}
							</Text>
						</DetailItem>
					</DetailGrid>
				</>
			) : (
				<div style={{ padding: "24px" }}>
					<Text variant="body" color="secondary">
						{_(msg`Employee record not found. This PIN may belong to a user not in the employee database.`)}
					</Text>
				</div>
			)}

			{/* Recent Punches */}
			<Separator />
			<div style={{ padding: "12px 24px" }}>
				<Text variant="body" weight="medium">
					{_(msg`Recent Punches`)}
				</Text>
				<Text variant="caption" color="tertiary">
					{_(msg`Last 7 days`)}
				</Text>
			</div>

			{punchesLoading ? (
				<div style={{ padding: "12px 24px" }}>
					<Text variant="caption" color="tertiary">
						{_(msg`Loading punches…`)}
					</Text>
				</div>
			) : punches.length === 0 ? (
				<div style={{ padding: "12px 24px" }}>
					<Text variant="caption" color="tertiary">
						{_(msg`No punches in the last 7 days.`)}
					</Text>
				</div>
			) : (
				<div>
					{punches.slice(0, 10).map((p) => (
						<ListItem key={p.id}>
							<ListItem.Leading>
								<Text variant="body" weight="medium">
									{new Date(p.timestamp * 1000).toLocaleTimeString()}
								</Text>
								<Text variant="caption" color="secondary">
									{new Date(p.timestamp * 1000).toLocaleDateString()}
								</Text>
							</ListItem.Leading>
							<ListItem.Trailing>
								<Badge variant={p.status === "check_in" ? "success" : "warning"}>
									{p.status}
								</Badge>
								{p.device_label && (
									<Text variant="caption" color="tertiary">
										{p.device_label}
									</Text>
								)}
							</ListItem.Trailing>
						</ListItem>
					))}
				</div>
			)}
		</div>
	);
}
