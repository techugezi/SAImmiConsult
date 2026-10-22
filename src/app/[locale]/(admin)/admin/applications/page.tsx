/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/(admin)/admin/applications/page.tsx
SCOPE: Admin applications list page. Data fetch + composition only (no UI primitives redefined here).
STATUS: LOCKED
AUDITED:
- Gate: Enforces admin/consultant access via auth.getUser() + user_roles before any service-role reads.
- RLS: Uses service role (bypasses RLS) ONLY after gate; keep this file server-only.
- Query safety: Normalizes status param + normalizes DB status defensively (dev throws on unknown).
- Data exposure: Only selects required fields (no sensitive profile fields).
- Redirects: Uses locale-aware redirects via siteConfig paths (no i18n keys touched).
NOTES:
- No translation keys were changed.
- Service role key must remain server-only (never NEXT_PUBLIC_*).
*/
export const dynamic = "force-dynamic";

/* Imports */

import "server-only";

import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import {
	createServerSupabaseClient,
	createAdminSupabaseClient,
} from "@/lib/supabaseServer";

/* configs */
import { siteConfig } from "@/config/siteConfig";
import {
	APPLICATION_STATUS,
	getApplicationStatusMeta,
	isValidApplicationStatus,
	type ApplicationStatusId,
} from "@/config/statuses";

/* page layout module (Cases-aligned) */
import styles from "@/styles/cases.module.css";

/* UI components */
import { PageShell } from "@/components/ui/layout/PageShell";
import { MainColumn } from "@/components/ui/layout/MainColumn";
import StatCard from "@/components/ui/StatCard";
import { Panel } from "@/components/ui/panel/Panel";
import FilterSelect from "@/components/ui/FilterSelect";
import ApplicationRow from "@/components/ui/ApplicationRow";

/* -------------------------------------------------------------------------- */
/* Admin Supabase (Service Role)                                              */
/* -------------------------------------------------------------------------- */

function getAdminSupabase() {
	// Centralized server-only service role client (prevents accidental key exposure).
	return createAdminSupabaseClient();
}

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type ApplicationRowDb = {
	id: string;
	user_id: string;

	application_type: string;
	application_status: string;

	destination: string | null;

	created_at: string;
	updated_at: string | null;
};

type ProfileNameRowDb = {
	user_id: string;
	first_name: string | null;
	last_name: string | null;
};

