/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/(client)/client/cases/new/page.tsx
SCOPE: Server guard wrapper for Client new case wizard (prevents URL bypass).
STATUS: UNLOCKED (lock after verified)
NOTES:
- Enforces "profile complete" before allowing access to /client/cases/new
- Redirects to /client/account when profile incomplete (locale-safe)
- Keeps wizard client-only (rendered via ClientCaseIntakeWizard.client.tsx)
*/

export const dynamic = "force-dynamic";

import "server-only";

import { redirect } from "next/navigation";

import { siteConfig } from "@/config/siteConfig";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { isProfileIncomplete, type ClientProfileLike } from "@/lib/profileCompleteness";

import ClientCaseIntakeWizardPage from "./ClientCaseIntakeWizard.client";

type Props = {
	params: Promise<{ locale: string }>;
};

function prefixLocale(locale: string, path: string) {
	if (!path) return `/${locale}`;
	if (path.startsWith(`/${locale}/`) || path === `/${locale}`) return path;
	if (!path.startsWith("/")) return `/${locale}/${path}`;
	return `/${locale}${path}`;
}

export default async function Page({ params }: Props) {
	const { locale } = await params;

	const supabase = await createServerSupabaseClient();

	const { data: userData, error: userError } = await supabase.auth.getUser();
	const user = userError ? null : userData.user;

	// Guard: must be authenticated
	if (!user) {
		redirect(prefixLocale(locale, siteConfig.loginPath));
	}

	/* ---------------------------------------------------------------------- */
	/* Guard: profile must be complete                                          */
	/* ---------------------------------------------------------------------- */

	// IMPORTANT:
	// Adjust table/fields to match your schema.
	// Preferred: a single boolean column like `is_profile_complete`.
	const { data: profileRow } = await supabase
		.from("client_profiles")
		.select(
			"first_name, last_name, citizenship_country, date_of_birth, contact_email, telegram_username, whatsapp_e164, passport_expiry",
		)
		.eq("user_id", user.id)
		.maybeSingle<ClientProfileLike>();
	
	// Rule: if the row does not exist => incomplete
	// Otherwise, apply the shared completeness logic (single source of truth).
	const incomplete =
		!profileRow ||
		typeof (profileRow as ClientProfileLike) !== "object" ||
		isProfileIncomplete(profileRow);
	
	if (incomplete) {
		const target = `${prefixLocale(locale, siteConfig.clientAccountPath)}?guard=profile_incomplete&from=cases_new`;
		redirect(target);
	}

	/* ---------------------------------------------------------------------- */
	/* OPTIONAL: Case already active guard (if you have a server-side check)    */
	/* ---------------------------------------------------------------------- */
	// If you already have a server function/view that indicates "case already active",
	// call it here and redirect to cases list (same as your existing guard behavior).
	//
	// Example pattern (replace with your real logic):
	// const { data: active } = await supabase
	//   .from("client_cases")
	//   .select("id")
	//   .eq("user_id", user.id)
	//   .in("status", ["open","active"])
	//   .limit(1);
	// if (active?.length) {
	//   redirect(`${prefixLocale(locale, siteConfig.clientCasesPath)}?guard=case_active=1`);
	// }

	return <ClientCaseIntakeWizardPage />;
}
