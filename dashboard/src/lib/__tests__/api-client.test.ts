import { describe, it, expect, vi, beforeEach } from "vitest";
import { HTTPError } from "ky";
import { createApiClient, setApiClient, apiClient } from "../api-client";

// ── Mock localStorage ────────────────────────────────────────────────────────

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const k of Object.keys(store)) delete store[k];
  }),
};

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

// ── Helpers ──────────────────────────────────────────────────────────────────

const BASE = "http://test.local/api";

function mockFetch(status: number, body: unknown = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status }))),
  );
}

function getLastRequest(): Request | undefined {
  const spy = vi.mocked(globalThis.fetch as any);
  return spy?.mock?.calls?.[0]?.[0] as Request | undefined;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("createApiClient", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("injects auth header from token provider", async () => {
    const getToken = vi.fn(() => "test-jwt");
    const client = createApiClient({ baseUrl: BASE, getToken, retries: 0 });
    mockFetch(200, { ok: true });

    await client.get("me").json();

    expect(getToken).toHaveBeenCalled();
    expect(getLastRequest()?.headers.get("Authorization")).toBe("Bearer test-jwt");
  });

  it("does not inject auth header when no token", async () => {
    const getToken = vi.fn(() => null);
    const client = createApiClient({ baseUrl: BASE, getToken, retries: 0 });
    mockFetch(200, { ok: true });

    await client.get("me").json();

    expect(getLastRequest()?.headers.get("Authorization")).toBeNull();
  });

  it("calls onUnauthorized on 401", async () => {
    const onUnauthorized = vi.fn();
    const client = createApiClient({ baseUrl: BASE, onUnauthorized, retries: 0 });
    mockFetch(401, { error: "unauthorized" });

    try {
      await client.get("me").json();
    } catch {
      /* expected */
    }

    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("throws HTTPError with status on non-2xx", async () => {
    const client = createApiClient({ baseUrl: BASE, retries: 0 });
    mockFetch(404, { error: "not found" });

    const promise = client.get("missing").json();
    await expect(promise).rejects.toThrow(HTTPError);
    await expect(promise).rejects.toHaveProperty("response.status", 404);
  });

  it("default getToken reads from localStorage", async () => {
    localStorageMock.setItem("ao-auth", "stored-jwt");
    const client = createApiClient({ baseUrl: BASE, retries: 0 });
    mockFetch(200, {});

    await client.get("me").json();

    expect(getLastRequest()?.headers.get("Authorization")).toBe("Bearer stored-jwt");
  });
});

describe("apiClient singleton", () => {
  it("allows setApiClient for test injection", () => {
    const mock = createApiClient({ baseUrl: "http://mock.local/api" });
    setApiClient(mock);
    expect(apiClient()).toBe(mock);
    setApiClient(createApiClient({ baseUrl: BASE }));
  });
});
