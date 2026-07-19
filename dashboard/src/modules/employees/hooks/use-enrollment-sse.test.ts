import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEnrollmentSSE, type EnrollmentStatus } from "./use-enrollment-sse";

describe("useEnrollmentSSE", () => {
  let mockInstance: {
    addEventListener: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    readyState: number;
    onerror: (() => void) | null;
  };
  let listeners: Map<string, (e: MessageEvent) => void>;

  beforeEach(() => {
    listeners = new Map();
    mockInstance = {
      addEventListener: vi.fn((type: string, handler: (e: MessageEvent) => void) => {
        listeners.set(type, handler);
      }),
      close: vi.fn(),
      readyState: 1, // OPEN
      onerror: null,
    };

    const MockES = function (this: any, _url: string) {
      return mockInstance;
    } as any;
    MockES.CLOSED = 2;
    MockES.CONNECTING = 0;
    MockES.OPEN = 1;
    vi.stubGlobal("EventSource", MockES);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function emit(type: string, data: unknown) {
    const handler = listeners.get(type);
    if (handler) {
      handler(new MessageEvent(type, { data: JSON.stringify(data) }));
    }
  }

  it("starts in connecting phase", () => {
    const { result } = renderHook(() =>
      useEnrollmentSSE("DEV1", "145", true),
    );
    expect(result.current).toEqual({ phase: "connecting" });
  });

  it("transitions to waiting on first finger_score", () => {
    const { result } = renderHook(() =>
      useEnrollmentSSE("DEV1", "145", true),
    );
    act(() => emit("finger_score", { sample: 1, score: 85, status: "retry" }));
    const s = result.current as Extract<EnrollmentStatus, { phase: "waiting" }>;
    expect(s.phase).toBe("waiting");
    expect(s.samples).toHaveLength(1);
    expect(s.samples[0]).toEqual({ sample: 1, score: 85, status: "retry" });
  });

  it("accumulates multiple finger scores", () => {
    const { result } = renderHook(() =>
      useEnrollmentSSE("DEV1", "145", true),
    );
    act(() => {
      emit("finger_score", { sample: 1, score: 100, status: "good" });
      emit("finger_score", { sample: 2, score: 90, status: "retry" });
      emit("finger_score", { sample: 3, score: 100, status: "good" });
    });
    const s = result.current as Extract<EnrollmentStatus, { phase: "waiting" }>;
    expect(s.phase).toBe("waiting");
    expect(s.samples).toHaveLength(3);
    expect(s.samples[0].status).toBe("good");
    expect(s.samples[1].status).toBe("retry");
    expect(s.samples[2].status).toBe("good");
  });

  it("transitions to enrolled", () => {
    const { result } = renderHook(() =>
      useEnrollmentSSE("DEV1", "145", true),
    );
    act(() => emit("fingerprint_enrolled", { template_size: 1024 }));
    expect(result.current.phase).toBe("enrolled");
    expect((result.current as any).templateSize).toBe(1024);
  });

  it("closes EventSource on enrolled", () => {
    renderHook(() => useEnrollmentSSE("DEV1", "145", true));
    act(() => emit("fingerprint_enrolled", { template_size: 512 }));
    expect(mockInstance.close).toHaveBeenCalled();
  });

  it("transitions to failed", () => {
    const { result } = renderHook(() =>
      useEnrollmentSSE("DEV1", "145", true),
    );
    act(() => emit("fingerprint_enroll_failed", { reason: "error" }));
    expect(result.current.phase).toBe("failed");
  });

  it("does not connect when enabled is false", () => {
    // Should not throw — effect is skipped entirely
    renderHook(() => useEnrollmentSSE("DEV1", "145", false));
  });

  it("cleans up on unmount", () => {
    const { unmount } = renderHook(() =>
      useEnrollmentSSE("DEV1", "145", true),
    );
    unmount();
    expect(mockInstance.close).toHaveBeenCalled();
  });

  it("transitions to disconnected on EventSource error", () => {
    const { result } = renderHook(() =>
      useEnrollmentSSE("DEV1", "145", true),
    );
    act(() => {
      mockInstance.readyState = 2; // CLOSED
      mockInstance.onerror?.();
    });
    expect(result.current.phase).toBe("disconnected");
  });

  it("stays enrolled after error", () => {
    const { result } = renderHook(() =>
      useEnrollmentSSE("DEV1", "145", true),
    );
    act(() => emit("fingerprint_enrolled", { template_size: 1024 }));
    act(() => {
      mockInstance.readyState = 2;
      mockInstance.onerror?.();
    });
    expect(result.current.phase).toBe("enrolled");
  });
});
