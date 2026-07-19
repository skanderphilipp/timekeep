/**
 * RecordDetailRenderer attendance data test — SKIPPED.
 *
 * TODO(ENTERPRISE): Enable when full Jotai + Router test infrastructure is in place.
 *
 * Phase: Testing hardening (before production)
 * Impact: Cannot integration-test the employee attendance bug fix yet.
 * Fix: Create a test wrapper with:
 *   - Jotai Provider with openSidePanelAtom
 *   - MemoryRouter with proper route params
 *   - Lingui I18nProvider
 *   - Mocked entity definitions registry
 *   - Mocked useRecordDetail, useRecordNavigation hooks
 *
 * WHAT THIS TEST SHOULD VALIDATE (Bug 1):
 *   RecordDetailRenderer passes {} as WorkDayQuery → API receives no date params
 *   After fix: should pass monthly date range as from/to Unix timestamps
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// These imports need proper mocking infrastructure
// import { render, screen, waitFor } from "@testing-library/react";
// import { RecordDetailRenderer } from "./record-detail-renderer";

describe.skip("RecordDetailRenderer — employee attendance (Bug 1)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("TODO: validate that empty WorkDayQuery {} is passed to API", () => {
		// When RecordDetailRenderer renders an employee detail,
		// it should call fetchEmployeeWorkDays/Summary with a date range.
		// Currently: {} (Bug 1)
		// Expected: { from: monthStart, to: monthEnd }
		expect(true).toBe(true);
	});

	it("TODO: validate employee name is rendered", () => {
		expect(true).toBe(true);
	});
});
