/*
DOC NAME: layout.tsx
LOCATION: /src/app/[locale]/(admin)/admin/layout.tsx
SCOPE: Admin route protection gate (server-only). Enforces authenticated admin role before rendering any /admin pages.
STATUS: LOCKED
AUDITED:
- Uses auth.getUser() (server-verified) instead of trusting session cookie state.
- Locale-aware redirects (/${locale} + path) to preserve next-intl routing.
- Denies access by redirecting non-admin users away from /admin routes.
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

type LayoutProps = {
	children: ReactNode;
	params: Promise<{ locale: string }>;
};

export default async function AdminLayout({ children, params }: LayoutProps) {
	const { locale } = await params;

	const supabase = await createServerSupabaseClient();

	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();

	if (userError || !user) {
		redirect(`/${locale}${siteConfig.loginPath}`);
	}

	const { data: roleRow, error: roleError } = await supabase
		.from("user_roles")
		.select("role")
		.eq("user_id", user.id)
		.maybeSingle();

	const role = (roleRow?.role ?? "").toString();
	if (roleError || role !== "admin") {
		redirect(`/${locale}${siteConfig.clientDashboardPath}`);
	}

	return (
		<div className="min-h-screen" data-scope="profile">
			{children}
		</div>
	);
}
