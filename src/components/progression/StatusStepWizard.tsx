import type { ReactNode } from "react";
import AnchorFocus from "./AnchorFocus";
import styles from "./StatusStepWizard.module.css";

export type StatusStep = { key: string; label: string; href?: string };

type Props = {
  steps: StatusStep[];
  activeStep: string;
  ariaLabel: string;
  completedSteps?: string[];
  children?: ReactNode;

  /**
   * Optional i18n formatters. When omitted, English fallbacks are used so
   * existing callers keep working.
   */
  formatEyebrow?: (current: number, total: number) => string;
  formatStepLabel?: (number: number, label: string) => string;
  stepsNavSuffix?: string;
};

/** A single-task progress wizard. It shows only the current meaningful step,
 * while the page renders the existing functional panel for that step below it.
 * Individual database statuses are grouped into journey phases by the page. */
export default function StatusStepWizard({
  steps,
  activeStep,
  ariaLabel,
  completedSteps = [],
  children,
  formatEyebrow,
  formatStepLabel,
  stepsNavSuffix = "steps",
}: Props) {
  if (steps.length === 0) return null;

  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => step.key === activeStep),
  );
  const current = steps[activeIndex] ?? steps[0];
  const isTerminal =
    current.key === "closed" ||
    current.key === "finished" ||
    current.key === "cancelled";
  const progress = isTerminal
    ? 100
    : Math.min(
        100,
        Math.round((activeIndex / Math.max(1, steps.length - 1)) * 100),
      );

  return (
    <section
      id="application-wizard"
      className={styles.wizard}
      aria-label={ariaLabel}
    >
      <AnchorFocus anchorId="application-wizard" />
      <div className={styles.header}>
        <div className={styles.headingGroup}>
          <span className={styles.eyebrow} aria-hidden="true">
            {isTerminal
              ? "✓"
              : formatEyebrow
                ? formatEyebrow(activeIndex + 1, steps.length)
                : `Step ${activeIndex + 1} of ${steps.length}`}
          </span>
          <h2 className={styles.title}>{current.label}</h2>
        </div>
        <span
          className={`${styles.marker} ${isTerminal || completedSteps.includes(current.key) ? styles.completeMarker : styles.currentMarker}`}
          aria-hidden="true"
        >
          {isTerminal || completedSteps.includes(current.key)
            ? "✓"
            : activeIndex + 1}
        </span>
      </div>
      <nav
        aria-label={`${ariaLabel} ${stepsNavSuffix}`}
        className={styles.stepNav}
      >
        <ol className={styles.stepList}>
          {steps.map((step, index) => {
            const isCurrent = step.key === activeStep;
            const isComplete =
              completedSteps.includes(step.key) ||
              (isTerminal && step.key === current.key);
            const marker = isComplete ? "✓" : index + 1;
            const className =
              `${styles.step} ${isCurrent ? styles.stepCurrent : ""} ${isComplete ? styles.stepComplete : ""}`.trim();
            return (
              <li
                key={step.key}
                className={className}
                aria-current={isCurrent ? "step" : undefined}
              >
                {step.href && !isTerminal ? (
                  <a className={styles.stepLink} href={step.href}>
                    <span className={styles.stepNumber} aria-hidden="true">
                      {marker}
                    </span>
                    <span className={styles.stepLabel}>
                      {formatStepLabel
                        ? formatStepLabel(index + 1, step.label)
                        : `Step ${index + 1}: ${step.label}`}
                    </span>
                  </a>
                ) : (
                  <span className={styles.stepLink}>
                    <span className={styles.stepNumber} aria-hidden="true">
                      {marker}
                    </span>
                    <span className={styles.stepLabel}>
                      {formatStepLabel
                        ? formatStepLabel(index + 1, step.label)
                        : `Step ${index + 1}: ${step.label}`}
                    </span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <span
          className={styles.progressFill}
          style={{ width: `${progress}%` }}
        />
      </div>
      {children ? <div className={styles.content}>{children}</div> : null}
    </section>
  );
}

/** Map persisted case statuses into meaningful journey phases.
 * Both the client and admin share this mapping. Intake is "done" the moment
 * the case leaves `draft_intake` — i.e. once the intake has been submitted —
 * because from that point on step 1's content is a receipt, not a task. */
export function getCaseWizardStepKey(status: string): string {
  if (status === "closed" || status === "finished") return status;
  if (status === "draft_intake" || status === "intake_submitted")
    return "intake";
  if (["consultation_requested", "consultation_booked"].includes(status))
    return "consultation";
  if (status === "consultation_completed") return "plan";
  if (status === "plan_created") return "requirements";
  if (status === "requirements_added" || status === "application_activated")
    return "activation";
  return "intake";
}

export function getCaseCompletedStepKeys(status: string): string[] {
  const completed: Record<string, string[]> = {
    draft_intake: [],
    // Intake is complete the moment it is submitted.
    intake_submitted: ["intake"],
    consultation_requested: ["intake"],
    consultation_booked: ["intake"],
    consultation_completed: ["intake", "consultation"],
    plan_created: ["intake", "consultation", "plan"],
    requirements_added: ["intake", "consultation", "plan", "requirements"],
    application_activated: [
      "intake",
      "consultation",
      "plan",
      "requirements",
      "activation",
    ],
    finished: ["intake", "consultation", "plan", "requirements", "activation"],
    closed: [],
  };
  return completed[status] ?? [];
}

/** Map persisted application statuses into document, visa, and terminal steps
 * from the client's point of view. Step 2 stays current until the admin
 * records an outcome (step 3); this is where the client reads journey +
 * consultant notes while Home Affairs is processing.
 */
export function getApplicationWizardStepKey(status: string): string {
  if (status === "finished" || status === "cancelled") return status;
  if (status === "visa_approved") return "outcome";
  if (
    status === "visa_journey_started" ||
    status === "visa_issue_action_needed"
  )
    return "visa_journey";
  if (status === "documents_approved") return "visa_journey";
  return "documents";
}

export function getApplicationCompletedStepKeys(status: string): string[] {
  const completed: Record<string, string[]> = {
    not_started: [],
    waiting_documents: [],
    documents_under_review: [],
    documents_not_approved: [],
    documents_approved: ["documents"],
    visa_journey_started: ["documents"],
    visa_issue_action_needed: ["documents"],
    // Visa approved still sits on step 2 for the client — step 3 is "your
    // outcome" and only becomes done at `finished`. The checkmark on step 2
    // is deliberately NOT set here so the current-step indicator on step 2
    // remains visible and focusable.
    visa_approved: ["documents", "visa_journey", "outcome"],
    finished: ["documents", "visa_journey", "outcome"],
    cancelled: ["documents", "visa_journey", "outcome"],
  };
  return completed[status] ?? [];
}

/** Admin-facing three-stage application journey. */
export function getApplicationAdminWizardStepKey(status: string): string {
  // Step 3 becomes current as soon as the visa journey is underway:
  // nothing else is editable on step 2 once we've started the journey.
  if (
    status === "finished" ||
    status === "cancelled" ||
    status === "visa_approved" ||
    status === "visa_journey_started" ||
    status === "visa_issue_action_needed"
  ) {
    return "outcome";
  }
  // documents_approved is the last documents-only state — still step 2
  // (the admin must actually transition to visa_journey_started).
  if (status === "documents_approved") return "visa_journey";
  return "documents";
}

export function getApplicationAdminCompletedStepKeys(status: string): string[] {
  const completed: Record<string, string[]> = {
    not_started: [],
    waiting_documents: [],
    documents_under_review: [],
    documents_not_approved: [],
    documents_approved: ["documents"],
    // Marked done the moment the admin records that the journey has
    // started with the department. Step 2 has no further state to set.
    visa_journey_started: ["documents", "visa_journey"],
    visa_issue_action_needed: ["documents", "visa_journey"],
    visa_approved: ["documents", "visa_journey", "outcome"],
    cancelled: [],
  };
  return completed[status] ?? [];
}
