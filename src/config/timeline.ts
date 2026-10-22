/* DOC NAME: timeline.ts
   LOCATION: /src/config/timeline.ts
   SCOPE: Canonical timeline event types + i18n key mapping (DB-truth enums for case/application timelines).
   STATUS: UNLOCKED (lock after approved)
*/

export const CASE_TIMELINE_EVENT_TYPES = [
	// Creation / intake
	"case_created",
	"case_status_changed",
	"intake_saved",
	"intake_submitted",

	// Consultation lifecycle
	"consultation_requested",
	"consultation_scheduled",
	"consultation_channel_set",
	"consultation_link_set",

	// Notes / planning
	"case_plan_notes_updated",
	"case_consultant_note_updated",

	// Activation / linking
	"case_activated",
] as const;

export type CaseTimelineEventType = (typeof CASE_TIMELINE_EVENT_TYPES)[number];

export const APPLICATION_TIMELINE_EVENT_TYPES = [
	// Creation / linking
	"application_created",
	"application_case_linked",

	// Status lifecycle
	"application_status_changed",
	"application_cancelled",
	"application_finished",

	// Documents
	"document_uploaded",
	"document_version_uploaded",
	"document_status_changed",
	"documents_status_bulk_updated",

	// Notes
	"application_consultant_note_updated",

	// Drive provisioning (semantic; do NOT store ids)
	"drive_folders_provisioned",
] as const;

export type ApplicationTimelineEventType = (typeof APPLICATION_TIMELINE_EVENT_TYPES)[number];

export type TimelineEventType = CaseTimelineEventType | ApplicationTimelineEventType;

export const TIMELINE_I18N_KEYS: Record<
	TimelineEventType,
	{ titleKey: string; descKey?: string }
> = {
	// Case
	case_created: { titleKey: "Timeline.case.created.title" },
	case_status_changed: {
		titleKey: "Timeline.case.statusChanged.title",
		descKey: "Timeline.case.statusChanged.desc",
	},
	intake_saved: { titleKey: "Timeline.case.intakeSaved.title" },
	intake_submitted: { titleKey: "Timeline.case.intakeSubmitted.title" },

	consultation_requested: { titleKey: "Timeline.case.consultationRequested.title" },
	consultation_scheduled: { titleKey: "Timeline.case.consultationScheduled.title" },
	consultation_channel_set: { titleKey: "Timeline.case.consultationChannelSet.title" },
	consultation_link_set: { titleKey: "Timeline.case.consultationLinkSet.title" },

	case_plan_notes_updated: { titleKey: "Timeline.case.planNotesUpdated.title" },
	case_consultant_note_updated: { titleKey: "Timeline.case.consultantNoteUpdated.title" },

	case_activated: { titleKey: "Timeline.case.activated.title", descKey: "Timeline.case.activated.desc" },

	// Application
	application_created: { titleKey: "Timeline.application.created.title" },
	application_case_linked: { titleKey: "Timeline.application.caseLinked.title" },

	application_status_changed: {
		titleKey: "Timeline.application.statusChanged.title",
		descKey: "Timeline.application.statusChanged.desc",
	},
	application_cancelled: { titleKey: "Timeline.application.cancelled.title" },
	application_finished: { titleKey: "Timeline.application.finished.title" },

	document_uploaded: { titleKey: "Timeline.application.documentUploaded.title" },
	document_version_uploaded: { titleKey: "Timeline.application.documentVersionUploaded.title" },
	document_status_changed: { titleKey: "Timeline.application.documentStatusChanged.title" },
	documents_status_bulk_updated: { titleKey: "Timeline.application.documentsBulkUpdated.title" },

	application_consultant_note_updated: { titleKey: "Timeline.application.consultantNoteUpdated.title" },

	drive_folders_provisioned: { titleKey: "Timeline.application.driveProvisioned.title" },
};

export function isCaseTimelineEventType(value: unknown): value is CaseTimelineEventType {
	if (typeof value !== "string") return false;
	return (CASE_TIMELINE_EVENT_TYPES as readonly string[]).includes(value);
}

export function isApplicationTimelineEventType(value: unknown): value is ApplicationTimelineEventType {
	if (typeof value !== "string") return false;
	return (APPLICATION_TIMELINE_EVENT_TYPES as readonly string[]).includes(value);
}

export function isTimelineEventType(value: unknown): value is TimelineEventType {
	return isCaseTimelineEventType(value) || isApplicationTimelineEventType(value);
}
