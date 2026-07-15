import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";

import {
  sidePanelSubPageStackAtom,
  sidePanelCurrentSubPageAtom,
  sidePanelCanGoBackSubPageAtom,
  pushSubPageAtom,
  popSubPageAtom,
  clearSubPagesAtom,
} from "../side-panel-sub-page-stack";

let subPageCounter = 0;

/**
 * Hook for side panel sub-page navigation (Pattern 2: Guided Flows).
 *
 * Used by multi-step wizards to push/pop steps within the side panel.
 * Each step is a SubPageEntry with an identifier, title, and optional params.
 *
 * Twenty reference:
 *   `twenty-front/src/modules/side-panel/hooks/useSidePanelSubPageHistory.ts`
 *
 * @example
 * ```tsx
 * const { currentStep, pushStep, goBack, canGoBack } = useSidePanelSubPage();
 *
 * // Advance to next step
 * pushStep("configure", "Configure Device", { ip: "10.0.1.5" });
 *
 * // Go back
 * goBack();
 *
 * // Render based on current step
 * switch (currentStep?.step) {
 *   case "scan": return <ScanStep />;
 *   case "configure": return <ConfigureStep params={currentStep.params} />;
 * }
 * ```
 */
export function useSidePanelSubPage() {
  const stack = useAtomValue(sidePanelSubPageStackAtom);
  const currentStep = useAtomValue(sidePanelCurrentSubPageAtom);
  const canGoBack = useAtomValue(sidePanelCanGoBackSubPageAtom);

  const push = useSetAtom(pushSubPageAtom);
  const pop = useSetAtom(popSubPageAtom);
  const clear = useSetAtom(clearSubPagesAtom);

  /** Push a new step onto the sub-page stack. */
  const pushStep = useCallback(
    (step: string, title: string, params?: Record<string, unknown>) => {
      push({
        id: `sub-page-${++subPageCounter}`,
        step,
        title,
        params,
      });
    },
    [push],
  );

  /** Pop the current step (go back). */
  const goBack = useCallback(() => pop(), [pop]);

  /** Clear all sub-pages and return to the root. */
  const reset = useCallback(() => clear(), [clear]);

  return {
    /** All steps in the stack. */
    stack,
    /** The currently active step (top of stack), or null if at root. */
    currentStep,
    /** Whether there's a previous step to go back to. */
    canGoBack,
    /** Push a new step. */
    pushStep,
    /** Go back one step. */
    goBack,
    /** Clear all steps and return to root. */
    reset,
  };
}
