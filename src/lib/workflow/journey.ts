// src/lib/workflow/journey.ts
// Single source of truth for the case → application journey.
// Both the client and admin UIs read from this file. Copy lives in next-intl
// messages under the "Journey" namespace, keyed by status name.

export const STAGES = [1, 2, 3, 4, 5] as const;
export type Stage = (typeof STAGES)[number];

export type Actor = "client" | "admin" | "none";

export type JourneyStatus =
	// Dashboard-only pseudo statuses (no case row yet / profile not complete)
	| "profile_incomplete"
	| "no_case"
	| "draft_intake"
	| "intake_submitted"
	| "consultation_requested"
	| "consultation_booked"
	| "consultation_completed"
	| "plan_created"
	| "requirements_added"
	| "closed"
	| "application_activated"
	| "not_started"
	| "waiting_documents"
	| "documents_under_review"
	| "documents_approved"
	| "documents_not_approved"
	| "visa_journey_started"
	| "visa_issue_action_needed"
	| "finished"
	| "cancelled";

export type JourneyEntry = {
	stage: Stage;
	/** This status finishes its stage: the tracker ticks it and highlights the next one. */
	complete?: true;
	/** Who must act next. Drives the "Your turn" / "Waiting" badge. */
	actor: Actor;
	/** "done" = journey succeeded, "stopped" = ended without success. */
	terminal?: "done" | "stopped";
	/** Client call-to-action kind. The page maps it to a siteConfig href. */
	cta?: "profile" | "newCase" | "case" | "application";
};

export const JOURNEY: Record<JourneyStatus, JourneyEntry> = {
	// Stage 1: Get started (profile → create case → intake)
	profile_incomplete:       { stage: 1, actor: "client", cta: "profile" },
	no_case:                  { stage: 1, actor: "client", cta: "newCase" },
	draft_intake:             { stage: 1, actor: "client", cta: "case" },
	intake_submitted:         { stage: 1, actor: "admin", complete: true },

	// Stage 2: Consultation (offline; admin sets status manually)
	consultation_requested:   { stage: 2, actor: "admin" },
	consultation_booked:      { stage: 2, actor: "admin" },
	consultation_completed:   { stage: 2, actor: "admin", complete: true },

	// Stage 3: Plan (closed = denied after consultation)
	plan_created:             { stage: 3, actor: "admin", complete: true },
	requirements_added:       { stage: 3, actor: "admin", complete: true },
	closed:                   { stage: 3, actor: "none", terminal: "stopped" },
	not_started:              { stage: 3, actor: "none" }, // application placeholder, pre-activation

	// Stage 4: Documents
	application_activated:    { stage: 4, actor: "client", cta: "application" },
	waiting_documents:        { stage: 4, actor: "client", cta: "application" },
	documents_under_review:   { stage: 4, actor: "admin" },
	documents_not_approved:   { stage: 4, actor: "client", cta: "application" },
	documents_approved:       { stage: 4, actor: "admin", complete: true },

	// Stage 5: Visa journey (consultant works offline with Home Affairs)
	visa_journey_started:     { stage: 5, actor: "admin" },
	visa_issue_action_needed: { stage: 5, actor: "admin" },
	finished:                 { stage: 5, actor: "none", terminal: "done" },
	cancelled:                { stage: 5, actor: "none", terminal: "stopped" },
};

export function getJourney(status: string | null | undefined): (JourneyEntry & { status: JourneyStatus }) | null {
	if (!status || !(status in JOURNEY)) return null;
	const key = status as JourneyStatus;
	return { status: key, ...JOURNEY[key] };
}

/**
 * Case status is `application_activated` once activated, but the linked application
 * moves on (waiting_documents → ... → finished). Use the application's status when it
 * exists and has left the `not_started` placeholder.
 */
export function resolveJourneyStatus(caseStatus: string, applicationStatus?: string | null): string {
	if (caseStatus === "application_activated" || caseStatus === "requirements_added") {
		if (applicationStatus && applicationStatus !== "not_started") return applicationStatus;
	}
	return caseStatus;
}

/* ------------------------------------------------------------------ */
/* Admin: valid next transitions (encodes the fast-track rule too)     */
/* ------------------------------------------------------------------ */

export type NextAction = {
	to: JourneyStatus;
	kind: "primary" | "secondary" | "danger";
	/** Show a confirmation dialog first (copy: Journey.admin.confirm.<to>). */
	confirm?: boolean;
};

export const NEXT_ACTIONS: Partial<Record<JourneyStatus, NextAction[]>> = {
	intake_submitted: [
		{ to: "consultation_booked", kind: "primary" },
		{ to: "consultation_completed", kind: "secondary" }, // fast-track
	],
	consultation_requested: [
		{ to: "consultation_booked", kind: "primary" },
		{ to: "consultation_completed", kind: "secondary" }, // fast-track
	],
	consultation_booked: [{ to: "consultation_completed", kind: "primary" }],
	consultation_completed: [
		{ to: "plan_created", kind: "primary" },
		{ to: "closed", kind: "danger", confirm: true },
	],
	plan_created: [{ to: "requirements_added", kind: "primary" }],
	requirements_added: [{ to: "application_activated", kind: "primary", confirm: true }],
	documents_under_review: [
		{ to: "documents_approved", kind: "primary" },
		{ to: "documents_not_approved", kind: "secondary" },
	],
	documents_not_approved: [{ to: "documents_under_review", kind: "secondary" }],
	documents_approved: [{ to: "visa_journey_started", kind: "primary" }],
	visa_journey_started: [
		{ to: "finished", kind: "primary" },
		{ to: "visa_issue_action_needed", kind: "secondary" },
		{ to: "cancelled", kind: "danger", confirm: true },
	],
	visa_issue_action_needed: [
		{ to: "visa_journey_started", kind: "primary" },
		{ to: "finished", kind: "secondary" },
		{ to: "cancelled", kind: "danger", confirm: true },
	],
};
