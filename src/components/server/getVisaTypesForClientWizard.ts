/* DOC NAME: getVisaTypesForClientWizard.ts
   LOCATION: /src/components/server/getVisaTypesForClientWizard.ts
   SCOPE: Server-only fetch for visa_types for the client wizard. Auth-gated, no anon key, no client-side DB access.
   STATUS: UNLOCKED (lock after approved)
*/

"use server";

import "server-only";

/* -------------------------------------------------------------------------- */
/* Imports                                                                    */
/* -------------------------------------------------------------------------- */

import { createAdminSupabaseClient, createServerSupabaseClient } from "@/lib/supabaseServer";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type VisaTypeRow = {
	id: string;
	name_key: string;
	parent_id: string | null;
	kind: "group" | "type" | "subcategory";
	jurisdiction: string;
	sort_order: number;
	allowed_countries: string[] | null;
};

/* -------------------------------------------------------------------------- */
/* Safe parsing                                                               */
/* -------------------------------------------------------------------------- */

function isKind(value: unknown): value is VisaTypeRow["kind"] {
	return value === "group" || value === "type" || value === "subcategory";
}

function safeString(value: unknown): string {
	return typeof value === "string" ? value : "";
}

function safeNullableString(value: unknown): string | null {
	const s = safeString(value);
	return s.length > 0 ? s : null;
}

function safeNumber(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function safeStringArrayOrNull(value: unknown): string[] | null {
	if (!Array.isArray(value)) return null;
	const out = value.filter((x) => typeof x === "string") as string[];
	return out.length > 0 ? out : [];
}

/**
 * Defensive: if schema shifts or a row is malformed, we drop that row rather
 * than returning invalid shapes that could break the client wizard.
 */
function safeRows(input: unknown): VisaTypeRow[] {
	if (!Array.isArray(input)) return [];

	const rows: VisaTypeRow[] = [];

	for (const item of input) {
		const r = item as any;

		const id = safeString(r?.id);
		const name_key = safeString(r?.name_key);
		const parent_id = safeNullableString(r?.parent_id);
		const kindRaw = r?.kind;
		const jurisdiction = safeString(r?.jurisdiction);
		const sort_order = safeNumber(r?.sort_order);
		const allowed_countries = safeStringArrayOrNull(r?.allowed_countries);

		if (!id || !name_key || !isKind(kindRaw) || !jurisdiction) {
			continue;
		}

		rows.push({
			id,
			name_key,
			parent_id,
			kind: kindRaw,
			jurisdiction,
			sort_order,
			allowed_countries,
		});
	}

	return rows;
}

/* -------------------------------------------------------------------------- */
/* Server Action                                                              */
/* -------------------------------------------------------------------------- */

export async function getVisaTypesForClientWizard(): Promise<VisaTypeRow[]> {
	/* ---------------------------------------------------------------------- */
	/* Auth gate (session-aware): prevents anonymous callers                   */
	/* ---------------------------------------------------------------------- */

	const sessionSupabase = await createServerSupabaseClient();

	const {
		data: { user },
		error: userErr,
	} = await sessionSupabase.auth.getUser();

	if (userErr || !user) return [];

	/* ---------------------------------------------------------------------- */
	/* Privileged read (service role behind the scenes)                        */
	/* IMPORTANT: must stay auth-gated because this bypasses RLS               */
	/* ---------------------------------------------------------------------- */

	const admin = createAdminSupabaseClient();

	const { data, error } = await admin
		.from("visa_types")
		.select("id,name_key,parent_id,kind,jurisdiction,allowed_countries,sort_order")
		.order("sort_order", { ascending: true })
		.order("id", { ascending: true });

	if (error) return [];

	return safeRows(data);
}
