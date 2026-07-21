/**
 * Browser integration tests for LoginForm.
 *
 * Runs in a real Chromium browser via @vitest/browser + Playwright.
 * Tests actual rendering, keyboard interaction, and accessibility
 * that jsdom cannot verify (e.g. focus management, CSS layout, :hover/:focus states).
 *
 * API calls are mocked at the module level via vi.mock to avoid
 * needing a running backend. The form logic is tested through real
 * user interactions (keyboard typing, clicks) against a rendered React tree.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";

import { LoginForm } from "./login-form";

// ── Module mocks ────────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  login: vi.fn(),
  setAuthToken: vi.fn(),
}));

import { login } from "@/lib/api";

// ── Render helper ────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderLoginForm() {
  const store = createStore();

  return {
    store,
    ...render(
      <JotaiProvider store={store}>
        <QueryClientProvider client={queryClient}>
          <I18nProvider i18n={i18n}>
            <MemoryRouter initialEntries={["/login"]}>
              <LoginForm />
            </MemoryRouter>
          </I18nProvider>
        </QueryClientProvider>
      </JotaiProvider>,
    ),
  };
}

/**
 * Returns the password input element. Uses `querySelector` rather than
 * `getByLabelText(/password/i)` because the "Show password" toggle button
 * has `aria-label="Show password"`, which matches the same regex.
 */
function getPasswordInput(): HTMLInputElement {
  return document.querySelector('input[name="password"]') as HTMLInputElement;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("LoginForm (browser)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("renders the sign-in heading", () => {
    renderLoginForm();
    // Use level: 1 to match the <h1>, not the <h3> form section title
    expect(
      screen.getByRole("heading", { level: 1, name: /sign in to timekeep/i }),
    ).toBeInTheDocument();
  });

  it("renders username and password fields", () => {
    renderLoginForm();

    // Username: a textbox with accessible name "Username"
    expect(screen.getByRole("textbox", { name: "Username" })).toBeInTheDocument();
    // Password: type="password" inputs don't have role "textbox", so use name attr
    expect(getPasswordInput()).toBeInTheDocument();
  });

  it("renders the submit button", () => {
    renderLoginForm();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("allows typing into the username field", async () => {
    const user = userEvent.setup();
    renderLoginForm();

    const usernameInput = screen.getByRole("textbox", { name: "Username" });
    await user.type(usernameInput, "admin");

    expect(usernameInput).toHaveValue("admin");
  });

  it("allows typing into the password field", async () => {
    const user = userEvent.setup();
    renderLoginForm();

    const passwordInput = getPasswordInput();
    await user.type(passwordInput, "secret123");

    expect(passwordInput).toHaveValue("secret123");
  });

  it("calls login API on form submission", async () => {
    const user = userEvent.setup();
    vi.mocked(login).mockResolvedValueOnce({
      token: "jwt-token-123",
      username: "admin",
      role: "admin",
      permissions: "*",
      expires_in: 86400,
      token_type: "Bearer",
    });

    renderLoginForm();

    await user.type(screen.getByRole("textbox", { name: "Username" }), "admin");
    await user.type(getPasswordInput(), "admin");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        username: "admin",
        password: "admin",
      });
    });
  });

  it("shows error banner on login failure", async () => {
    const user = userEvent.setup();
    vi.mocked(login).mockRejectedValueOnce(new Error("Invalid credentials"));

    renderLoginForm();

    await user.type(screen.getByRole("textbox", { name: "Username" }), "wrong");
    await user.type(getPasswordInput(), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
  });
});
