/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/(client)/client/applications/page.tsx
SCOPE: Client applications list. Data fetch + composition only (no UI primitives redefined here).
STATUS: LOCKED
AUDITED:
- searchParams is treated as Promise-compatible (Next.js 16 sync dynamic API behaviour) and safely unwrapped before use.
- Auth uses supabase.auth.getUser() (server-verified) and redirects are locale-aware (/${locale} + siteConfig path).
- Profile row presence is enforced (DB truth): missing client_profiles redirects to the client form route.
- Status filtering matches admin/applications pattern (?status=...), including NULL treated as waiting_documents.
NOTES:
- Uses global primitives: PageShell, MainColumn, Panel, ApplicationRow.
- Adds the SAME FilterSelect dropdown pattern as admin/applications (query param: ?status=...).
- No hardcoded English UI strings; all user-facing text is i18n.
CONTENT:
*/

export const dynamic = "force-dynamic";

import "server-only";

import { unstable_noStore as noStore } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { siteConfig } from "@/config/siteConfig";

import {
	APPLICATION_STATUS,
	type ApplicationStatusId,
	getApplicationStatusMeta,
	isValidApplicationStatus,
} from "@/config/statuses";

import { PageShell } from "@/components/ui/layout/PageShell";
import { MainColumn } from "@/components/ui/layout/MainColumn";
import { Panel } from "@/components/ui/panel/Panel";
import FilterSelect from "@/components/ui/FilterSelect";
import ApplicationRow from "@/components/ui/ApplicationRow";

import styles from "@/styles/cases.module.css";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type ClientApplicationDb = {
	id: string;
	application_type: string;
	application_status: string | null;
	destination: string | null;
	created_at: string;
	updated_at: string | null;
};

type RequirementRowDb = {
	application_id: string;
	document_type_id: string;
	required: boolean;
};

type DocumentRowDb = {
	application_id: string;
	document_type_id: string;
	status: string | null;
	copy_number: number | null;
	uploaded_at: string;
};

/* -------------------------------------------------------------------------- */
/* UI Order (explicitly excludes deprecated statuses)                         */
/* -------------------------------------------------------------------------- */

const APPLICATION_STATUS_UI_ORDER: ApplicationStatusId[] = [
	APPLICATION_STATUS.WAITING_DOCUMENTS,
	APPLICATION_STATUS.DOCUMENTS_UNDER_REVIEW,
	APPLICATION_STATUS.DOCUMENTS_APPROVED,
	APPLICATION_STATUS.DOCUMENTS_NOT_APPROVED,
	APPLICATION_STATUS.VISA_JOURNEY_STARTED,
	APPLICATION_STATUS.VISA_ISSUE_ACTION_NEEDED,
	APPLICATION_STATUS.VISA_APPROVED,
	APPLICATION_STATUS.FINISHED,
	APPLICATION_STATUS.CANCELLED,
];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function safeDate(value: unknown): Date | null {
	if (!value) return null;
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
	if (typeof value !== "string") return null;

	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeEnumKey(raw: string): string {
	return raw
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "_")
		.replace(/-+/g, "_");
}

function normalizeApplicationStatus(value: unknown): ApplicationStatusId {
	if (typeof value !== "string") return APPLICATION_STATUS.WAITING_DOCUMENTS;

	const s = value.trim();
	return isValidApplicationStatus(s) ? (s as ApplicationStatusId) : APPLICATION_STATUS.WAITING_DOCUMENTS;
}

function normalizeStatusFilter(value: unknown): ApplicationStatusId | "all" {
	if (typeof value !== "string") return "all";
	const s = value.trim();
	if (s.length === 0 || s === "all") return "all";
	return isValidApplicationStatus(s) ? (s as ApplicationStatusId) : "all";
}

function safeT(
	t: (key: string, values?: Record<string, any>) => string,
	key: string,
): string | null {
	try {
		return t(key);
	} catch {
		return null;
	}
}

