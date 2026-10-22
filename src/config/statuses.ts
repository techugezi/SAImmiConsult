/*
DOC NAME: statuses.ts
LOCATION: /src/config/statuses.ts
SCOPE: Single source of truth for status identifiers + UI meta (label keys, description keys, badge tones) + validation helpers.
STATUS: LOCKED
APPLIES TO:
- /src/app/[locale]/(admin)/** (admin pages using case/application status meta)
- /src/app/[locale]/(client)/** (client pages using status meta)
- /src/components/ui/** (CaseRow, status badges, any status-driven UI)
- /src/config/** (any status mapping + tone mapping)
NOTES:
- Public UI contract for tones is semantic only: badge-neutral/action/caution/success/locked.
- UI-facing ordering for Case statuses is CASE_STATUS_ORDER (excludes deprecated statuses).
- Do not rename status IDs, meta keys, or exported constants without coordinated DB + i18n + UI changes.
- No hardcoded English strings here; only key fragments intended to be resolved by i18n dictionaries.
CONTENT:
*/

// src/config/statuses.ts

// ─────────────────────────────────────────────
// Badge semantics (intent → global CSS class)
// ─────────────────────────────────────────────

export const BADGE_TONE = {
	NEUTRAL: "badge-neutral",
	ACTION: "badge-action",
	CAUTION: "badge-caution",
	SUCCESS: "badge-success",
	LOCKED: "badge-locked",
} as const;

export type BadgeTone = (typeof BADGE_TONE)[keyof typeof BADGE_TONE];

// Shorthand aliases (preferred usage)
export const NEUTRAL = BADGE_TONE.NEUTRAL;
export const ACTION = BADGE_TONE.ACTION;
export const CAUTION = BADGE_TONE.CAUTION;
export const SUCCESS = BADGE_TONE.SUCCESS;
export const LOCKED = BADGE_TONE.LOCKED;

// ─────────────────────────────────────────────
// APPLICATION STATUSES
// ─────────────────────────────────────────────

export const APPLICATION_STATUS = {
	NOT_STARTED: "not_started", // deprecated (legacy); default behavior should prefer waiting_documents
	WAITING_DOCUMENTS: "waiting_documents",
	DOCUMENTS_UNDER_REVIEW: "documents_under_review",
	DOCUMENTS_APPROVED: "documents_approved",
	DOCUMENTS_NOT_APPROVED: "documents_not_approved",
	VISA_JOURNEY_STARTED: "visa_journey_started",
	VISA_ISSUE_ACTION_NEEDED: "visa_issue_action_needed",
	VISA_APPROVED: "visa_approved",
	FINISHED: "finished",
	CANCELLED: "cancelled",
} as const;

export type ApplicationStatusId =
	(typeof APPLICATION_STATUS)[keyof typeof APPLICATION_STATUS];

export type ApplicationStatusMeta = {
	id: ApplicationStatusId;
	labelKey: string;
	descriptionKey: string;
	badgeTone: BadgeTone;
};

export const APPLICATION_STATUS_META: Record<
	ApplicationStatusId,
	ApplicationStatusMeta
