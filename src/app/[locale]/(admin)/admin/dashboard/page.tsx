/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/(admin)/admin/dashboard/page.tsx
SCOPE: Admin dashboard (stats overview). Server-only. Uses service role for aggregate counts AFTER admin gate. Composition only (no UI primitives redefined here).
STATUS: UNLOCKED (lock after verified)
AUDITED:
- Gate: Enforces admin access via auth.getUser() + user_roles BEFORE any service-role reads.
- RLS: Uses service role (bypasses RLS) ONLY for aggregate counts after gate; file remains server-only.
- Data exposure: Uses head:true + id-only selects for counts (no sensitive row fields returned).
- Query safety: Status filters use explicit allowlists (.eq / .in / .ilike prefix match) — no raw SQL and no user-provided params.
- Redirects: Redirects are locale-prefixed; ensure paths remain locale-aware and consistent with siteConfig.
NOTES:
- No translation keys were changed.
- Service role access is centralized and server-only.
*/

export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/* Imports                                                                    */
/* -------------------------------------------------------------------------- */

import "server-only";

import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import dash from "./dashboard.module.css";

import {
	createServerSupabaseClient,
	createAdminSupabaseClient,
} from "@/lib/supabaseServer";
import { siteConfig } from "@/config/siteConfig";

import styles from "@/styles/casedetails.module.css";
import { PageShell } from "@/components/ui/layout/PageShell";
import { MainColumn } from "@/components/ui/layout/MainColumn";
import { DisclosurePanel } from "@/components/ui/panel/DisclosurePanel";
import StatCard from "@/components/ui/StatCard";
import { Link } from "@/i18n/navigation";

/* -------------------------------------------------------------------------- */
/* Google Drive Link                                                          */
/* -------------------------------------------------------------------------- */

function getDriveRootFolderUrl() {
	const id = (process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ?? "").trim();
	if (!id) return null;
	return `https://drive.google.com/drive/folders/${encodeURIComponent(id)}`;
}

/* -------------------------------------------------------------------------- */
/* Admin Supabase (Service Role)                                              */
/* -------------------------------------------------------------------------- */

function getAdminSupabase() {
	// Centralized server-only service role client.
	// Prevents accidental key exposure and keeps blast radius contained.
	// NOTE: Previous per-page X-Client-Info header was intentionally removed.
	// If required, add centrally in createAdminSupabaseClient().
	return createAdminSupabaseClient();
}

/* -------------------------------------------------------------------------- */
/* AuthZ Gate (Defense-in-Depth)                                              */
/* -------------------------------------------------------------------------- */

