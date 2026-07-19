import { useState, useEffect, useRef } from "react";

/**
 * Events emitted by the enrollment SSE stream.
 */
export type EnrollmentEvent =
  | {
      type: "finger_score";
      sample: number;
      score: number;
      status: string;
    }
  | {
      type: "fingerprint_enrolled";
      template_size: number;
    }
  | {
      type: "fingerprint_enroll_failed";
      reason: string;
    }
  | {
      type: "error";
      message: string;
    };

/**
 * Current state of the enrollment process.
 */
export type EnrollmentStatus =
  | { phase: "connecting" }
  | { phase: "waiting"; samples: Array<{ sample: number; score: number; status: string }> }
  | { phase: "enrolled"; templateSize: number }
  | { phase: "failed"; reason: string }
  | { phase: "disconnected" };

/**
 * Hook that connects to the enrollment SSE stream and tracks live progress.
 *
 * After triggering `POST /api/devices/{sn}/users/{pin}/enroll-finger`,
 * call this hook to receive real-time finger score events and enrollment
 * completion/failure notifications.
 *
 * The SSE connection is closed when the component unmounts or when
 * enrollment completes/fails.
 */
export function useEnrollmentSSE(
  deviceSn: string,
  userPin: string,
  enabled: boolean,
) {
  const [status, setStatus] = useState<EnrollmentStatus>({ phase: "connecting" });
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) return;

    setStatus({ phase: "connecting" });

    // Build URL. EventSource does not support Authorization header, so
    // we rely on the HTTP-only cookie set by the login endpoint for auth.
    // TODO(ENTERPRISE): Add token-in-query-param fallback to auth middleware.
    const url = `/api/devices/${encodeURIComponent(deviceSn)}/enrollment-events?pin=${encodeURIComponent(userPin)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener("finger_score", (e: MessageEvent) => {
      const data = JSON.parse(e.data) as {
        sample: number;
        score: number;
        status: string;
      };
      setStatus((prev) => {
        const samples =
          prev.phase === "waiting"
            ? [...prev.samples, { sample: data.sample, score: data.score, status: data.status }]
            : [{ sample: data.sample, score: data.score, status: data.status }];
        return { phase: "waiting", samples };
      });
    });

    es.addEventListener("fingerprint_enrolled", (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { template_size: number };
      setStatus({ phase: "enrolled", templateSize: data.template_size });
      es.close();
    });

    es.addEventListener("fingerprint_enroll_failed", (e: MessageEvent) => {
      const data = JSON.parse(e.data) as { reason: string };
      setStatus({ phase: "failed", reason: data.reason });
      es.close();
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setStatus((prev) => {
          if (prev.phase === "enrolled" || prev.phase === "failed") return prev;
          return { phase: "disconnected" };
        });
      }
    };

    return () => {
      es.close();
    };
  }, [deviceSn, userPin, enabled]);

  return status;
}
