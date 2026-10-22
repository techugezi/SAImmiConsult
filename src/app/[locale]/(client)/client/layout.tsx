/*
DOC NAME: layout.tsx
LOCATION: /src/app/[locale]/(client)/client/layout.tsx
SCOPE: Client route protection gate (server-only). Enforces authenticated user before rendering any /client pages.
STATUS: LOCKED
AUDITED:
- Replaced auth.getSession() with auth.getUser() to avoid trusting cookie-stored session data.
- Redirects are locale-aware (/${locale} + siteConfig path) to preserve next-intl routing.
- Removed console logging (avoid leaking auth state/server details).
NOTES:
- No hardcoded user-facing strings; no i18n fallbacks.
- Keep this file server-only. Do not introduce client components here.
*/

export const dynamic = "force-dynamic";

import "server-only";

import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { siteConfig } from "@/config/siteConfig";

type ClientLayoutProps = {
	children: ReactNode;
	params: Promise<{ locale: string }>;
};

export default async function ClientLayout({ children, params }: ClientLayoutProps) {
	const { locale } = await params;

	const supabase = await createServerSupabaseClient();

	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();

	if (userError || !user) {
		redirect(`/${locale}${siteConfig.loginPath}`);
	}

	// Everything below this point is protected
	return (
		<div className="min-h-screen" data-scope="profile">
			{children}
		</div>
	);
}