> = {
	[APPLICATION_STATUS.NOT_STARTED]: {
		id: APPLICATION_STATUS.NOT_STARTED,
		labelKey: "not_started",
		descriptionKey: "not_started_desc",
		badgeTone: NEUTRAL,
	},
	[APPLICATION_STATUS.WAITING_DOCUMENTS]: {
		id: APPLICATION_STATUS.WAITING_DOCUMENTS,
		labelKey: "waiting_documents",
		descriptionKey: "waiting_documents_desc",
		badgeTone: ACTION,
	},
	[APPLICATION_STATUS.DOCUMENTS_UNDER_REVIEW]: {
		id: APPLICATION_STATUS.DOCUMENTS_UNDER_REVIEW,
		labelKey: "documents_under_review",
		descriptionKey: "documents_under_review_desc",
		badgeTone: NEUTRAL,
	},
	[APPLICATION_STATUS.DOCUMENTS_NOT_APPROVED]: {
		id: APPLICATION_STATUS.DOCUMENTS_NOT_APPROVED,
		labelKey: "documents_not_approved",
		descriptionKey: "documents_not_approved_desc",
		badgeTone: CAUTION,
	},
	[APPLICATION_STATUS.DOCUMENTS_APPROVED]: {
		id: APPLICATION_STATUS.DOCUMENTS_APPROVED,
		labelKey: "documents_approved",
		descriptionKey: "documents_approved_desc",
		badgeTone: SUCCESS,
	},
	[APPLICATION_STATUS.VISA_JOURNEY_STARTED]: {
		id: APPLICATION_STATUS.VISA_JOURNEY_STARTED,
		labelKey: "visa_journey_started",
		descriptionKey: "visa_journey_started_desc",
		badgeTone: NEUTRAL,
	},
	[APPLICATION_STATUS.VISA_ISSUE_ACTION_NEEDED]: {
		id: APPLICATION_STATUS.VISA_ISSUE_ACTION_NEEDED,
		labelKey: "visa_issue_action_needed",
		descriptionKey: "visa_issue_action_needed_desc",
		badgeTone: ACTION,
	},
	[APPLICATION_STATUS.VISA_APPROVED]: {
		id: APPLICATION_STATUS.VISA_APPROVED,
		labelKey: "visa_approved",
		descriptionKey: "visa_approved_desc",
		badgeTone: SUCCESS,
	},
	[APPLICATION_STATUS.FINISHED]: {
		id: APPLICATION_STATUS.FINISHED,
		labelKey: "finished",
		descriptionKey: "finished_desc",
		badgeTone: SUCCESS,
	},
	[APPLICATION_STATUS.CANCELLED]: {
		id: APPLICATION_STATUS.CANCELLED,
		labelKey: "cancelled",
		descriptionKey: "cancelled_desc",
		badgeTone: CAUTION,
	},
};

export function isValidApplicationStatus(
	value: unknown,
): value is ApplicationStatusId {
	return Object.values(APPLICATION_STATUS).includes(
		value as ApplicationStatusId,
	);
}

export function getApplicationStatusMeta(
	status: unknown,
): ApplicationStatusMeta {
	const s = typeof status === "string" ? status.trim() : "";
	const effective = isValidApplicationStatus(s)
		? (s as ApplicationStatusId)
		: APPLICATION_STATUS.WAITING_DOCUMENTS;
	return APPLICATION_STATUS_META[effective];
}

// ─────────────────────────────────────────────
// CASE STATUSES
// ─────────────────────────────────────────────

export const CASE_STATUS = {
	DRAFT_INTAKE: "draft_intake",
	INTAKE_SUBMITTED: "intake_submitted",
	CONSULTATION_REQUESTED: "consultation_requested",
	CONSULTATION_BOOKED: "consultation_booked",
	CONSULTATION_COMPLETED: "consultation_completed",
	PLAN_CREATED: "plan_created",
	REQUIREMENTS_ADDED: "requirements_added",
	APPLICATION_ACTIVATED: "application_activated",
	FINISHED: "finished",
	CLOSED: "closed",
} as const;

export const FINISHED = CASE_STATUS.FINISHED;

// Stable ordering for UI (lists, filters, etc.)
export const CASE_STATUS_ORDER = [
	CASE_STATUS.DRAFT_INTAKE,
	CASE_STATUS.INTAKE_SUBMITTED,
	CASE_STATUS.CONSULTATION_REQUESTED,
	CASE_STATUS.CONSULTATION_BOOKED,
	CASE_STATUS.CONSULTATION_COMPLETED,
	CASE_STATUS.PLAN_CREATED,
	CASE_STATUS.REQUIREMENTS_ADDED,
	CASE_STATUS.APPLICATION_ACTIVATED,
	CASE_STATUS.FINISHED,
	CASE_STATUS.CLOSED,
] as const;

// If you ever need *all* statuses (including deprecated), use Object.values(CASE_STATUS).
// This list is intentionally "user-facing only" and excludes deprecated statuses.
export type CaseStatusOrderId = (typeof CASE_STATUS_ORDER)[number];

export type CaseStatusId =
	(typeof CASE_STATUS)[keyof typeof CASE_STATUS];

export type CaseStatusMeta = {
	id: CaseStatusId;
	labelKey: string;
	descriptionKey: string;
	badgeTone: BadgeTone;
};

