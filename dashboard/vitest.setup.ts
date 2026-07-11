import "@testing-library/jest-dom/vitest";

// ── ResizeObserver polyfill (Nivo requires it) ───────────────────────────────
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

import { i18n } from "@lingui/core";
import { messages as enMessages } from "@/locales/en";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// ── Lingui ───────────────────────────────────────────────────────────────────

i18n.load({ en: enMessages });
i18n.activate("en");

// ── DOM + state cleanup ─────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  // Clear Jotai atomWithStorage state to prevent cross-test leaks.
  // Specific keys are in src/lib/constants.ts (LS_AUTH, LS_THEME, LS_LOCALE).
  localStorage.clear();
});

// ── Browser API polyfills (Node environment) ─────────────────────────────────

if (typeof globalThis.structuredClone === "undefined") {
  globalThis.structuredClone = (obj: unknown) => JSON.parse(JSON.stringify(obj));
}

if (typeof globalThis.TransformStream === "undefined") {
  const { TransformStream: TS } = await import("node:stream/web");
  Object.defineProperty(globalThis, "TransformStream", { value: TS, writable: true });
}

if (typeof globalThis.ReadableStream === "undefined") {
  const { ReadableStream: RS } = await import("node:stream/web");
  Object.defineProperty(globalThis, "ReadableStream", { value: RS, writable: true });
}

if (typeof globalThis.WritableStream === "undefined") {
  const { WritableStream: WS } = await import("node:stream/web");
  Object.defineProperty(globalThis, "WritableStream", { value: WS, writable: true });
}

// ── localStorage (in-memory fallback) ────────────────────────────────────────

const store = new Map<string, string>();

Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  },
  writable: true,
});

// ── scrollTo ─────────────────────────────────────────────────────────────────

if (typeof window !== "undefined" && !window.scrollTo) {
  window.scrollTo = () => {};
}