async function assertAdminOrRedirect(locale: string) {
	const sessionSupabase = await createServerSupabaseClient();

	const {
		data: { user },
		error: userError,
	} = await sessionSupabase.auth.getUser();

	if (userError || !user) {
		redirect(`/${locale}${siteConfig.loginPath}`);
	}

	const { data: roleRow, error: roleError } = await sessionSupabase
		.from("user_roles")
		.select("role")
		.eq("user_id", user.id)
		.maybeSingle();

	const role = (roleRow?.role ?? "").toString();

	if (roleError || role !== "admin") {
		redirect(`/${locale}${siteConfig.clientDashboardPath}`);
	}

	return { actorUserId: user.id };
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function AdminDashboardPage() {
	const uiLocale = await getLocale();
	await assertAdminOrRedirect(uiLocale);

	const supabase = getAdminSupabase();

	const tAdmin = await getTranslations("AdminDashboard");
	const tCases = await getTranslations("AdminCases");
	const tApps = await getTranslations("AdminApplications");
	const tGlobal = await getTranslations("GlobalForm");
	const chevronLabel = tGlobal("Common.symbols.chevronDown");
	
	const driveRootUrl = getDriveRootFolderUrl();
	

	/* ------------------------------------------------------------------------ */
	/* Cases stats (same buckets as /admin/cases)                                */
	/* ------------------------------------------------------------------------ */

	const [
		casesTotalRes,
		casesSubmittedRes,
		casesConsultationsRes,
		casesPlansRes,
		casesActivatedRes,
	] = await Promise.all([
		supabase.from("client_cases").select("id", { count: "exact", head: true }),
		supabase
			.from("client_cases")
			.select("id", { count: "exact", head: true })
			.eq("status", "intake_submitted"),
		supabase
			.from("client_cases")
			.select("id", { count: "exact", head: true })
			.ilike("status", "consultation%"),
		supabase
			.from("client_cases")
			.select("id", { count: "exact", head: true })
			.eq("status", "plan_created"),
		supabase
			.from("client_cases")
			.select("id", { count: "exact", head: true })
			.eq("status", "application_activated"),
	]);

	const caseStats = {
		total: casesTotalRes.count ?? 0,
		submitted: casesSubmittedRes.count ?? 0,
		consultations: casesConsultationsRes.count ?? 0,
		plans: casesPlansRes.count ?? 0,
		activated: casesActivatedRes.count ?? 0,
	};

	/* ------------------------------------------------------------------------ */
	/* Applications stats (same buckets as /admin/applications)                  */
	/* ------------------------------------------------------------------------ */

	const [
		appsTotalRes,
		appsWaitingRes,
		appsReviewRes,
		appsActionNeededRes,
		appsCompletedRes,
	] = await Promise.all([
		supabase.from("client_applications").select("id", { count: "exact", head: true }),
		supabase
			.from("client_applications")
			.select("id", { count: "exact", head: true })
			.in("application_status", ["waiting_documents"]),
		supabase
			.from("client_applications")
			.select("id", { count: "exact", head: true })
			.in("application_status", ["documents_under_review"]),
		supabase
			.from("client_applications")
			.select("id", { count: "exact", head: true })
			.in("application_status", ["documents_not_approved", "visa_issue_action_needed"]),
		supabase
			.from("client_applications")
			.select("id", { count: "exact", head: true })
			.in("application_status", ["visa_approved", "finished"]),
	]);

	const appStats = {
		total: appsTotalRes.count ?? 0,
		waiting: appsWaitingRes.count ?? 0,
		review: appsReviewRes.count ?? 0,
		actionNeeded: appsActionNeededRes.count ?? 0,
		completed: appsCompletedRes.count ?? 0,
	};

	/* ------------------------------------------------------------------------ */
	/* Render                                                                   */
	/* ------------------------------------------------------------------------ */

	return (
		<PageShell>
			<header className="hero-shell">
				<div className="hero-inner">
					<h1 className="hero-title">{tAdmin("title")}</h1>
					<p className="hero-subtitle">{tAdmin("subtitle")}</p>
					<p className="hero-desc">{tAdmin("description")}</p>
				</div>
			</header>

			<MainColumn>
				<div className="stack">
					{driveRootUrl ? (
						<div className="formInline">
							<a
								href={driveRootUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="button button-secondary"
							>
								{tGlobal("actions.openInDrive")}
								<span className={styles.arrow} aria-hidden="true"> 
									{tGlobal("Common.symbols.arrowRight")} 
								</span>
							</a>
						</div>
					) : null}
					{/* Collapsed by default: Cases */}
					<DisclosurePanel
						id="panel-cases"
						title={tCases("title")}
						subtitle={tCases("subtitle")}
						defaultOpen={false}
						chevronLabel={chevronLabel}
					>
						<section className={dash.statsGrid}>
							<Link
								href={siteConfig.adminCasesPath}
								className={dash.cardLink}
								aria-label={tCases("stats.total.label")}
								title={tCases("stats.total.label")}
							>
								<StatCard
									label={tCases("stats.total.label")}
									value={caseStats.total}
									help={tCases("stats.total.helpText")}
									tone="slate"
								/>
							</Link>

							<Link
								href={siteConfig.adminCasesByStatusHref("intake_submitted")}
								className={dash.cardLink}
								aria-label={tCases("stats.submitted.label")}
								title={tCases("stats.submitted.label")}
							>
								<StatCard
									label={tCases("stats.submitted.label")}
									value={caseStats.submitted}
									help={tCases("stats.submitted.helpText")}
									tone="sky"
								/>
							</Link>

							<Link
								href={siteConfig.adminCasesByStatusHref("consultation_requested")}
								className={dash.cardLink}
								aria-label={tCases("stats.consultations.label")}
								title={tCases("stats.consultations.label")}
							>
								<StatCard
									label={tCases("stats.consultations.label")}
									value={caseStats.consultations}
									help={tCases("stats.consultations.helpText")}
									tone="amber"
								/>
							</Link>

							<Link
								href={siteConfig.adminCasesByStatusHref("plan_created")}
								className={dash.cardLink}
								aria-label={tCases("stats.plans.label")}
								title={tCases("stats.plans.label")}
							>
								<StatCard
									label={tCases("stats.plans.label")}
									value={caseStats.plans}
									help={tCases("stats.plans.helpText")}
									tone="amber"
								/>
							</Link>

							<Link
								href={siteConfig.adminCasesByStatusHref("application_activated")}
								className={dash.cardLink}
								aria-label={tCases("stats.activated.label")}
								title={tCases("stats.activated.label")}
							>
								<StatCard
									label={tCases("stats.activated.label")}
									value={caseStats.activated}
									help={tCases("stats.activated.helpText")}
									tone="emerald"
								/>
							</Link>
						</section>
					</DisclosurePanel>

					{/* Collapsed by default: Applications */}
					<DisclosurePanel
						id="panel-applications"
						title={tApps("title")}
						subtitle={tApps("subtitle")}
						defaultOpen={false}
						chevronLabel={chevronLabel}
					>
						<section className={dash.statsGrid}>
							<Link
								href={siteConfig.adminApplicationsPath}
								className={dash.cardLink}
								aria-label={tApps("stats.total.label")}
								title={tApps("stats.total.label")}
							>
								<StatCard
									label={tApps("stats.total.label")}
									value={appStats.total}
									help={tApps("stats.total.helpText")}
									tone="slate"
								/>
							</Link>

							<Link
								href={siteConfig.adminApplicationsByStatusHref("waiting_documents")}
								className={dash.cardLink}
								aria-label={tApps("stats.waiting.label")}
								title={tApps("stats.waiting.label")}
							>
								<StatCard
									label={tApps("stats.waiting.label")}
									value={appStats.waiting}
									help={tApps("stats.waiting.helpText")}
									tone="sky"
								/>
							</Link>

							<Link
								href={siteConfig.adminApplicationsByStatusHref("documents_under_review")}
								className={dash.cardLink}
								aria-label={tApps("stats.review.label")}
								title={tApps("stats.review.label")}
							>
								<StatCard
									label={tApps("stats.review.label")}
									value={appStats.review}
									help={tApps("stats.review.helpText")}
									tone="amber"
								/>
							</Link>

							<Link
								href={siteConfig.adminApplicationsByStatusHref("visa_issue_action_needed")}
								className={dash.cardLink}
								aria-label={tApps("stats.actionNeeded.label")}
								title={tApps("stats.actionNeeded.label")}
							>
								<StatCard
									label={tApps("stats.actionNeeded.label")}
									value={appStats.actionNeeded}
									help={tApps("stats.actionNeeded.helpText")}
									tone="rose"
								/>
							</Link>

							<Link
								href={siteConfig.adminApplicationsByStatusHref("finished")}
								className={dash.cardLink}
								aria-label={tApps("stats.completed.label")}
								title={tApps("stats.completed.label")}
							>
								<StatCard
									label={tApps("stats.completed.label")}
									value={appStats.completed}
									help={tApps("stats.completed.helpText")}
									tone="emerald"
								/>
							</Link>
						</section>
					</DisclosurePanel>
				</div>
			</MainColumn>
		</PageShell>
	);
}
