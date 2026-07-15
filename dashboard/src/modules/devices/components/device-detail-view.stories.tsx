import type { Meta, StoryObj } from "@storybook/react";

import { Section, Heading } from "@/components/ui";
import { DeviceDetailView } from "./device-detail-view";
import type { DeviceDetailResponse, DeviceHealthInfo } from "@/lib/api";

// ── Mock data ───────────────────────────────────────────────────────────

const onlineDevice: DeviceDetailResponse = {
  serial_number: "CQZ7232960836",
  label: "Office Entrance",
  host: "192.168.1.100",
  port: 4370,
  comm_key: 0,
  push_enabled: true,
  timezone: "Asia/Riyadh",
  status: "online",
  vendor: "zkteco",
  model: "SpeedFace-V5L",
  firmware_version: "Ver 8.0.2.6-20240315",
  platform: "ZAM170",
  mac_address: "00:17:61:AB:CD:EF",
  last_seen_at: Math.floor(Date.now() / 1000) - 12,
  first_seen_at: Math.floor(Date.now() / 1000) - 86400,
  uptime_seconds: 360000,
  adms_active: true,
  sdk_poll_active: true,
  sdk_last_poll: Math.floor(Date.now() / 1000) - 30,
  user_count: 47,
  user_capacity: 3000,
  record_count: 12500,
  record_capacity: 100000,
  record_usage_pct: 12.5,
  fingerprint_count: 85,
  fingerprint_capacity: 3000,
  face_count: 47,
  face_capacity: 3000,
  last_sync_at: Math.floor(Date.now() / 1000) - 300,
  last_sync_cursor: null,
};

const offlineDevice: DeviceDetailResponse = {
  serial_number: "BIO8865123472",
  label: "Warehouse B",
  host: "192.168.1.200",
  port: 4370,
  comm_key: 0,
  push_enabled: true,
  timezone: null,
  status: "offline",
  vendor: "zkteco",
  model: "MA300",
  firmware_version: "Ver 3.4.1",
  platform: "ZMM220",
  mac_address: null,
  last_seen_at: Math.floor(Date.now() / 1000) - 360,
  first_seen_at: null,
  uptime_seconds: null,
  adms_active: false,
  sdk_poll_active: false,
  sdk_last_poll: null,
  user_count: 12,
  user_capacity: 1500,
  record_count: 3400,
  record_capacity: 50000,
  record_usage_pct: 6.8,
  fingerprint_count: 24,
  fingerprint_capacity: 1500,
  face_count: 0,
  face_capacity: 0,
  last_sync_at: null,
  last_sync_cursor: null,
};

const onlineHealth: DeviceHealthInfo = {
  serial_number: "CQZ7232960836",
  adms_active: true,
  sdk_active: true,
  last_seen_secs_ago: 12,
  last_poll_secs_ago: 30,
};

const offlineHealth: DeviceHealthInfo = {
  serial_number: "BIO8865123472",
  adms_active: false,
  sdk_active: false,
  last_seen_secs_ago: 360,
  last_poll_secs_ago: null,
};

// ── Meta ────────────────────────────────────────────────────────────────

const meta: Meta<typeof DeviceDetailView> = {
  title: "Modules/Devices/DeviceDetailView",
  component: DeviceDetailView,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof DeviceDetailView>;

// ── Stories ─────────────────────────────────────────────────────────────

export const Online: Story = {
  args: {
    device: onlineDevice,
    deviceHealth: onlineHealth,
    isLoading: false,
    error: null,
    onRetry: () => {},
  },
};

export const Offline: Story = {
  args: {
    device: offlineDevice,
    deviceHealth: offlineHealth,
    isLoading: false,
    error: null,
    onRetry: () => {},
  },
};

export const Loading: Story = {
  args: {
    device: undefined,
    deviceHealth: null,
    isLoading: true,
    error: null,
    onRetry: () => {},
  },
};

export const ErrorState: Story = {
  name: "Error",
  args: {
    device: undefined,
    deviceHealth: null,
    isLoading: false,
    error: new Error("Failed to fetch device"),
    onRetry: () => {},
  },
};

export const NoHealthData: Story = {
  args: {
    device: onlineDevice,
    deviceHealth: null,
    isLoading: false,
    error: null,
    onRetry: () => {},
  },
};

export const AllStates: Story = {
  name: "All States",
  parameters: {
    controls: { disable: true },
  },
  render: () => (
    <>
      <Section>
        <Heading level="h3">Online</Heading>
        <DeviceDetailView
          device={onlineDevice}
          deviceHealth={onlineHealth}
          isLoading={false}
          error={null}
          onRetry={() => {}}
        />
      </Section>
      <Section>
        <Heading level="h3">Offline</Heading>
        <DeviceDetailView
          device={offlineDevice}
          deviceHealth={offlineHealth}
          isLoading={false}
          error={null}
          onRetry={() => {}}
        />
      </Section>
      <Section>
        <Heading level="h3">Loading</Heading>
        <DeviceDetailView
          device={undefined}
          deviceHealth={null}
          isLoading
          error={null}
          onRetry={() => {}}
        />
      </Section>
      <Section>
        <Heading level="h3">Error</Heading>
        <DeviceDetailView
          device={undefined}
          deviceHealth={null}
          isLoading={false}
          error={new Error("Failed to fetch device")}
          onRetry={() => {}}
        />
      </Section>
    </>
  ),
};
