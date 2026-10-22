/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/(admin)/admin/cases/page.tsx
SCOPE: Admin cases list page. Data fetch + composition only (no UI primitives redefined here).
STATUS: LOCKED
AUDITED:
- Page uses service-role Supabase (bypasses RLS): added locale-safe, server-verified auth.getUser() gate + explicit role check (defense-in-depth).
- Redirects now preserve /[locale] to avoid leaking users into wrong locale routes (and to match next-intl routing expectations).
- Role lookup errors now handled (fail closed).
APPLIES TO: /src/app/[locale]/(admin)/admin/cases/page.tsx
NOTES:
- Uses global primitives: PageShell, MainColumn, Panel, StatCard, CaseRow, FilterSelect.
- Status filter options come from CASE_STATUS_ORDER + getCaseStatusMeta() (single source of truth).
- No hardcoded English UI strings; CaseRow labels passed via i18n keys.
- Requires SUPABASE_SERVICE_ROLE_KEY (service role) after admin/consultant gate.
CONTENT:
*/

export const dynamic = "force-dynamic";

/* Imports */

import "server-only";

import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import {
	createServerSupabaseClient,
	createAdminSupabaseClient,
} from "@/lib/supabaseServer";

/* configs */
import { siteConfig } from "@/config/siteConfig";
import { CASE_STATUS_ORDER, getCaseStatusMeta } from "@/config/statuses";

/* page specific formatting module */
import styles from "@/styles/cases.module.css";

/* UI components */
import { PageShell } from "@/components/ui/layout/PageShell";
import { MainColumn } from "@/components/ui/layout/MainColumn";
import StatCard from "@/components/ui/StatCard";
import CaseRow from "@/components/ui/CaseRow";
import { Panel } from "@/components/ui/panel/Panel";
import FilterSelect from "@/components/ui/FilterSelect";

/* -------------------------------------------------------------------------- */
/* Admin Supabase (service role)                                              */
/* -------------------------------------------------------------------------- */

function getAdminSupabase() {
	// Centralized server-only service role client.
	// Prevents accidental key exposure and keeps blast radius contained.
	// NOTE: Previous per-page X-Client-Info header was intentionally removed.
	// If needed, it should be added centrally in createAdminSupabaseClient().
	return createAdminSupabaseClient();
}

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type CaseRowDb = {
	id: string;
	user_id: string;
	status: string;
	created_at: string;
	updated_at: string | null;
	application_id: string | null;
};

type ProfileNameRowDb = {
	user_id: string;
	first_name: string | null;
	last_name: string | null;
};

type SearchParams = {
	status?: string | string[];
};

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

function logPostgrestError(label: string, err: unknown) {
	const e: any = err;
	// eslint-disable-next-line no-console
	console.error(label, {
		message: e?.message ?? null,
		details: e?.details ?? null,
		hint: e?.hint ?? null,
		code: e?.code ?? null,
	});
}

