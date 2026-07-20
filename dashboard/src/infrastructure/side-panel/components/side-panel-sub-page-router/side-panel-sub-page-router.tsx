import { type ReactNode } from "react";
import { useLingui } from "@lingui/react";
import { msg } from "@lingui/core/macro";
import { IconArrowLeft } from "@tabler/icons-react";

import { useSidePanelSubPage } from "@/infrastructure/side-panel/hooks/use-side-panel-sub-page";

import styles from "./side-panel-sub-page-router.module.scss";

// ── Types ──────────────────────────────────────────────────────────────────

type SidePanelSubPageRouterProps = {
  /**
   * The root content — rendered when there are no sub-pages on the stack.
   * This is typically a SchemaForm or a wizard entry screen.
   */
  children: ReactNode;
  /**
   * Map of step identifiers → React components.
   * Each component receives `params` from the previous step via `currentStep.params`.
   *
   * @example
   * ```tsx
   * <SidePanelSubPageRouter
   *   stepMap={{
   *     scan: ({ onNext, onBack }) => <DeviceScanStep onNext={onNext} onBack={onBack} />,
   *     configure: ({ params, onNext, onBack }) => (
   *       <DeviceConfigureStep ip={params?.ip as string} onNext={onNext} onBack={onBack} />
   *     ),
   *   }}
   * >
   *   <RootContent />
   * </SidePanelSubPageRouter>
   * ```
   */
  stepMap?: Record<
    string,
    React.ComponentType<{
      params?: Record<string, unknown>;
      pushStep: (step: string, title: string, params?: Record<string, unknown>) => void;
      goBack: () => void;
    }>
  >;
};

// ── Component ──────────────────────────────────────────────────────────────

/**
 * Renders the current sub-page with a back-button navigation header.
 *
 * When the sub-page stack is empty, renders `children` (the root content).
 * When a sub-page is active, renders the matching component from `stepMap`
 * with a back-button header and step title.
 */
export function SidePanelSubPageRouter({
  children,
  stepMap,
}: SidePanelSubPageRouterProps) {
  const { _ } = useLingui();
  const { currentStep, canGoBack, pushStep, goBack } = useSidePanelSubPage();

  // No sub-page active → render root content
  if (!currentStep) {
    return <>{children}</>;
  }

  // Render the sub-page
  const StepComponent = stepMap?.[currentStep.step];

  return (
    <div className={styles.container}>
      {/* Navigation header with back button */}
      <div className={styles.navHeader}>
        <button
          type="button"
          className={styles.backButton}
          onClick={goBack}
          aria-label={_(msg`Go back`)}
        >
          <IconArrowLeft size={14} />
          <span className={styles.backLabel}>
            {canGoBack ? currentStep.title : _(msg`Back`)}
          </span>
        </button>
      </div>

      {/* Step content */}
      <div className={styles.stepContent}>
        {StepComponent ? (
          <StepComponent
            key={currentStep.id} // remount on step change
            params={currentStep.params}
            pushStep={pushStep}
            goBack={goBack}
          />
        ) : (
          <div className={styles.placeholder}>
            <p>{_(msg`Step "${currentStep.step}" not found in stepMap.`)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

SidePanelSubPageRouter.displayName = "SidePanelSubPageRouter";
