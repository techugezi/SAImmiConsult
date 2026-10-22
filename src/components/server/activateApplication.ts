/*
DOC NAME: activateApplication.ts
LOCATION: /src/components/server/activateApplication.ts
SCOPE: Admin activation server action (create application + requirements + Drive folders + link case).
STATUS: UNLOCKED (lock after approved)
AUDIT:
- Extremely sensitive: no console logging, no sensitive link exposure.
- Race-hardened: prevents double activation by guarding the case update with application_id IS NULL.
- Best-effort cleanup on failure (DB rows only; Drive folders are not deleted remotely).
- HARD GUARD: application must always be created with case_id (foreign key) and never NULL.
*/

"use server";

import "server-only";

/* -------------------------------------------------------------------------- */
/* Imports                                                                    */
/* -------------------------------------------------------------------------- */

import { notFound, redirect } from "next/navigation";

import { siteConfig } from "@/config/siteConfig";
import { createApplicationDriveFolders } from "@/lib/googleDrive";

import { randomUUID } from "node:crypto";

import {
	createServerSupabaseClient,
	createAdminSupabaseClient,
} from "@/lib/supabaseServer";

/* -------------------------------------------------------------------------- */
/* Dev Flags                                                                  */
/* -------------------------------------------------------------------------- */

// Dev bypass for activation (explicitly gated, never on by default)
const ENABLE_DEV_ACTIVATION_BYPASS =
	process.env.NODE_ENV !== "production" &&
	process.env.NEXT_PUBLIC_ENABLE_DEV_ACTIVATION_BYPASS === "true";

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

// Guard: activation should happen after plan_created
const ALLOWED_STATUSES_FOR_ACTIVATION = new Set([
	"plan_created",
	"consultation_completed",
]);

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

function uniq(items: string[]): string[] {
	return Array.from(new Set(items));
}

function safeLocale(raw: unknown): string {
	const v = typeof raw === "string" ? raw.trim() : "";
	if (v === "en" || v === "ru") return v;
	return "en";
}

function safeString(raw: unknown): string {
	return typeof raw === "string" ? raw.trim() : "";
}

function safeDestination(intakeJson: any): string | null {
	const d = intakeJson?.destination;
	if (typeof d !== "string") return null;
	const v = d.trim();
	return v.length > 0 ? v : null;
}

/**
 * Normalize planned requirements from the case intake_json.
 * Source of truth: matches the implementation in:
 * /src/app/[locale]/(admin)/admin/cases/[id]/page.tsx
 */
function normalizePlannedRequirements(intakeJson: any): string[] {
	const raw = intakeJson?.plan_requirements;
	if (!Array.isArray(raw)) return [];
	return raw
		.filter((x) => typeof x === "string")
		.map((x) => x.trim())
		.filter((x) => x.length > 0);
}

/* -------------------------------------------------------------------------- */
/* Auth helpers (inlined; avoids missing "@/lib/adminAuth")                   */
/* -------------------------------------------------------------------------- */

function getAdminSupabase() {
	// Server-only service role client
	return createAdminSupabaseClient();
}

async function assertAdminOrConsultantOrNotFound(args: { locale: string }) {
	const sessionSupabase = await createServerSupabaseClient();

	const {
		data: { user },
	} = await sessionSupabase.auth.getUser();

	// Unauthenticated → locale-safe login
	if (!user) redirect(`/${args.locale}${siteConfig.loginPath}`);

	const { data: roleRow } = await sessionSupabase
		.from("user_roles")
		.select("role")
		.eq("user_id", user.id)
		.maybeSingle();

	const role = (roleRow?.role ?? "").toString();
	const allowed = role === "admin" || role === "consultant";

	// Unauthorized → fail closed (do not reveal existence)
	if (!allowed) notFound();

	return { actorUserId: user.id, actorRole: role };
}

/* -------------------------------------------------------------------------- */
/* Cleanup (best effort only; never throw)                                    */
/* -------------------------------------------------------------------------- */

async function bestEffortCleanupApplication(args: {
	supabase: any;
	applicationId: string;
}) {
	const { supabase, applicationId } = args;

	// Best-effort cleanup: never throw, never log.
	// Runs deletes concurrently to reduce time-to-unwind on failure.
	await Promise.allSettled([
		supabase
			.from("client_application_requirements")
			.delete()
			.eq("application_id", applicationId),
		supabase.from("client_applications").delete().eq("id", applicationId),
	]);
}

