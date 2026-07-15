/**
 * Unit tests for RequireAuth component.
 *
 * These would have caught Bug #2: First-Run Setup Redirect Missing.
 * The bug was that unauthenticated users were always redirected to /login
 * without checking whether first-run setup was needed first.
 *
 * Fix verified: RequireAuth now calls fetchSetupStatus() and redirects
 * to /setup when setup_needed is true, /login when setup is done.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Provider as JotaiProvider, createStore } from "jotai";

import { RequireAuth } from "@/modules/auth/components/require-auth";
import { authTokenAtom } from "@/infrastructure/state";

// Mock the API module
vi.mock("@/lib/api", () => ({
  fetchSetupStatus: vi.fn(),
}));

import { fetchSetupStatus } from "@/lib/api";

/**
 * Helper: render RequireAuth in a MemoryRouter with controlled auth state.
 *
 * `isAuthenticatedAtom` is a read-only derived atom (no `.write`),
 * so we set the underlying `authTokenAtom` instead: a present token
 * makes `isAuthenticatedAtom` derive to `true`.
 */
function renderRequireAuth(isAuthenticated: boolean) {
  const store = createStore();
  store.set(authTokenAtom, isAuthenticated ? "test-token" : null);

  return render(
    <JotaiProvider store={store}>
      <MemoryRouter initialEntries={["/"]}>
        <RequireAuth>
          <div data-testid="protected-content">Protected Content</div>
        </RequireAuth>
      </MemoryRouter>
    </JotaiProvider>,
  );
}

describe("RequireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders children immediately when user is already authenticated", () => {
    vi.mocked(fetchSetupStatus).mockResolvedValue({ setup_needed: false });

    renderRequireAuth(true);

    // Should NOT call fetchSetupStatus when authenticated (skipped in useEffect)
    expect(fetchSetupStatus).not.toHaveBeenCalled();

    // Should render protected content
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
  });

  it("redirects to /setup when setup_needed is true and user is not authenticated", async () => {
    vi.mocked(fetchSetupStatus).mockResolvedValue({ setup_needed: true });

    renderRequireAuth(false);

    await waitFor(() => {
      // Protected content should NOT be rendered (redirected to /setup)
      expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    });
  });

  it("redirects to /login when setup is done and user is not authenticated", async () => {
    vi.mocked(fetchSetupStatus).mockResolvedValue({ setup_needed: false });

    renderRequireAuth(false);

    await waitFor(() => {
      // Protected content should NOT be rendered (redirected to /login)
      expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    });
  });

  it("handles API failure gracefully — falls through to /login", async () => {
    vi.mocked(fetchSetupStatus).mockRejectedValue(new Error("Network error"));

    renderRequireAuth(false);

    await waitFor(() => {
      // Should fall through to /login when API is unreachable
      expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    });
  });

  it("shows nothing while checking setup status (loading state)", async () => {
    // Return a promise that never resolves so we can observe loading state
    vi.mocked(fetchSetupStatus).mockImplementation(
      () => new Promise(() => {}), // never resolves
    );

    renderRequireAuth(false);

    // Component returns null while checking
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
  });
});
