import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";

import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DetailGrid, DetailItem } from "@/components/ui/detail-grid";
import { StatusDot } from "@/components/ui/status-dot";
import { StorageGauge } from "@/modules/shared/components";
import { useEntityDetail } from "../hooks/use-entity-detail";
import { getDeviceStatus } from "@shared/device-statuses";
import { getDeviceStatusUI } from "@/lib/device-status-ui";
import type { DeviceDetailResponse } from "@/lib/api/devices";

type DeviceDetailViewProps = {
	serialNumber: string;
};

/**
 * DeviceDetailView — rendered inside the SidePanel when a device
 * serial number is clicked in any table.
 *
 * Fetches full device detail from `GET /api/devices/{sn}` including
 * identity, health/connection, capacity stats, and sync status.
 */
export function DeviceDetailView({ serialNumber }: DeviceDetailViewProps) {
	const { data: device, isLoading, error } = useEntityDetail("device", serialNumber);
	const { _ } = useLingui();

	if (isLoading) {
		return (
			<div style={{ padding: "24px" }}>
				<Text variant="body" color="tertiary">
					{_(msg`Loading device ${serialNumber}`)}…
				</Text>
			</div>
		);
	}

	if (error) {
		return (
			<div style={{ padding: "24px" }}>
				<Text variant="body" color="danger">
					{_(msg`Failed to load device details.`)}
				</Text>
			</div>
		);
	}

	const dev = device as DeviceDetailResponse | null;
	const statusDef = dev ? getDeviceStatus(dev.status) : null;
	const statusUI = dev ? getDeviceStatusUI(dev.status) : null;
	const isOnline = dev?.status === "online";
	const seenDate = dev?.last_seen_at ? new Date(dev.last_seen_at * 1000) : null;
	const syncDate = dev?.last_sync_at ? new Date(dev.last_sync_at * 1000) : null;

	return (
		<div style={{ padding: "0" }}>
			{/* Header */}
			<div style={{ padding: "16px 24px" }}>
				<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
					{statusUI && (
						<StatusDot status={statusUI.dotColor} pulsing={!!isOnline} />
					)}
					<Heading level="h3" color="primary">
						{dev?.label ?? serialNumber}
					</Heading>
				</div>
				{dev?.label && (
					<Text variant="caption" color="tertiary">
						{serialNumber}
					</Text>
				)}
				{statusDef && (
					<div style={{ marginTop: "8px" }}>
						<Badge variant={statusUI?.variant ?? "neutral"} dot={statusUI?.dotColor}>
							{statusDef.label}
						</Badge>
					</div>
				)}
			</div>

			<Separator />

			{dev ? (
				<>
					{/* Identity & Connection */}
					<DetailGrid>
						<DetailItem label={_(msg`Host`)}>
							<Text variant="body">{dev.host}:{dev.port}</Text>
						</DetailItem>

						{dev.model && (
							<DetailItem label={_(msg`Model`)}>
								<Text variant="body">{dev.model}</Text>
							</DetailItem>
						)}

						{dev.firmware_version && (
							<DetailItem label={_(msg`Firmware`)}>
								<Text variant="body">{dev.firmware_version}</Text>
							</DetailItem>
						)}

						{dev.vendor && (
							<DetailItem label={_(msg`Vendor`)}>
								<Text variant="body">{dev.vendor}</Text>
							</DetailItem>
						)}

						{seenDate && (
							<DetailItem label={_(msg`Last Seen`)}>
								<Text variant="body">
									{seenDate.toLocaleDateString()} {seenDate.toLocaleTimeString()}
								</Text>
							</DetailItem>
						)}
					</DetailGrid>

					<Separator />

					{/* Capacity */}
					<DetailGrid>
						<DetailItem label={_(msg`Users`)}>
							<StorageGauge
								percentage={dev.user_capacity > 0 ? (dev.user_count / dev.user_capacity) * 100 : 0}
								current={dev.user_count}
								capacity={dev.user_capacity}
								label={_(msg`users`)}
							/>
						</DetailItem>

						<DetailItem label={_(msg`Records`)}>
							<StorageGauge
								percentage={dev.record_capacity > 0 ? (dev.record_count / dev.record_capacity) * 100 : 0}
								current={dev.record_count}
								capacity={dev.record_capacity}
								label={_(msg`records`)}
							/>
						</DetailItem>

						{dev.fingerprint_capacity > 0 && (
							<DetailItem label={_(msg`Fingerprints`)}>
								<StorageGauge
									percentage={dev.fingerprint_capacity > 0 ? (dev.fingerprint_count / dev.fingerprint_capacity) * 100 : 0}
									current={dev.fingerprint_count}
									capacity={dev.fingerprint_capacity}
									label={_(msg`prints`)}
								/>
							</DetailItem>
						)}
					</DetailGrid>

					{syncDate && (
						<>
							<Separator />
							<DetailGrid>
								<DetailItem label={_(msg`Last Sync`)}>
									<Text variant="body">
										{syncDate.toLocaleDateString()} {syncDate.toLocaleTimeString()}
									</Text>
								</DetailItem>
							</DetailGrid>
						</>
					)}
				</>
			) : (
				<div style={{ padding: "24px" }}>
					<Text variant="body" color="secondary">
						{_(msg`Device details will be available when connected to the timekeep server.`)}
					</Text>
				</div>
			)}
		</div>
	);
}
