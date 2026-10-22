/* DOC NAME: ensureApplicationDriveFolders.ts
   LOCATION: /src/components/server/ensureApplicationDriveFolders.ts
   SCOPE: Idempotent DB + Drive provisioning for application folders (used by activation + upload).
   STATUS: UNLOCKED (lock after approved)
   AUDIT:
   - No console logging.
   - No DB-internal error message leakage (stable CODEs only).
   - Trims/normalizes folder IDs and clientName inputs.
   - Best-effort profile update remains non-blocking.
*/

"use server";

import "server-only";

/* -------------------------------------------------------------------------- */
/* Imports                                                                    */
/* -------------------------------------------------------------------------- */

import { createAdminSupabaseClient } from "@/lib/supabaseServer";
import { createApplicationDriveFolders } from "@/lib/googleDrive";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function errorWithCode(code: string): Error {
	// Stable error shape: caller can parse before the colon.
	// Do not include internal messages, IDs, or DB details.
	return new Error(`${code}: ${code}`);
}

function safeTrim(raw: unknown): string {
	return typeof raw === "string" ? raw.trim() : "";
}

function isNonEmpty(value: string): boolean {
	return value.length > 0;
}

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type AppRow = {
	id: string;
	user_id: string;
	application_type: string;
	destination: string | null;
	created_at: string;
	drive_application_folder_id: string | null;
	drive_parent_folder_id: string | null;
};

type ProfileRow = {
	user_id: string;
	first_name: string | null;
	last_name: string | null;
	drive_parent_folder_id: string | null;
};

/* -------------------------------------------------------------------------- */
/* Server Action                                                              */
/* -------------------------------------------------------------------------- */

export async function ensureApplicationDriveFolders(args: {
	applicationId: string;
	expectedUserId?: string;
	fallbackClientName?: string;
}): Promise<{ parentFolderId: string; applicationFolderId: string }> {
	/* ---------------------------------------------------------------------- */
	/* Input normalization                                                     */
	/* ---------------------------------------------------------------------- */

	const admin = createAdminSupabaseClient();

	const applicationId = safeTrim(args.applicationId);
	if (!isNonEmpty(applicationId)) {
		throw errorWithCode("APP_NOT_FOUND");
	}

	/* ---------------------------------------------------------------------- */
	/* 1) Load application (admin, single source of truth)                     */
	/* ---------------------------------------------------------------------- */

	const APP_SELECT =
		"id,user_id,application_type,destination,created_at,drive_application_folder_id,drive_parent_folder_id" as const;
	
	const { data: application, error: appError } = await admin
		.from("client_applications")
		.select(APP_SELECT)
		.eq("id", applicationId)
		.single();
	
	if (appError || !application) {
		throw errorWithCode("APP_NOT_FOUND");
	}

	/* ---------------------------------------------------------------------- */
	/* 2) Ownership guard (critical via client upload flow)                    */
	/* ---------------------------------------------------------------------- */

	const expectedUserId = safeTrim(args.expectedUserId);
	if (isNonEmpty(expectedUserId) && application.user_id !== expectedUserId) {
		throw errorWithCode("FORBIDDEN");
	}

	/* ---------------------------------------------------------------------- */
	/* 3) Fast path: DB already has folder IDs                                 */
	/* ---------------------------------------------------------------------- */

	const existingAppFolderId = safeTrim(application.drive_application_folder_id);
	const existingParentFolderId = safeTrim(application.drive_parent_folder_id);

	if (isNonEmpty(existingAppFolderId)) {
		return {
			parentFolderId: existingParentFolderId,
			applicationFolderId: existingAppFolderId,
		};
	}

	/* ---------------------------------------------------------------------- */
	/* 4) Load profile (persistent parent folder id + display name)            */
	/* ---------------------------------------------------------------------- */

	const { data: profile } = await admin
		.from("client_profiles")
		.select("user_id, first_name, last_name, drive_parent_folder_id")
		.eq("user_id", application.user_id)
		.maybeSingle();

	const p = (profile as ProfileRow | null) ?? null;

	const firstName = safeTrim(p?.first_name);
	const lastName = safeTrim(p?.last_name);
	const profileName = `${firstName} ${lastName}`.trim();

	const fallbackName = safeTrim(args.fallbackClientName);
	const clientName = profileName || fallbackName || application.user_id;

	/* ---------------------------------------------------------------------- */
	/* 5) Create/ensure folders in Drive                                       */
	/* ---------------------------------------------------------------------- */

	let parentFolderId = "";
	let applicationFolderId = "";

	try {
		const folders = await createApplicationDriveFolders({
			userId: application.user_id,
			applicationId: application.id,
			clientName,
			destination: application.destination,
			visaType: application.application_type,
			existingParentFolderId: safeTrim(p?.drive_parent_folder_id) || null,
			createdAtIso: application.created_at,
		});

		parentFolderId = safeTrim(folders.parentFolderId);
		applicationFolderId = safeTrim(folders.applicationFolderId);
	} catch (e: any) {
		const raw = safeTrim(e?.message);

		// Preserve coded errors emitted by googleDrive.ts (do not leak extra details)
		if (raw.startsWith("DRIVE_ROOT_NOT_ACCESSIBLE:")) {
			throw errorWithCode("DRIVE_ROOT_NOT_ACCESSIBLE");
		}

		if (raw.startsWith("DRIVE_CREATE_FAILED:")) {
			throw errorWithCode("DRIVE_CREATE_FAILED");
		}

		throw errorWithCode("DRIVE_PROVISION_FAILED");
	}

	if (!isNonEmpty(parentFolderId) || !isNonEmpty(applicationFolderId)) {
		throw errorWithCode("DRIVE_PROVISION_FAILED");
	}

	/* ---------------------------------------------------------------------- */
	/* 6) Persist parent folder id on profile (best-effort; do not throw)      */
	/* ---------------------------------------------------------------------- */

	try {
		await admin
			.from("client_profiles")
			.update({ drive_parent_folder_id: parentFolderId })
			.eq("user_id", application.user_id);
	} catch {
		// Silent by design
	}

	/* ---------------------------------------------------------------------- */
	/* 7) Persist application folder id on application row (must succeed)      */
	/* ---------------------------------------------------------------------- */

	const { error: updateError } = await admin
		.from("client_applications")
		.update({
			drive_parent_folder_id: parentFolderId,
			drive_application_folder_id: applicationFolderId,
			updated_at: new Date().toISOString(),
		})
		.eq("id", application.id)
		.eq("user_id", application.user_id);

	if (updateError) {
		// Do not leak updateError.message (DB internals) to caller.
		throw errorWithCode("DB_SAVE_FAILED");
	}

	return { parentFolderId, applicationFolderId };
}