async function assertAdminOrConsultantOrRedirect(locale: string) {
	const supabase = await createServerSupabaseClient();

	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();

	if (userError) logPostgrestError("[AdminCases] auth.getUser error:", userError);

	if (userError || !user) {
		redirect(`/${locale}${siteConfig.loginPath}`);
	}

	const { data: roleRow, error: roleError } = await supabase
		.from("user_roles")
		.select("role")
		.eq("user_id", user.id)
		.maybeSingle();

	if (roleError) logPostgrestError("[AdminCases] user_roles read error:", roleError);

	const role = (roleRow?.role ?? "").toString();
	const allowed = role === "admin" || role === "consultant";

	if (!allowed) {
		// fail closed to a safe, locale-preserving route
		redirect(`/${locale}${siteConfig.clientDashboardPath}`);
	}

	return { actorUserId: user.id, actorRole: role };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function safeDate(value: string | null | undefined) {
	if (!value) return null;
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? null : d;
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function AdminCasesPage({
	searchParams,
}: {
	// Next.js 16 typed PageProps expects Promise for searchParams
	searchParams?: Promise<SearchParams>;
}) {
	const uiLocale = await getLocale();
	await assertAdminOrConsultantOrRedirect(uiLocale);

	const supabase = getAdminSupabase();

	const tAdmin = await getTranslations("AdminCases");
	const tGlobal = await getTranslations("GlobalForm");

	const sp = (await searchParams) ?? {};
	const rawStatus = sp.status;
	const status = Array.isArray(rawStatus) ? rawStatus[0] : rawStatus;

	const selectedStatus = typeof status === "string" ? status.trim() : "all";

	/* ------------------------------------------------------------------------ */
	/* Data                                                                     */
	/* ------------------------------------------------------------------------ */

	let query = supabase
		.from("client_cases")
		.select(
			`
				id,
				user_id,
				status,
				created_at,
				updated_at,
				application_id
			`,
		)
		.order("updated_at", { ascending: false })
		.limit(100);

	if (selectedStatus !== "all") {
		query = query.eq("status", selectedStatus);
	}

	const { data, error } = await query;
	if (error) throw new Error(error.message);

	const cases = (data ?? []) as CaseRowDb[];
	
	const userIds = Array.from(new Set(cases.map((c) => c.user_id).filter(Boolean)));
	
	const profileByUserId = new Map<string, ProfileNameRowDb>();
	
	if (userIds.length > 0) {
		const { data: profRows, error: profError } = await supabase
			.from("client_profiles")
			.select("user_id, first_name, last_name")
			.in("user_id", userIds);
	
		if (profError) throw new Error(profError.message);
	
		const rows = (profRows ?? []) as ProfileNameRowDb[];
		for (const r of rows) {
			if (typeof r.user_id === "string" && r.user_id.trim().length > 0) {
				profileByUserId.set(r.user_id, r);
			}
		}
	}
	

	/* ------------------------------------------------------------------------ */
	/* Derived state                                                            */
	/* ------------------------------------------------------------------------ */

	const hasCases = cases.length > 0;

	const stats = cases.reduce(
		(acc, c) => {
			acc.total += 1;

			if (c.status === "intake_submitted") acc.submitted += 1;
			if (c.status.startsWith("consultation")) acc.consultations += 1;
			if (c.status === "plan_created") acc.plans += 1;
			if (c.status === "application_activated") acc.activated += 1;

			return acc;
		},
		{
			total: 0,
			submitted: 0,
			consultations: 0,
			plans: 0,
			activated: 0,
		},
	);

	const statusOptions = [
		{ value: "all", label: tAdmin("filters.all") },
		...CASE_STATUS_ORDER.map((s) => {
			const meta = getCaseStatusMeta(s);
			return {
				value: s,
				label: tGlobal(`Statuses.cases.${meta.labelKey}`),
			};
		}),
	];

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
				<section className={styles.statsGrid}>
					<StatCard
						label={tAdmin("stats.total.label")}
						value={stats.total}
						help={tAdmin("stats.total.helpText")}
						tone="slate"
					/>
					<StatCard
						label={tAdmin("stats.submitted.label")}
						value={stats.submitted}
						help={tAdmin("stats.submitted.helpText")}
						tone="sky"
					/>
					<StatCard
						label={tAdmin("stats.consultations.label")}
						value={stats.consultations}
						help={tAdmin("stats.consultations.helpText")}
						tone="amber"
					/>
					<StatCard
						label={tAdmin("stats.plans.label")}
						value={stats.plans}
						help={tAdmin("stats.plans.helpText")}
						tone="amber"
					/>
					<StatCard
						label={tAdmin("stats.activated.label")}
						value={stats.activated}
						help={tAdmin("stats.activated.helpText")}
						tone="emerald"
					/>
				</section>

				<Panel
					title={tAdmin("list.title")}
					subtitle={tAdmin("list.subtitle")}
					actions={
						<FilterSelect
							action={siteConfig.adminCasesPath}
							label={tAdmin("filters.statusLabel")}
							name="status"
							defaultValue={selectedStatus}
							options={statusOptions}
						/>
					}
				>
					{!hasCases ? (
						<div className={styles.emptyState}>{tAdmin("list.empty")}</div>
					) : (
						<div className={styles.list}>
							{cases.map((c) => {
								const profile = profileByUserId.get(c.user_id) ?? null;

								const name = profile
									? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()
									: "";

								const meta = getCaseStatusMeta(c.status);
								const createdAt = safeDate(c.created_at);
								const updatedAt = safeDate(c.updated_at ?? c.created_at);

								return (
									<CaseRow
										key={c.id}
										href={siteConfig.adminCaseDetailsHref(c.id)}
										name={name || tAdmin("list.unknownUserNameFallback", { userId: c.user_id })}
										createdAt={createdAt}
										updatedAt={updatedAt}
										caseId={c.id}
										statusLabel={tGlobal(`Statuses.cases.${meta.labelKey}`)}
										statusTone={meta.badgeTone}
										openLabel={tGlobal("Buttons.open")}
										createdLabel={tGlobal("CaseRow.created")}
										updatedLabel={tGlobal("CaseRow.updated")}
										caseIdLabel={tGlobal("CaseRow.caseId")}
										dateNaLabel={tGlobal("Common.dates.na")}
										arrowLabel={tGlobal("Common.symbols.arrowRight")}
									/>
								);
							})}
						</div>
					)}
				</Panel>
			</MainColumn>
		</PageShell>
	);
}