type SearchParams = {
	status?: string | string[];
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
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

async function assertAdminOrConsultant() {
	const supabase = await createServerSupabaseClient();
	const { data, error } = await supabase.auth.getUser();

	if (error || !data.user) redirect(siteConfig.loginPath);

	const { data: roleRow, error: roleError } = await supabase
		.from("user_roles")
		.select("role")
		.eq("user_id", data.user.id)
		.maybeSingle();

	// Fail closed
	if (roleError || !roleRow || (roleRow.role !== "admin" && roleRow.role !== "consultant")) {
		redirect("/");
	}

	return data.user.id;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function safeDate(value: string | null | undefined) {
	if (!value) return null;
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? null : d;
}

function firstParam(value: string | string[] | undefined) {
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value[0];
	return undefined;
}

function normalizeStatusParam(raw: unknown) {
	const s = typeof raw === "string" ? raw.trim() : "";
	if (s.length === 0) return "all";
	if (s === "all") return "all";
	return isValidApplicationStatus(s) ? s : "all";
}

/* ──────────────────────────────────────────────────────────────
   STATUS NORMALIZATION (single source of truth = /src/config/statuses.ts)
   - Normalize any DB / query-provided status to ApplicationStatusId
   - In dev: throw fast if DB returns an unknown status (prevents silent fallback confusion)
   - In prod: fallback to waiting_documents
   ────────────────────────────────────────────────────────────── */

function normalizeApplicationStatus(value: unknown): ApplicationStatusId {
	const s = typeof value === "string" ? value.trim() : "";

	if (isValidApplicationStatus(s)) return s as ApplicationStatusId;

	if (process.env.NODE_ENV !== "production" && s.length > 0) {
		throw new Error(`[AdminApplications] Unknown application status from DB: "${s}"`);
	}

	return APPLICATION_STATUS.WAITING_DOCUMENTS;
}

function getApplicationStatusOrder() {
	return [
		APPLICATION_STATUS.WAITING_DOCUMENTS,
		APPLICATION_STATUS.DOCUMENTS_UNDER_REVIEW,
		APPLICATION_STATUS.DOCUMENTS_NOT_APPROVED,
		APPLICATION_STATUS.DOCUMENTS_APPROVED,
		APPLICATION_STATUS.VISA_JOURNEY_STARTED,
		APPLICATION_STATUS.VISA_ISSUE_ACTION_NEEDED,
		APPLICATION_STATUS.VISA_APPROVED,
		APPLICATION_STATUS.FINISHED,
		APPLICATION_STATUS.CANCELLED,
	] as const;
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function AdminApplicationsPage({
	searchParams,
}: {
	searchParams?: Promise<SearchParams>;
}) {
	// Must gate BEFORE any service-role reads
	await assertAdminOrConsultant();

	const supabase = getAdminSupabase();

	const tAdmin = await getTranslations("AdminApplications");
	const tGlobal = await getTranslations("GlobalForm");
	const tCases = await getTranslations("AdminCases");

	const sp = searchParams ? await searchParams : {};
	const selectedStatus = normalizeStatusParam(firstParam(sp.status));

	/* ------------------------------------------------------------------------ */
	/* Data                                                                     */
	/* ------------------------------------------------------------------------ */

	let query = supabase
		.from("client_applications")
		.select(
			`
				id,
				user_id,
				application_type,
				application_status,
				destination,
				created_at,
				updated_at
			`,
		)
		.order("updated_at", { ascending: false })
		.limit(100);

	if (selectedStatus !== "all") {
		query = query.eq("application_status", selectedStatus);
	}

	const { data, error } = await query;
	if (error) throw new Error(error.message);

	const applications = (data ?? []) as ApplicationRowDb[];
	
	const userIds = Array.from(new Set(applications.map((a) => a.user_id).filter(Boolean)));
	
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
	/* Docs progress (required / uploaded / approved)                            */
	/* ------------------------------------------------------------------------ */

	const applicationIds = applications.map((a) => a.id).filter(Boolean);

	// required doc type ids per application
	const requiredTypesByApp = new Map<string, Set<string>>();
	const requiredCountByApp = new Map<string, number>();

	// latest uploaded doc per (app, doc_type)
	const latestDocByAppType = new Map<string, Map<string, DocumentRowDb>>();

	if (applicationIds.length > 0) {
		// 1) Requirements: required doc types per application
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

		for (const [appId, set] of requiredTypesByApp.entries()) {
			requiredCountByApp.set(appId, set.size);
		}

		// 2) Documents: pull docs for these apps and compute “latest per doc type”
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

			// Prefer higher copy_number; if missing, fallback to uploaded_at
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
	/* Derived state                                                            */
	/* ------------------------------------------------------------------------ */

	const hasApplications = applications.length > 0;

	const stats = applications.reduce(
		(acc, a) => {
			acc.total += 1;

			const s = normalizeApplicationStatus(a.application_status);

			if (s === APPLICATION_STATUS.WAITING_DOCUMENTS) acc.waiting += 1;
			if (s === APPLICATION_STATUS.DOCUMENTS_UNDER_REVIEW) acc.review += 1;

			if (s === APPLICATION_STATUS.DOCUMENTS_NOT_APPROVED || s === APPLICATION_STATUS.VISA_ISSUE_ACTION_NEEDED) {
				acc.actionNeeded += 1;
			}

			if (s === APPLICATION_STATUS.VISA_APPROVED || s === APPLICATION_STATUS.FINISHED) {
				acc.completed += 1;
			}

			return acc;
		},
		{
			total: 0,
			waiting: 0,
			review: 0,
			actionNeeded: 0,
			completed: 0,
		},
	);

	const applicationStatusOrder = getApplicationStatusOrder();

	const statusOptions = [
		{ value: "all", label: tGlobal("Statuses.applications.all") },
		...applicationStatusOrder.map((s) => {
			const meta = getApplicationStatusMeta(s);
			return {
				value: s,
				label: tGlobal(`Statuses.applications.${meta.labelKey}` as any),
			};
		}),
	];

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
				<section className={styles.statsGrid}>
					<StatCard
						label={tAdmin("stats.total.label")}
						value={stats.total}
						help={tAdmin("stats.total.helpText")}
						tone="slate"
					/>
					<StatCard
						label={tAdmin("stats.waiting.label")}
						value={stats.waiting}
						help={tAdmin("stats.waiting.helpText")}
						tone="sky"
					/>
					<StatCard
						label={tAdmin("stats.review.label")}
						value={stats.review}
						help={tAdmin("stats.review.helpText")}
						tone="amber"
					/>
					<StatCard
						label={tAdmin("stats.actionNeeded.label")}
						value={stats.actionNeeded}
						help={tAdmin("stats.actionNeeded.helpText")}
						tone="rose"
					/>
					<StatCard
						label={tAdmin("stats.completed.label")}
						value={stats.completed}
						help={tAdmin("stats.completed.helpText")}
						tone="emerald"
					/>
				</section>

				<Panel
					title={tAdmin("list.title")}
					subtitle={tAdmin("list.subtitle")}
					actions={
						<FilterSelect
							action={siteConfig.adminApplicationsPath}
							label={tGlobal("Statuses.filter")}
							name="status"
							defaultValue={selectedStatus}
							options={statusOptions}
						/>
					}
				>
					{!hasApplications ? (
						<div className={styles.emptyState}>{tAdmin("list.empty")}</div>
					) : (
						<div className={styles.list}>
							{applications.map((a) => {
								const createdAt = safeDate(a.created_at);
								const updatedAt = safeDate(a.updated_at ?? a.created_at);

								const applicationStatus = normalizeApplicationStatus(a.application_status);
								const statusMeta = getApplicationStatusMeta(applicationStatus);

								const statusLabel = tGlobal(`Statuses.applications.${statusMeta.labelKey}` as any);

								const profile = profileByUserId.get(a.user_id) ?? null;

								const fullNameRaw = profile
									? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim()
									: "";

								const title =
									fullNameRaw.length > 0
										? fullNameRaw
										: tAdmin("list.unknownUserNameFallback", { userId: a.user_id });

								const visaTypeLabel = tGlobal(`visaTypes.${a.application_type}` as any);

								const destinationLabel =
									typeof a.destination === "string" && a.destination.trim().length > 0
										? tGlobal(`destinations.${a.destination}` as any)
										: tGlobal("Common.na");

								const subtitle = `${visaTypeLabel} · ${destinationLabel}`;

								const requiredTypes = requiredTypesByApp.get(a.id) ?? new Set<string>();
								const requiredCount = requiredTypes.size;

								let uploadedCount = 0;
								let approvedCount = 0;

								if (requiredCount > 0) {
									const byType = latestDocByAppType.get(a.id) ?? new Map<string, DocumentRowDb>();

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
										? tCases("header.docsSummary", {
												uploaded: uploadedCount,
												required: requiredCount,
												approved: approvedCount,
											})
										: null;

								return (
									<ApplicationRow
										key={a.id}
										href={siteConfig.adminApplicationDetailsHref(a.id)}
										title={title}
										subtitle={subtitle}
										createdAt={createdAt}
										updatedAt={updatedAt}
										applicationId={a.id}
										applicationIdLabel={tGlobal("ApplicationRow.applicationId")}
										docsSummary={docsSummary}
										statusLabel={statusLabel}
										statusTone={statusMeta.badgeTone}
										openLabel={tGlobal("Buttons.open")}
										createdLabel={tGlobal("CaseRow.created")}
										updatedLabel={tGlobal("CaseRow.updated")}
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
