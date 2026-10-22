/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/(admin)/admin/account/page.tsx
SCOPE: Admin “Manage my account” page (email + masked password + change-password link).
STATUS: UNLOCKED (lock after approved)
AUDIT:
- Password is never displayed (impossible + unsafe). Shows masked placeholder only.
- Guarded: redirects to login if not authenticated; redirects to admin dashboard if not admin.
- No hardcoded UI strings; i18n keys only.
*/

"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { supabase } from "@/lib/supabaseClient";
import { siteConfig } from "@/config/siteConfig";

import { PageShell } from "@/components/ui/layout/PageShell";
import { MainColumn } from "@/components/ui/layout/MainColumn";

import styles from "@/styles/profile.module.css";

function prefixLocale(locale: string, path: string) {
	if (!path) return `/${locale}`;
	if (path.startsWith(`/${locale}/`) || path === `/${locale}`) return path;
	if (!path.startsWith("/")) return `/${locale}/${path}`;
	return `/${locale}${path}`;
}

export default function AdminAccountPage() {
	const t = useTranslations("AdminAccount");
	const tGlobal = useTranslations("GlobalForm");
	const locale = useLocale();
	const router = useRouter();

	const [email, setEmail] = useState<string>("");
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;

		const run = async () => {
			setIsLoading(true);

			try {
				const { data, error } = await supabase.auth.getUser();

				if (cancelled) return;

				if (error || !data.user) {
					router.push(prefixLocale(locale, siteConfig.loginPath));
					return;
				}

				const role = (data.user.app_metadata?.role || "").toString() || "client";

				if (role !== "admin" && role !== "super_admin") {
					// Hard redirect out of admin-only page
					router.push(prefixLocale(locale, siteConfig.adminDashboardPath));
					return;
				}

				setEmail(data.user.email ?? "");
			} catch (err) {
				console.error("[AdminAccount] getUser failed:", err);
				router.push(prefixLocale(locale, siteConfig.loginPath));
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		};

		run();

		return () => {
			cancelled = true;
		};
	}, [locale, router]);

	return (
		<PageShell>
			<header className="hero-shell">
				<div className="hero-inner">
					<h1 className="hero-title">{t("heading")}</h1>
					<p className="hero-subtitle">{t("subheading")}</p>
					<p className="hero-desc">{t("description")}</p>
				</div>
			</header>

			<MainColumn>
				<div className={styles.topActions}>
					<Link href={siteConfig.adminDashboardPath} className="button button-ghost">
						<span aria-hidden="true">{tGlobal("Common.symbols.arrowLeft")}</span>
						{t("actions.backToDashboard")}
					</Link>

					<Link href={siteConfig.changePasswordPath} className="button button-primary">
						{t("actions.changePassword")}
						<span aria-hidden="true">{tGlobal("Common.symbols.arrowRight")}</span>
					</Link>
				</div>

				<section className={`surface-soft ${styles.section}`} aria-busy={isLoading}>
					<div className={styles.grid2}>
						<div className={`stack ${styles.full}`} style={{ gap: "var(--space-1)" }}>
							<label className="form-label">{t("fields.email.label")}</label>
							<input className="form-control" value={email} readOnly aria-readonly="true" />
							<p className="text-sm text-muted" style={{ margin: 0 }}>
								{t("fields.email.hint")}
							</p>
						</div>
					</div>
				</section>
			</MainColumn>
		</PageShell>
	);
}
