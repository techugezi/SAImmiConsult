/*
DOC NAME: layout.tsx
LOCATION: /src/app/[locale]/layout.tsx
SCOPE: Root locale layout (Next-Intl provider + global chrome). Server-only.
STATUS: UNLOCKED (lock after verified)
*/

export const dynamic = "force-dynamic";

import "server-only";

import type { ReactNode } from "react";

import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";

import { routing } from "@/i18n/routing";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { siteConfig } from "@/config/siteConfig";

import { NavDispatcher } from "@/components/navbar/NavDispatcher";
import { Footer } from "@/components/footer/Footer";
import QueryToast from "@/components/ui/QueryToast";

type Props = {
	children: ReactNode;
	params: Promise<{ locale: string }>;
};

type ProfileHref = typeof siteConfig.clientAccountHref | typeof siteConfig.adminCasesHref;

export default async function RootLayout({ children, params }: Props) {
	const { locale } = await params;

	if (!hasLocale(routing.locales, locale)) {
		notFound();
	}

	const messages = await getMessages();

	const supabase = await createServerSupabaseClient();

	const { data: userData, error: userError } = await supabase.auth.getUser();

	const user = userError ? null : userData.user;

	let profileHref: ProfileHref = siteConfig.clientAccountHref;
	let isAdmin = false;

	if (user) {
		const role = (user.app_metadata?.role || "").toString();
		isAdmin = role === "admin" || role === "super_admin";

		if (isAdmin) {
			profileHref = siteConfig.adminCasesHref;
		}
	}

	return (
		<NextIntlClientProvider locale={locale} messages={messages}>
			<NavDispatcher user={user} isAdmin={isAdmin} profileHref={profileHref} />

			{/* Global query-driven toast (saved/error/warning/info/toast=...) */}
			<QueryToast />

			<main>{children}</main>
			<Footer />
		</NextIntlClientProvider>
	);
}
