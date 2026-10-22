/*
DOC NAME: createNewCase.ts
LOCATION: /src/components/server/createNewCase.ts
SCOPE: Server action to create a new client case from wizard input (intake_json + draft recommendation).
STATUS: UNLOCKED (lock after approved)
AUDIT:
- Removed ALL console logging (prod-safe).
- Profile snapshot is best-effort; failures are silent.
- Snapshot keeps direct contact fields (email/telegram/whatsapp) per product requirement.
*/

"use server";

import "server-only";

/* -------------------------------------------------------------------------- */
/* Imports                                                                    */
/* -------------------------------------------------------------------------- */

import { createServerSupabaseClient } from "@/lib/supabaseServer";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export interface CreateCaseInput {
	destination: string;
	visaType: string;
	timeframe?: string; // optional (free text)
	extraNotes?: string; // optional (free text)
}

type Confidence = "low" | "average" | "high";

type ProfileSnapshotRow = {
	first_name: string | null;
	last_name: string | null;
	citizenship_country: string | null;
	city_country: string | null;
	current_location: string | null;
	current_visa_status: string | null;
	passport_expiry: string | null;

	contact_email: string | null;
	telegram_username: string | null;
	whatsapp_e164: string | null;

	visa_refusals: unknown;
	income_over_2000: unknown;
};

/* -------------------------------------------------------------------------- */
/* Input normalization (bounded, non-breaking)                                */
/* -------------------------------------------------------------------------- */

function safeTrimmedString(raw: unknown, maxLen: number): string {
	const v = typeof raw === "string" ? raw.trim() : "";
	if (v.length <= maxLen) return v;
	return v.slice(0, maxLen);
}

function safeOptionalString(raw: unknown, maxLen: number): string | null {
	const v = safeTrimmedString(raw, maxLen);
	return v.length > 0 ? v : null;
}

/**
 * We keep these checks intentionally permissive to avoid breaking callers.
 * This prevents only obviously-invalid garbage inputs (empty / extremely long).
 */
function assertMinimalWizardInput(input: CreateCaseInput) {
	const destination = safeTrimmedString(input.destination, 80);
	const visaType = safeTrimmedString(input.visaType, 80);

	if (destination.length === 0 || visaType.length === 0) {
		throw new Error("errors.submitFailed");
	}

	return { destination, visaType };
}

/* -------------------------------------------------------------------------- */
/* Snapshot helpers                                                           */
/* -------------------------------------------------------------------------- */

function normalizeBool(value: unknown): boolean | null {
	if (typeof value === "boolean") return value;

	if (typeof value === "string") {
		const s = value.trim().toLowerCase();
		if (s === "yes" || s === "true" || s === "1") return true;
		if (s === "no" || s === "false" || s === "0") return false;
	}

	if (typeof value === "number") {
		if (value === 1) return true;
		if (value === 0) return false;
	}

	return null;
}

function deriveConfidence(visaRefusals: boolean | null, incomeOver2000: boolean | null): Confidence {
	if (visaRefusals === true && incomeOver2000 === false) return "low";
	if (visaRefusals === false && incomeOver2000 === true) return "high";
	return "average";
}

function buildProfileSnapshot(profile: ProfileSnapshotRow | null): Record<string, unknown> | null {
	if (!profile) return null;

	return {
		first_name: profile.first_name ?? null,
		last_name: profile.last_name ?? null,
		citizenship_country: profile.citizenship_country ?? null,
		city_country: profile.city_country ?? null,
		current_location: profile.current_location ?? null,
		current_visa_status: profile.current_visa_status ?? null,
		passport_expiry: profile.passport_expiry ?? null,

		contact_email: profile.contact_email ?? null,
		telegram_username: profile.telegram_username ?? null,
		whatsapp_e164: profile.whatsapp_e164 ?? null,

		visa_refusals: normalizeBool(profile.visa_refusals),
		income_over_2000: normalizeBool(profile.income_over_2000),
	};
}

/* -------------------------------------------------------------------------- */
/* Server Action                                                              */
/* -------------------------------------------------------------------------- */

export async function createNewCase(input: CreateCaseInput): Promise<string> {
	/* ---------------------------------------------------------------------- */
	/* Auth                                                                    */
	/* ---------------------------------------------------------------------- */

	const supabase = await createServerSupabaseClient();

	// Authenticated user (RLS will enforce user_id ownership too)
	const { data: userData, error: userError } = await supabase.auth.getUser();
	if (userError || !userData?.user) {
		throw new Error("errors.authRequired");
	}

	const user = userData.user;

	/* ---------------------------------------------------------------------- */
	/* Input normalization                                                      */
	/* ---------------------------------------------------------------------- */

	const { destination, visaType } = assertMinimalWizardInput(input);

	const timeframe = safeOptionalString(input.timeframe, 160);
	const extraNotes = safeOptionalString(input.extraNotes, 1200);

	/* ---------------------------------------------------------------------- */
	/* Best-effort profile snapshot + confidence signals                        */
	/* ---------------------------------------------------------------------- */

	const { data: profile } = await supabase
		.from("client_profiles")
		.select(
			`
			first_name,
			last_name,
			citizenship_country,
			city_country,
			current_location,
			current_visa_status,
			passport_expiry,

			contact_email,
			telegram_username,
			whatsapp_e164,

			visa_refusals,
			income_over_2000
		`,
		)
		.eq("user_id", user.id)
		.maybeSingle();

	const profileRow = (profile ?? null) as ProfileSnapshotRow | null;

	const visaRefusals = normalizeBool(profileRow?.visa_refusals);
	const incomeOver2000 = normalizeBool(profileRow?.income_over_2000);
	const confidence = deriveConfidence(visaRefusals, incomeOver2000);

	const nowIso = new Date().toISOString();

	/* ---------------------------------------------------------------------- */
	/* Build intake JSON                                                        */
	/* ---------------------------------------------------------------------- */

	const intakeJson = {
		destination,
		visaType,
		timeframe,
		extraNotes,
		profile_snapshot: buildProfileSnapshot(profileRow),
		submitted_at: nowIso,
	};

	/* ---------------------------------------------------------------------- */
	/* Draft recommendation (admin confirms later)                              */
	/* ---------------------------------------------------------------------- */

	const rationaleKeys: string[] = ["ClientCaseIntakeWizard.recommendation.rationale.base"];

	if (visaRefusals === true) {
		rationaleKeys.push("ClientCaseIntakeWizard.recommendation.rationale.visaRefusals");
	}

	if (incomeOver2000 === false) {
		rationaleKeys.push("ClientCaseIntakeWizard.recommendation.rationale.incomeBelowThreshold");
	}

	const draftRecommendation = {
		suggested_application_type: visaType,
		confidence,
		signals: {
			visa_refusals: visaRefusals,
			income_over_2000: incomeOver2000,
		},
		rationale_keys: rationaleKeys,
		generated_at: nowIso,
	};

	/* ---------------------------------------------------------------------- */
	/* Insert case                                                              */
	/* ---------------------------------------------------------------------- */

	const insertRes = await supabase
		.from("client_cases")
		.insert({
			user_id: user.id,
			status: "intake_submitted",
			intake_version: 1,
			intake_json: intakeJson,
			draft_recommendation: draftRecommendation,
		})
		.select("id")
		.single();

	if (insertRes.error || !insertRes.data?.id) {
		throw new Error("errors.submitFailed");
	}

	return insertRes.data.id;
}