export const CASE_STATUS_META: Record<CaseStatusId, CaseStatusMeta> = {
	[CASE_STATUS.DRAFT_INTAKE]: {
		id: CASE_STATUS.DRAFT_INTAKE,
		labelKey: "draft_intake",
		descriptionKey: "draft_intake_desc",
		badgeTone: NEUTRAL,
	},
	[CASE_STATUS.INTAKE_SUBMITTED]: {
		id: CASE_STATUS.INTAKE_SUBMITTED,
		labelKey: "intake_submitted",
		descriptionKey: "intake_submitted_desc",
		badgeTone: NEUTRAL,
	},
	[CASE_STATUS.CONSULTATION_REQUESTED]: {
		id: CASE_STATUS.CONSULTATION_REQUESTED,
		labelKey: "consultation_requested",
		descriptionKey: "consultation_requested_desc",
		badgeTone: NEUTRAL,
	},
	[CASE_STATUS.CONSULTATION_BOOKED]: {
		id: CASE_STATUS.CONSULTATION_BOOKED,
		labelKey: "consultation_booked",
		descriptionKey: "consultation_booked_desc",
		badgeTone: NEUTRAL,
	},
	[CASE_STATUS.CONSULTATION_COMPLETED]: {
		id: CASE_STATUS.CONSULTATION_COMPLETED,
		labelKey: "consultation_completed",
		descriptionKey: "consultation_completed_desc",
		badgeTone: SUCCESS,
	},
	[CASE_STATUS.PLAN_CREATED]: {
		id: CASE_STATUS.PLAN_CREATED,
		labelKey: "plan_created",
		descriptionKey: "plan_created_desc",
		badgeTone: ACTION,
	},
	[CASE_STATUS.REQUIREMENTS_ADDED]: {
		id: CASE_STATUS.REQUIREMENTS_ADDED,
		labelKey: "requirements_added",
		descriptionKey: "requirements_added_desc",
		badgeTone: ACTION,
	},
	[CASE_STATUS.APPLICATION_ACTIVATED]: {
		id: CASE_STATUS.APPLICATION_ACTIVATED,
		labelKey: "application_activated",
		descriptionKey: "application_activated_desc",
		badgeTone: SUCCESS,
	},
	[CASE_STATUS.FINISHED]: {
		id: CASE_STATUS.FINISHED,
		labelKey: "finished",
		descriptionKey: "finished_desc",
		badgeTone: SUCCESS,
	},
	[CASE_STATUS.CLOSED]: {
		id: CASE_STATUS.CLOSED,
		labelKey: "closed",
		descriptionKey: "closed_desc",
		badgeTone: LOCKED,
	},
};

export function isValidCaseStatus(
	value: unknown,
): value is CaseStatusId {
	return Object.values(CASE_STATUS).includes(value as CaseStatusId);
}

export function getCaseStatusMeta(status: unknown): CaseStatusMeta {
	const s = typeof status === "string" ? status.trim() : "";
	const effective = isValidCaseStatus(s)
		? (s as CaseStatusId)
		: CASE_STATUS.DRAFT_INTAKE;
	return CASE_STATUS_META[effective];
}

// ─────────────────────────────────────────────
// DOCUMENT UI META
// ─────────────────────────────────────────────

export const DOCUMENT_STATUS = {
	PENDING: "pending",
	APPROVED: "approved",
	RESUBMIT: "resubmit",
	REJECTED: "rejected",
} as const;

export type DocumentStatusId =
	(typeof DOCUMENT_STATUS)[keyof typeof DOCUMENT_STATUS];

export type DocumentUiMeta = {
	id: DocumentStatusId | "missing";
	badgeTone: BadgeTone;
	rowClass:
		| "row_good"
		| "row_neutral"
		| "row_action"
		| "row_caution"
		| "row_pending";
};

export function getDocumentUiMeta(
	status: DocumentStatusId | "missing",
): DocumentUiMeta {
	if (status === "approved") {
		return { id: "approved", badgeTone: SUCCESS, rowClass: "row_good" };
	}
	if (status === "pending") {
		return { id: "pending", badgeTone: NEUTRAL, rowClass: "row_neutral" };
	}
	if (status === "resubmit" || status === "rejected") {
		return { id: status, badgeTone: CAUTION, rowClass: "row_caution" };
	}
	if (status === "missing") {
		return { id: "missing", badgeTone: ACTION, rowClass: "row_action" };
	}

	return {
		id: status,
		badgeTone: NEUTRAL,
		rowClass: "row_pending",
	};
}
