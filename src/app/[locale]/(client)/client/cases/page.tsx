/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/(client)/client/cases/page.tsx
SCOPE: Client cases list page. Data fetch + composition only (no UI primitives redefined here).
STATUS: LOCKED
AUDIT NOTES (PROD PRIMING):
- Removed inline styles (layout must live in module CSS / global primitives).
- Enforced server-only rendering hygiene: noStore() + locale-aware auth redirect.
- Filter input is validated against CASE_STATUS_ORDER; unknown values fall back to "all".
- Removed translation `.has` probing (unstable/fragile) and replaced with safeT() to prevent runtime crashes from missing keys.
- Avoids hardcoded strings; all user-facing text remains i18n.
APPLIES TO: /src/app/[locale]/(client)/client/cases/page.tsx
NOTES:
- Uses global primitives: PageShell, MainColumn, Panel, CaseRow, FilterSelect.
- Status filter options come from CASE_STATUS_ORDER + getCaseStatusMeta() (single source of truth).
CONTENT:
*/

export const dynamic = "force-dynamic";

import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabaseServer";

/* configs */
import { siteConfig } from "@/config/siteConfig";
import {
	CASE_STATUS,
	CASE_STATUS_ORDER,
	getCaseStatusMeta,
	isValidCaseStatus,
	type CaseStatusId,
} from "@/config/statuses";

/* page specific formatting module (shared with admin/cases) */
import styles from "@/styles/cases.module.css";

/* UI components */
import { PageShell } from "@/components/ui/layout/PageShell";
import { MainColumn } from "@/components/ui/layout/MainColumn";
import CaseRow from "@/components/ui/CaseRow";
import { Panel } from "@/components/ui/panel/Panel";
import FilterSelect from "@/components/ui/FilterSelect";
import NewCaseCTA from "@/components/ui/NewCaseCTA";

type CaseRowDb = {
	id: string;
	user_id: string;
	status: string;
	created_at: string;
	updated_at: string | null;
	application_id: string | null;
	intake_json: unknown;
};

type SearchParams = {
	status?: string | string[];
};

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

