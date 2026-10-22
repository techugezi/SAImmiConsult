/*
DOC NAME: documentLogs.ts
LOCATION: /src/lib/documentLogs.ts
SCOPE: Best-effort server-side document event logging to client_documents_status_logs (NO console logging; no link persistence).
STATUS: LOCKED
AUDIT:
- Removed all console logging (prod-safe; avoids leaking sensitive payloads).
- Treat Drive links as sensitive: never persist previous/new drive link columns (forced to null).
- Normalized DocumentStatus values to match app usage: pending | approved | resubmit | rejected.
*/

"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

type DocumentStatus = "pending" | "approved" | "resubmit" | "rejected";

type DocumentEventType =
	| "uploaded"
	| "replaced"
	| "status_change"
	| "note_added"
	| "note_updated"
	| "note_deleted"
	| "system_event";

type DocumentEventPayload = {
	documentId: string;

	actorUserId?: string | null;
	actorRole: "client" | "consultant" | "system";

	eventType: DocumentEventType;

	previousStatus?: DocumentStatus | null;
	newStatus?: DocumentStatus | null;

	previousFileName?: string | null;
	newFileName?: string | null;

	previousDriveLink?: string | null;
	newDriveLink?: string | null;

	reason?: string | null;
};

export async function logDocumentEvent(
	supabase: SupabaseClient,
	payload: DocumentEventPayload,
): Promise<void> {
	const {
		documentId,
		actorUserId,
		actorRole,
		eventType,
		previousStatus,
		newStatus,
		previousFileName,
		newFileName,
		reason,
	} = payload;

	// Drive links are treated as sensitive: do not persist them to DB.
	const previousDriveLink = null;
	const newDriveLink = null;

	const { error } = await supabase.from("client_documents_status_logs").insert({
		document_id: documentId,
		actor_user_id: actorUserId ?? null,
		actor_role: actorRole,
		event_type: eventType,
		previous_status: previousStatus ?? null,
		new_status: newStatus ?? null,
		previous_file_name: previousFileName ?? null,
		new_file_name: newFileName ?? null,
		previous_drive_link: previousDriveLink,
		new_drive_link: newDriveLink,
		reason: reason ?? null,
	});

	// Best-effort: never throw, never log to console.
	if (error) return;
}
