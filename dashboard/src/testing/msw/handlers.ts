import { http, HttpResponse, type HttpHandler } from "msw";
import { DEFAULT_ZKTECO_PORT } from "@/lib/constants";
import type { ApiEnvelope, PageMeta } from "@/lib/api-client";
import type {
  LoginResponse,
  DeviceSummary,
  DeviceConfig,
  TodaySummary,
  Punch,
  PunchCorrectedResponse,
  AuditEvent,
} from "@/lib/api";

// ── Envelope helpers ──────────────────────────────────────────────────────────
//
// Every Rust endpoint wraps its response in `ApiEnvelope<T>`:
//   { "data": {...}, "meta": {...}, "error": null }
//
// These helpers mirror `ApiEnvelope::success()` and `ApiEnvelope::error()`
// from `crates/timekeep-api/src/response.rs`.

function envelope<T>(data: T, meta?: PageMeta): ApiEnvelope<T> {
  return { data, meta: meta ?? null, error: null };
}

function envelopeError(code: string, message: string): ApiEnvelope<null> {
  return { data: null as unknown as null, meta: null, error: { code, message } };
}

// ── Defaults (match Rust DTOs exactly) ────────────────────────────────────────

const NOW_SECONDS = () => Math.floor(Date.now() / 1000);

const DEFAULT_DEVICES: DeviceConfig[] = [
  {
    serial_number: "TEST001",
    label: "Test Scanner",
    host: "192.168.1.100",
    port: DEFAULT_ZKTECO_PORT,
    comm_key: 0,
    push_enabled: true,
    timezone: "Asia/Riyadh",
  },
];

const DEFAULT_TODAY: TodaySummary = {
  date: NOW_SECONDS(),
  present: 42,
  absent: 8,
  late: 3,
  on_time: 39,
  total_employees: 50,
  total_punches: 84,
  check_ins: 42,
  check_outs: 42,
  last_punch_at: NOW_SECONDS(),
};

const DEFAULT_PUNCHES: Punch[] = [
  {
    id: "a1b2c3d4-20260710-080000-CQZ7232960836-145-0-15-0",
    user_pin: "145",
    timestamp: NOW_SECONDS() - 3600,
    status: "check_in",
    verify_mode: "fingerprint",
    device_sn: "TEST001",
    employee_name: "Ahmed Al-Sabah",
  },
  {
    id: "e5f6g7h8-20260710-170000-CQZ7232960836-145-1-15-0",
    user_pin: "145",
    timestamp: NOW_SECONDS() - 1200,
    status: "check_out",
    verify_mode: "fingerprint",
    device_sn: "TEST001",
    employee_name: "Ahmed Al-Sabah",
  },
];

const DEFAULT_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: "audit-001",
    timestamp: NOW_SECONDS() - 60,
    actor: "admin",
    action: "device.add",
    resource: "/api/devices",
    detail: { serial_number: "TEST001", label: "Main Gate" },
    ip_address: "192.168.1.10",
    status: "success",
    error_message: null,
  },
  {
    id: "audit-002",
    timestamp: NOW_SECONDS() - 180,
    actor: "admin",
    action: "punch.correct",
    resource: "/api/punches/correct",
    detail: { user_pin: "145" },
    ip_address: "192.168.1.10",
    status: "success",
    error_message: null,
  },
  {
    id: "audit-003",
    timestamp: NOW_SECONDS() - 300,
    actor: "operator_ahmed",
    action: "user.enroll",
    resource: "/api/devices/TEST001/users",
    detail: { user_pin: "203" },
    ip_address: "192.168.1.20",
    status: "success",
    error_message: null,
  },
];

// ── Handler options ───────────────────────────────────────────────────────────

export type HandlerOptions = {
  /** Custom login credentials. Default: admin/admin → valid token. */
  validCredentials?: { username: string; password: string };
  /** Devices to return from GET /api/devices and GET /api/devices/:sn. */
  devices?: DeviceConfig[];
  /** Today summary to return from GET /api/dashboard/today. */
  todaySummary?: TodaySummary;
  /** Punches to return from GET /api/punches. */
  punches?: Punch[];
  /** Audit events to return from GET /api/audit. */
  auditEvents?: AuditEvent[];
};

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates MSW handlers for the timekeep management API.
 *
 * Every handler mirrors the real Rust endpoints exactly:
 * - All success responses are wrapped in `ApiEnvelope<T>` via `envelope()`.
 * - All error responses use `envelopeError(code, message)` + proper HTTP status.
 * - Data shapes match the Rust DTOs in `crates/timekeep-api/src/dto.rs`.
 *
 * Each call returns fresh handlers with the given data, so tests can
 * customize responses without cross-test pollution.
 *
 * @example
 *   // Per-test override:
 *   server.use(...createHandlers({ devices: [customDevice] }));
 *
 *   // Per-endpoint override:
 *   server.use(http.get("/api/devices", () => HttpResponse.json(...)));
 */