async function assertClientOrRedirect(
	supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
	locale: string,
) {
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect(`/${locale}${siteConfig.loginPath}`);

	return { userId: user.id };
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function ClientApplicationsPage({
	searchParams,
}: {
	searchParams?: Promise<{ status?: string | string[] }>;
}) {
	noStore();

	const sp = searchParams ? await searchParams : {};
	const rawStatus = Array.isArray(sp.status) ? sp.status[0] : sp.status;
	const statusFilter = normalizeStatusFilter(rawStatus);

	const tClient = await getTranslations("ClientApplications");
	const tGlobal = await getTranslations("GlobalForm");
	const locale = await getLocale();

	const supabase = await createServerSupabaseClient();
	const { userId } = await assertClientOrRedirect(supabase, locale);

	const fmtLong = new Intl.DateTimeFormat(locale, {
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	const na = tGlobal("Common.na");
	const dateNa = tGlobal("Common.dates.na");
	const arrowRight = tGlobal("Common.symbols.arrowRight");

	/* ------------------------------------------------------------------------ */
	/* Profile guard (DB truth): profile row must exist.                         */
	/* ------------------------------------------------------------------------ */

	const { data: profile } = await supabase
		.from("client_profiles")
		.select("user_id")
		.eq("user_id", userId)
		.maybeSingle();

	if (!profile) {
		redirect(`/${locale}${siteConfig.clientAccountPath}`);
	}

	/* ------------------------------------------------------------------------ */
	/* Filter options (same pattern as admin/applications)                       */
	/* ------------------------------------------------------------------------ */

	const statusOptions = [
		{ value: "all", label: tGlobal("Statuses.applications.all") },
		...APPLICATION_STATUS_UI_ORDER.map((s) => {
			const m = getApplicationStatusMeta(s);
			return {
				value: s,
				label: tGlobal(`Statuses.applications.${m.labelKey}`),
			};
		}),
	];

	/* ------------------------------------------------------------------------ */
	/* Data                                                                      */
	/* ------------------------------------------------------------------------ */

	let query = supabase
		.from("client_applications")
		.select("id, application_type, application_status, created_at, updated_at, destination")
		.eq("user_id", userId);

	// Apply filter (treat NULL as waiting_documents)
	if (statusFilter !== "all") {
		if (statusFilter === APPLICATION_STATUS.WAITING_DOCUMENTS) {
			query = query.or("application_status.is.null,application_status.eq.waiting_documents");
		} else {
			query = query.eq("application_status", statusFilter);
		}
	}

	const { data, error } = await query.order("updated_at", { ascending: false });

	if (error) {
		throw new Error(error.message);
	}

	const applications = (data ?? []) as ClientApplicationDb[];
	const hasApplications = applications.length > 0;

	/* ------------------------------------------------------------------------ */
	/* Docs progress (required / uploaded / approved)                            */
	/* ------------------------------------------------------------------------ */

	const applicationIds = applications.map((a) => a.id).filter(Boolean);

	const requiredTypesByApp = new Map<string, Set<string>>();
	const latestDocByAppType = new Map<string, Map<string, DocumentRowDb>>();

	if (applicationIds.length > 0) {
		// 1) Requirements (DB truth): required doc types per application
		const { data: reqRows, error: reqError } = await supabase
			.from("client_application_requirements")
			.select("application_id, document_type_id, required")
			.in("application_id", applicationIds);

		if (reqError) throw new Error(reqError.message);

		const reqs = (reqRows ?? []) as RequirementRowDb[];

		for (const r of reqs) {
			if (!r || r.required !== true) continue;

			const appId = typeof r.application_id === "string" ? r.application_id.trim() : "";
			const docTypeId = typeof r.document_type_id === "string" ? r.document_type_id.trim() : "";
			if (!appId || !docTypeId) continue;

			let set = requiredTypesByApp.get(appId);
			if (!set) {
				set = new Set<string>();
				requiredTypesByApp.set(appId, set);
			}
			set.add(docTypeId);
		}

		// 2) Docs (scoped by user via RLS): latest per (app, doc type)
		const { data: docRows, error: docError } = await supabase
			.from("client_documents")
			.select("application_id, document_type_id, status, copy_number, uploaded_at")
			.in("application_id", applicationIds);

		if (docError) throw new Error(docError.message);

		const docs = (docRows ?? []) as DocumentRowDb[];

		for (const d of docs) {
			const appId = typeof d.application_id === "string" ? d.application_id.trim() : "";
			const docTypeId = typeof d.document_type_id === "string" ? d.document_type_id.trim() : "";
			if (!appId || !docTypeId) continue;

			let byType = latestDocByAppType.get(appId);
			if (!byType) {
				byType = new Map<string, DocumentRowDb>();
				latestDocByAppType.set(appId, byType);
			}

			const cur = byType.get(docTypeId);
			if (!cur) {
				byType.set(docTypeId, d);
				continue;
			}

			const curCopy = cur.copy_number ?? -1;
			const newCopy = d.copy_number ?? -1;

			if (newCopy !== curCopy) {
				if (newCopy > curCopy) byType.set(docTypeId, d);
				continue;
			}

			const curTime = cur.uploaded_at ? new Date(cur.uploaded_at).getTime() : 0;
			const newTime = d.uploaded_at ? new Date(d.uploaded_at).getTime() : 0;

			if (newTime >= curTime) byType.set(docTypeId, d);
		}
	}

	/* ------------------------------------------------------------------------ */
	/* Render                                                                    */
	/* ------------------------------------------------------------------------ */

	return (
		<PageShell>
			<header className="hero-shell">
				<div className="hero-inner">
					<h1 className="hero-title">{tClient("title")}</h1>
					<p className="hero-subtitle">{tClient("subtitle")}</p>
				</div>
			</header>

			<MainColumn>
				<Panel
					title={tClient("list.title")}
					subtitle={tClient("list.subtitle")}
					actions={
						<FilterSelect
							label={tGlobal("Statuses.filter")}
							name="status"
							defaultValue={statusFilter}
							options={statusOptions}
						/>
					}
				>
					{!hasApplications ? (
						<div className={styles.emptyState}>{tClient("list.empty")}</div>
					) : (
						<div className={styles.list}>
							{applications.map((app) => {
								const status = normalizeApplicationStatus(app.application_status);
								const meta = getApplicationStatusMeta(status);

								const createdAt = safeDate(app.created_at);
								const updatedAt = safeDate(app.updated_at);

								const typeKey = normalizeEnumKey(app.application_type);
								const typeLabel = safeT(tGlobal, `visaTypes.${typeKey}`) ?? na;

								const destinationLabel =
									typeof app.destination === "string" && app.destination.trim().length > 0
										? safeT(tGlobal, `destinations.${normalizeEnumKey(app.destination)}`) ?? ""
										: "";

								const title = destinationLabel ? `${typeLabel} (${destinationLabel})` : typeLabel;

								const requiredTypes = requiredTypesByApp.get(app.id) ?? new Set<string>();
								const requiredCount = requiredTypes.size;

								let uploadedCount = 0;
								let approvedCount = 0;

								if (requiredCount > 0) {
									const byType = latestDocByAppType.get(app.id) ?? new Map<string, DocumentRowDb>();

									for (const docTypeId of requiredTypes.values()) {
										const latest = byType.get(docTypeId) ?? null;
										if (!latest) continue;

										uploadedCount += 1;

										const st = typeof latest.status === "string" ? latest.status.trim() : "";
										if (st === "approved") approvedCount += 1;
									}
								}

								const docsSummary =
									requiredCount > 0
										? tGlobal("ApplicationRow.docsSummary", {
												uploaded: uploadedCount,
												required: requiredCount,
												approved: approvedCount,
											})
										: null;

								return (
									<ApplicationRow
										key={app.id}
										href={siteConfig.clientApplicationDetailsHref(app.id)}
										title={title}
										subtitle=""
										createdAt={createdAt}
										updatedAt={updatedAt ?? createdAt}
										statusLabel={tGlobal(`Statuses.applications.${meta.labelKey}`)}
										statusTone={meta.badgeTone}
										openLabel={tClient("actions.viewDetails")}
										createdLabel={tClient("dates.created")}
										updatedLabel={tClient("dates.lastUpdate")}
										applicationId={app.id}
										applicationIdLabel={tGlobal("ApplicationRow.applicationId")}
										docsSummary={docsSummary}
										dateNaLabel={dateNa}
										arrowLabel={arrowRight}
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