/* -------------------------------------------------------------------------- */
/* Server Action                                                              */
/* -------------------------------------------------------------------------- */

export async function activateApplication(formData: FormData) {
	/* ---------------------------------------------------------------------- */
	/* Input parsing / normalization                                           */
	/* ---------------------------------------------------------------------- */

	const caseIdRaw = formData.get("caseId");
	const locale = safeLocale(formData.get("locale"));
	const devBypass = safeString(formData.get("devBypass")) === "true";

	if (typeof caseIdRaw !== "string") {
		throw new Error("Invalid payload.");
	}

	const caseId = caseIdRaw.trim();
	if (caseId.length === 0) {
		throw new Error("Invalid payload.");
	}

	/* ---------------------------------------------------------------------- */
	/* AuthZ gate (must pass before service role usage)                        */
	/* ---------------------------------------------------------------------- */

	await assertAdminOrConsultantOrNotFound({ locale });
	const supabase = getAdminSupabase();

	/* ---------------------------------------------------------------------- */
	/* 1) Load case (single source of truth)                                   */
	/* ---------------------------------------------------------------------- */

	const { data: c, error: cErr } = await supabase
		.from("client_cases")
		.select("id, user_id, status, final_application_type, intake_json, application_id")
		.eq("id", caseId)
		.maybeSingle();

	if (cErr) {
		throw new Error("Failed to load case.");
	}
	if (!c) notFound();

	const status = safeString(c.status);
	const isClosed = status === "closed";

	if (isClosed) {
		redirect(`/${locale}${siteConfig.adminCaseDetailsPath(caseId)}?error=case_closed`);
	}

	// Already activated
	if (c.application_id) {
		redirect(
			`/${locale}${siteConfig.adminCaseDetailsPath(caseId)}?saved=activation&open=activation`,
		);
	}

	const finalType = safeString(c.final_application_type);

	if (finalType.length === 0) {
		redirect(
			`/${locale}${siteConfig.adminCaseDetailsPath(caseId)}?error=activation_missing_final_type&open=plan`,
		);
	}

	/* ---------------------------------------------------------------------- */
	/* 2) Guard: enforce activation ordering (with explicit dev bypass)        */
	/* ---------------------------------------------------------------------- */

	const allowBypass = Boolean(ENABLE_DEV_ACTIVATION_BYPASS && devBypass);

	if (!ALLOWED_STATUSES_FOR_ACTIVATION.has(status) && !allowBypass) {
		redirect(
			`/${locale}${siteConfig.adminCaseDetailsPath(caseId)}?error=activation_wrong_case_status&open=activation`,
		);
	}

	/* ---------------------------------------------------------------------- */
	/* 3) Determine requirements source-of-truth (pre-activation)              */
	/* ---------------------------------------------------------------------- */

	const planned = normalizePlannedRequirements(c.intake_json);
	let requirementIds: string[] = uniq(planned);

	let requirementRows: { document_type_id: string; required: boolean }[] = [];

	if (requirementIds.length === 0) {
		const { data: requiredTypes, error: reqTypeErr } = await supabase
			.from("document_types")
			.select("id, required")
			.eq("required", true)
			.order("priority", { ascending: true, nullsFirst: false })
			.order("id", { ascending: true });

		if (reqTypeErr) {
			throw new Error("Failed to load default requirements.");
		}

		requirementRows = (requiredTypes ?? []).map((r: any) => ({
			document_type_id: r.id,
			required: true,
		}));

		requirementIds = requirementRows.map((r) => r.document_type_id);
	} else {
		const { data: dtRows, error: dtErr } = await supabase
			.from("document_types")
			.select("id")
			.in("id", requirementIds);

		if (dtErr) {
			throw new Error("Failed to validate requirements.");
		}

		const validSet = new Set((dtRows ?? []).map((r: any) => r.id));
		requirementIds = requirementIds.filter((id) => validSet.has(id));

		requirementRows = requirementIds.map((id) => ({
			document_type_id: id,
			required: true,
		}));
	}

	if (!allowBypass && requirementIds.length === 0) {
		redirect(
			`/${locale}${siteConfig.adminCaseDetailsPath(caseId)}?error=no_requirements_selected&open=requirements`,
		);
	}

	const destination = safeDestination(c.intake_json);

	/* ---------------------------------------------------------------------- */
	/* 3.1) Best-effort: get a client display name for folder naming           */
	/* ---------------------------------------------------------------------- */

	let clientName = "Client";

	const { data: profileRow } = await supabase
		.from("client_profiles")
		.select("first_name,last_name,drive_parent_folder_id")
		.eq("user_id", c.user_id)
		.maybeSingle();

	if (profileRow) {
		const fn = safeString((profileRow as any).first_name);
		const ln = safeString((profileRow as any).last_name);
		const full = [fn, ln].filter((x) => x.length > 0).join(" ").trim();
		if (full.length > 0) clientName = full;
	}

	const nowIso = new Date().toISOString();

	/* ---------------------------------------------------------------------- */
	/* 4) Generate application id up-front (required for Drive + insert-time)  */
	/* ---------------------------------------------------------------------- */
	
	const applicationId = randomUUID();
	
	/* ---------------------------------------------------------------------- */
	/* 5) Create Drive folders FIRST so we can store IDs at insert-time         */
	/* ---------------------------------------------------------------------- */
	
	const folderRes = await createApplicationDriveFolders({
		userId: c.user_id,
		applicationId, // string, never null
		clientName,
		destination,
		visaType: finalType,
		existingParentFolderId: (profileRow as any)?.drive_parent_folder_id ?? null,
		createdAtIso: nowIso,
	});
	
	/* ---------------------------------------------------------------------- */
	/* 6) Create application row (DB) — MUST include case_id                    */
	/* ---------------------------------------------------------------------- */
	
	const timelineEvent = {
		type: "case_activation",
		occurred_at: nowIso,
		case_id: caseId,
	};
	
	const { data: appInsert, error: appErr } = await supabase
		.from("client_applications")
		.insert({
			id: applicationId, // use the pre-generated id
			user_id: c.user_id,
			application_type: finalType,
			destination,
			case_id: caseId, // HARD GUARANTEE: never NULL
			drive_parent_folder_id: folderRes.parentFolderId,
			drive_application_folder_id: folderRes.applicationFolderId,
			timeline: [timelineEvent],
		})
		.select("id")
		.single();
	
	if (appErr || !appInsert?.id) {
		throw new Error("Failed to create application.");
	}
	

	try {
		/* ------------------------------------------------------------------ */
		/* 7) Insert application requirements (DB)                              */
		/* ------------------------------------------------------------------ */

		if (requirementRows.length > 0) {
			const payload = requirementRows.map((r) => ({
				application_id: applicationId,
				document_type_id: r.document_type_id,
				required: r.required,
			}));

			const { error: reqInsErr } = await supabase
				.from("client_application_requirements")
				.insert(payload);

			if (reqInsErr) {
				throw new Error("Failed to create requirements.");
			}
		}

		/* ------------------------------------------------------------------ */
		/* 8) Link case to application + advance workflow (DB)                  */
		/* ------------------------------------------------------------------ */
		// RACE HARDENING: only link if still not linked
		const { data: caseUpdatedRows, error: caseUpdateErr } = await supabase
			.from("client_cases")
			.update({
				application_id: applicationId,
				status: "application_activated",
				updated_at: nowIso,
			})
			.eq("id", caseId)
			.is("application_id", null)
			.select("id");

		if (caseUpdateErr) {
			throw new Error("Failed to link case to application.");
		}

		// If another activation won the race, this guarded update returns 0 rows.
		if (!caseUpdatedRows || caseUpdatedRows.length === 0) {
			await bestEffortCleanupApplication({ supabase, applicationId });
			redirect(
				`/${locale}${siteConfig.adminCaseDetailsPath(caseId)}?saved=activation&open=activation`,
			);
		}
	} catch (e) {
		await bestEffortCleanupApplication({ supabase, applicationId });
		throw e;
	}

	/* ---------------------------------------------------------------------- */
	/* 9) Redirect                                                            */
	/* ---------------------------------------------------------------------- */

	redirect(
		`/${locale}${siteConfig.adminCaseDetailsPath(caseId)}?saved=activation&status=application_activated&open=activation`,
	);
}