export function createHandlers(opts: HandlerOptions = {}): HttpHandler[] {
  const {
    validCredentials = { username: "admin", password: "admin" },
    devices = DEFAULT_DEVICES,
    todaySummary = DEFAULT_TODAY,
    punches = DEFAULT_PUNCHES,
    auditEvents = DEFAULT_AUDIT_EVENTS,
  } = opts;

  // Derive the DeviceSummary list from the full DeviceConfig array (the list
  // endpoint omits `comm_key` and `timezone` — matches Rust `DeviceSummary`).
  const deviceSummaries: DeviceSummary[] = devices.map((d) => ({
    serial_number: d.serial_number,
    label: d.label,
    host: d.host,
    port: d.port,
    push_enabled: d.push_enabled,
    connection_status: "offline",
    adms_active: false,
    sdk_poll_active: false,
  }));

  return [
    // ── Auth ─────────────────────────────────────────────────────────────────
    http.post("/api/auth/login", async ({ request }) => {
      const body = (await request.json()) as { username: string; password: string };
      if (
        body.username === validCredentials.username &&
        body.password === validCredentials.password
      ) {
        const data: LoginResponse = {
          token: "msw-mock-jwt-token",
          expires_in: 86400,
          token_type: "Bearer",
          username: "admin",
          role: "admin",
          permissions:
            "read:punches write:punches read:devices write:devices manage:users manage:commands",
        };
        return HttpResponse.json(envelope(data));
      }
      return HttpResponse.json(envelopeError("unauthorized", "authentication required"), {
        status: 401,
      });
    }),

    // ── Devices ──────────────────────────────────────────────────────────────

    // GET /api/devices — list all registered devices.
    // Rust: ApiEnvelope<Vec<DeviceSummary>> with PageMeta::with_total()
    http.get("/api/devices", () => {
      const meta: PageMeta = {
        has_more: false,
        total: deviceSummaries.length,
      };
      return HttpResponse.json(envelope(deviceSummaries, meta));
    }),

    // GET /api/devices/:sn — single device detail.
    // Rust: ApiEnvelope<DeviceDetailResponse> (flattened DeviceResponse + status/model/fw)
    http.get("/api/devices/:sn", ({ params }) => {
      const device = devices.find((d) => d.serial_number === params.sn);
      if (!device) {
        return HttpResponse.json(envelopeError("not_found", `device '${params.sn}' not found`), {
          status: 404,
        });
      }
      // Rust DeviceDetailResponse flattens DeviceResponse with extra fields
      const detail = {
        ...device,
        status: "online",
        model: "SpeedFace-V5L [TI]",
        firmware_version: "Ver 8.45",
      };
      return HttpResponse.json(envelope(detail));
    }),

    // POST /api/devices — register a new device.
    // Rust: 201 + ApiEnvelope<DeviceResponse>
    http.post("/api/devices", async ({ request }) => {
      const body = (await request.json()) as DeviceConfig;
      const created: DeviceConfig = {
        serial_number: body.serial_number,
        label: body.label ?? body.serial_number,
        host: body.host,
        port: body.port ?? DEFAULT_ZKTECO_PORT,
        comm_key: body.comm_key ?? 0,
        push_enabled: body.push_enabled ?? true,
        timezone: body.timezone ?? null,
      };
      return HttpResponse.json(envelope(created), { status: 201 });
    }),

    // PUT /api/devices/:sn — update device config.
    // Rust: ApiEnvelope<StatusResponse { status: "updated" }>
    http.put("/api/devices/:sn", async ({ params }) => {
      const exists = devices.some((d) => d.serial_number === params.sn);
      if (!exists) {
        return HttpResponse.json(envelopeError("not_found", `device '${params.sn}' not found`), {
          status: 404,
        });
      }
      return HttpResponse.json(envelope({ status: "updated" }));
    }),

    // DELETE /api/devices/:sn — remove device from registry.
    // Rust: ApiEnvelope<StatusResponse { status: "deleted" }>
    http.delete("/api/devices/:sn", () => HttpResponse.json(envelope({ status: "deleted" }))),

    // ── Dashboard ────────────────────────────────────────────────────────────

    // GET /api/dashboard/today — today's attendance summary.
    // Rust: ApiEnvelope<TodaySummaryResponse>
    http.get("/api/dashboard/today", () => HttpResponse.json(envelope(todaySummary))),

    // ── Punches ──────────────────────────────────────────────────────────────

    // GET /api/punches — query punches with filters + cursor pagination.
    // Rust: ApiEnvelope<PunchListResponse { punches: PunchResponse[] }>
    http.get("/api/punches", ({ request }) => {
      const url = new URL(request.url);
      const deviceSn = url.searchParams.get("device_sn");
      const userPin = url.searchParams.get("user_pin");
      const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);

      let filtered = punches;

      if (deviceSn) {
        filtered = filtered.filter((p) => p.device_sn === deviceSn);
      }
      if (userPin) {
        filtered = filtered.filter((p) => p.user_pin === userPin);
      }

      const hasMore = filtered.length > limit;
      const page = filtered.slice(0, limit);
      const last = page[page.length - 1];

      const meta: PageMeta = {
        has_more: hasMore,
        next_cursor: hasMore && last ? btoa(`${last.timestamp}:${last.id}`) : null,
        total: hasMore ? null : filtered.length,
      };

      return HttpResponse.json(envelope({ punches: page }, meta));
    }),

    // POST /api/punches/correct — manual punch correction (HR override).
    // Rust: 201 + ApiEnvelope<PunchCorrectedResponse>
    http.post("/api/punches/correct", async ({ request }) => {
      const body = (await request.json()) as {
        user_pin: string;
        device_sn: string;
        status: string;
        timestamp?: number;
      };
      const corrected: PunchCorrectedResponse = {
        id: `manual-${Date.now()}`,
        user_pin: body.user_pin,
        timestamp: body.timestamp ?? NOW_SECONDS(),
        status: body.status,
      };
      return HttpResponse.json(envelope(corrected), { status: 201 });
    }),

    // ── Audit ────────────────────────────────────────────────────────────────

    // GET /api/audit — query audit logs with filters + sort + pagination.
    // Rust: ApiEnvelope<Vec<AuditEventResponse>> with PageMeta
    http.get("/api/audit", ({ request }) => {
      const url = new URL(request.url);
      const search = url.searchParams.get("search")?.toLowerCase();
      const sortBy = url.searchParams.get("sort_by") ?? "timestamp";
      const sortOrder = url.searchParams.get("sort_order") ?? "desc";
      const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);

      let filtered = [...auditEvents];

      if (search) {
        filtered = filtered.filter(
          (e) =>
            e.actor.toLowerCase().includes(search) ||
            e.action.toLowerCase().includes(search) ||
            e.resource.toLowerCase().includes(search),
        );
      }

      const dir = sortOrder === "asc" ? 1 : -1;
      filtered.sort((a, b) => {
        const va = sortBy === "actor" ? a.actor : sortBy === "action" ? a.action : a.timestamp;
        const vb = sortBy === "actor" ? b.actor : sortBy === "action" ? b.action : b.timestamp;
        if (typeof va === "string") return (va as string).localeCompare(vb as string) * dir;
        return ((va as number) - (vb as number)) * dir;
      });

      const hasMore = filtered.length > limit;
      const page = filtered.slice(0, limit);

      const meta: PageMeta = {
        has_more: hasMore,
        next_cursor:
          hasMore && page.length > 0
            ? btoa(`${page[page.length - 1].timestamp}:${page[page.length - 1].id}`)
            : null,
        total: filtered.length,
      };

      return HttpResponse.json(envelope(page, meta));
    }),

    // ── Catch-all (MUST be last) ──────────────────────────────────────────
    //
    // Any /api/* request not handled above returns an empty envelope.
    // This prevents unmocked routes from hitting the real network in
    // Storybook / Vitest, avoiding 404 storms and infinite retry loops.
    http.all("/api/*", () => HttpResponse.json(envelope(null))),
  ];
}
