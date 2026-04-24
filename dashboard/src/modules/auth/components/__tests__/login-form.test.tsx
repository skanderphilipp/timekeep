import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { createServer } from "@/testing/msw/server";
import { createRenderWrapper } from "@/testing/render-with-providers";
import * as api from "@/lib/api";
import { LoginForm } from "../login-form";

// ── MSW server ───────────────────────────────────────────────────────────────

const server = createServer();
const { render } = createRenderWrapper();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

// ── Helpers ──────────────────────────────────────────────────────────────────

function getSubmitButton() {
  return screen.getByRole("button", { name: /sign in/i });
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("admin"), "admin");
  await user.type(screen.getByPlaceholderText("••••••••"), "admin");
  await user.click(getSubmitButton());
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("LoginForm", () => {
  it("renders the form with fields and submit button", () => {
    render(<LoginForm />);

    expect(getSubmitButton()).toBeInTheDocument();
    expect(screen.getByPlaceholderText("admin")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
  });

  it("shows validation errors on empty submit", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(getSubmitButton());

    await waitFor(() => {
      expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(2);
    });
  });

  it("calls login API with credentials on submit", async () => {
    const loginSpy = vi.spyOn(api, "login").mockResolvedValue({
      token: "fake-jwt",
      expires_in: 86400,
      token_type: "Bearer",
      username: "admin",
      role: "admin",
      permissions: "read:punches write:punches read:devices write:devices manage:users manage:commands",
    });

    const user = userEvent.setup();
    render(<LoginForm />);

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledWith({
        username: "admin",
        password: "admin",
      });
    });
  });

  it("displays error from API on failed login", async () => {
    // MSW returns 401 — ky wraps in HTTPError
    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json({ error: "Bad credentials" }, { status: 401 }),
      ),
    );

    const user = userEvent.setup();
    render(<LoginForm />);

    await fillAndSubmit(user);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});