async function assertClientOrRedirect(locale: string) {
	const supabase = await createServerSupabaseClient();
	const { data, error } = await supabase.auth.getUser();

	if (error || !data.user) redirect(`/${locale}${siteConfig.loginPath}`);

	return { supabase, userId: data.user.id };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function safeDate(value: string | null | undefined) {
	if (!value) return null;
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? null : d;
}

function safeJsonObject(value: unknown): Record<string, unknown> {
	if (!value) return {};
	if (typeof value === "object") return value as Record<string, unknown>;

	if (typeof value === "string") {
		try {
			const parsed = JSON.parse(value);
			return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
		} catch {
			return {};
		}
	}

	return {};
}

function normalizeEnumKey(raw: string): string {
	return raw.trim().toLowerCase().replace(/\s+/g, "_").replace(/-+/g, "_");
}

/**
 * Safe translation wrapper:
 * - returns null if the key is missing or t() throws for any reason
 * - keeps the UI resilient even when a locale file is missing a new key
 */
function safeT(t: (key: string, values?: Record<string, any>) => string, key: string): string | null {
	try {
		return t(key);
	} catch {
		return null;
	}
}

function normalizeStatusFilter(value: unknown): CaseStatusId | "all" {
	if (typeof value !== "string") return "all";
	const s = value.trim();
	if (s.length === 0 || s === "all") return "all";
	return isValidCaseStatus(s) ? (s as CaseStatusId) : "all";
}

function normalizeCaseStatus(value: unknown): CaseStatusId {
	const s = typeof value === "string" ? value.trim() : "";
	return isValidCaseStatus(s) ? (s as CaseStatusId) : CASE_STATUS.DRAFT_INTAKE;
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function ClientCasesPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
	noStore();

	const uiLocale = await getLocale();
	const { supabase, userId } = await assertClientOrRedirect(uiLocale);

	const tClient = await getTranslations("ClientCases");
	const tGlobal = await getTranslations("GlobalForm");

	const sp = (await searchParams) ?? {};
	const rawStatus = Array.isArray(sp.status) ? sp.status[0] : sp.status;
	const selectedStatus = normalizeStatusFilter(rawStatus);

	/* ------------------------------------------------------------------------ */
	/* Data                                                                     */
	/* ------------------------------------------------------------------------ */

	let query = supabase
		.from("client_cases")
		.select("id,user_id,status,created_at,updated_at,application_id,intake_json")
		.eq("user_id", userId)
		.order("updated_at", { ascending: false })
		.limit(100);

	if (selectedStatus !== "all") {
		query = query.eq("status", selectedStatus);
	}

	const { data, error } = await query;

	if (error) {
		throw new Error(error.message);
	}

	const cases = (data ?? []) as CaseRowDb[];

	/* ------------------------------------------------------------------------ */
	/* Derived state                                                            */
	/* ------------------------------------------------------------------------ */

	const hasCases = cases.length > 0;

	// “Active” = any case not closed (adjust later if you want stricter logic)
	const hasActiveCase = cases.some((c) => c.status !== "closed");

	const statusOptions = [
		{ value: "all", label: tClient("filters.all") },
		...CASE_STATUS_ORDER.map((s) => {
			const meta = getCaseStatusMeta(s);
			return {
				value: s,
				label: tGlobal(`Statuses.cases.${meta.labelKey}`),
			};
		}),
	];

	const na = tGlobal("Common.na");

	/* ------------------------------------------------------------------------ */
	/* Render                                                                   */
	/* ------------------------------------------------------------------------ */

	return (
		<PageShell>
			<header className="hero-shell">
				<div className="hero-inner">
					<h1 className="hero-title">{tClient("hero.title")}</h1>
					<p className="hero-subtitle">{tClient("hero.subtitle")}</p>
				</div>
			</header>

			<MainColumn>
				<div className={styles.actionsRow} data-align="end">
					<NewCaseCTA
						href={siteConfig.clientNewCaseHref}
						label={tClient("Buttons.createNewCase")}
						shouldConfirm={hasActiveCase}
						confirmTitle={tClient("Confirm.newCaseTitle")}
						confirmBody={tClient("Confirm.newCaseActiveBody")}
						cancelLabel={tGlobal("Confirm.cancel")}
						confirmLabel={tGlobal("Confirm.continue")}
						arrowLabel={tGlobal("Common.symbols.arrowRight")}
					/>
				</div>

				<Panel
					title={tClient("list.title")}
					subtitle={tClient("list.subtitle")}
					actions={
						<FilterSelect
							action={siteConfig.clientCasesPath}
							label={tClient("filters.statusLabel")}
							name="status"
							defaultValue={selectedStatus}
							options={statusOptions}
						/>
					}
				>
					{!hasCases ? (
						<div className={styles.emptyState}>{tClient("list.empty")}</div>
					) : (
						<div className={styles.list}>
							{cases.map((c) => {
								const statusId = normalizeCaseStatus(c.status);
								const meta = getCaseStatusMeta(statusId);

								const createdAt = safeDate(c.created_at);
								const updatedAt = safeDate(c.updated_at ?? c.created_at);

								const intake = safeJsonObject(c.intake_json);

								const destinationRaw = typeof intake.destination === "string" ? intake.destination : null;

								const visaTypeRaw =
									typeof intake.visaType === "string"
										? intake.visaType
										: typeof intake.visa_type === "string"
											? intake.visa_type
											: null;

								const destinationKey = destinationRaw ? normalizeEnumKey(destinationRaw) : null;
								const visaTypeKey = visaTypeRaw ? normalizeEnumKey(visaTypeRaw) : null;

								// IMPORTANT:
								// destinations.* and visaTypes.* are expected to be canonical ids (already normalized),
								// but we still wrap lookup in safeT() to avoid runtime crashes during prod priming.
								const destinationLabel =
									(destinationKey
										? safeT(tGlobal as any, `destinations.${destinationKey}`)
										: null) ?? na;

								const visaTypeLabel =
									(visaTypeKey ? safeT(tGlobal as any, `visaTypes.${visaTypeKey}`) : null) ??
									(visaTypeKey ? safeT(tGlobal as any, `visa_types.${visaTypeKey}`) : null) ??
									na;

								const titleParts = [destinationLabel, visaTypeLabel].filter((v) => v !== na);
								const name =
									titleParts.length > 0
										? titleParts.join(` ${tGlobal("Common.symbols.dot")} `)
										: tClient("list.caseTitleFallback");

								return (
									<CaseRow
										key={c.id}
										href={siteConfig.clientCaseDetailsHref(c.id)}
										name={name}
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
