/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/(admin)/admin/clientprofiles/page.tsx
SCOPE: Admin client profiles list page. Data fetch + composition only (no UI primitives redefined here).
STATUS: LOCKED
AUDITED:
- Gate: Enforces admin-only access via auth.getUser() + user_roles before rendering page data.
- RLS: Uses createServerSupabaseClient() (RLS applies); no service-role usage in this route.
- Query safety: Normalizes query params (q/sort) and applies server-side filtering + ordering + limit.
- Data exposure: Selects only required profile fields for list display (no sensitive/private expansions).
- Rendering safety: Fixes invalid JSX-style comment used in TS scope inside map() (compile-time bug).
NOTES:
- No translation keys were changed.
- No business logic changes were made (only a compile-time bug fix).
*/

export const dynamic = "force-dynamic";

import "server-only";

import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { unstable_noStore as noStore } from "next/cache";
import { Link } from "@/i18n/navigation";

import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { siteConfig } from "@/config/siteConfig";

import { PageShell } from "@/components/ui/layout/PageShell";
import { MainColumn } from "@/components/ui/layout/MainColumn";
import { Panel } from "@/components/ui/panel/Panel";

import SearchField from "@/components/ui/SearchField/SearchField";

import styles from "./clientprofiles.module.css";

type PageProps = {
	params: Promise<{ locale: string }>;
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

type ClientProfileRow = {
	user_id: string;
	first_name: string;
	middle_name: string | null;
	last_name: string;
	date_of_birth: string | null;

	citizenship_country: string | null;
	current_location: string | null;
	//current_visa_status: string | null;

	phone_country_code: string | null;
	phone_number: string | null;

	whatsapp_country_code: string | null;
	whatsapp_number: string | null;

	passport_expiry: string | null;

	visit_purpose: string | null;
	immigration_goal: string | null;

	updated_at: string;
};

type SortMode = "last_asc" | "last_desc";

function normalizeSearchParam(value: string | string[] | undefined, fallback = ""): string {
	if (!value) return fallback;
	if (Array.isArray(value)) return value[0] ?? fallback;
	return value;
}

function humanize(value: string) {
	const cleaned = value.replace(/[_-]+/g, " ").trim();
	if (!cleaned) return "";
	return cleaned
		.split(/\s+/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join(" ");
}

function formatPhone(code: string | null, num: string | null) {
	const c = (code || "").trim();
	const n = (num || "").trim();
	if (!c && !n) return "";
	if (c && n) return `${c}${n}`;
	return c || n;
}

function safeDate(value: string | null | undefined) {
	if (!value) return null;
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return null;
	return d;
}

function buildHref({ q, sort }: { q?: string; sort?: SortMode }) {
	// Keep URL clean: omit empty params
	const query: Record<string, string> = {};
	const qq = (q || "").trim();
	if (qq) query.q = qq;
	if (sort) query.sort = sort;

	return Object.keys(query).length === 0
		? { pathname: "/admin/clientprofiles" as const }
		: { pathname: "/admin/clientprofiles" as const, query };
}

export default async function AdminClientProfilesPage({ params, searchParams }: PageProps) {
	noStore();

	await params;
	const resolvedSearchParams = await searchParams;

	const t = await getTranslations("AdminClientProfiles");
	const tGlobal = await getTranslations("GlobalForm");
	const locale = await getLocale();

	const supabase = await createServerSupabaseClient();

	// 1) Auth
	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();

	if (!user || userError) {
		return redirect(siteConfig.loginPath);
	}

	// 2) Ensure admin
	const { data: roleRow, error: roleError } = await supabase
		.from("user_roles")
		.select("role")
		.eq("user_id", user.id)
		.single();

	if (roleError || !roleRow || roleRow.role !== "admin") {
		return redirect(siteConfig.clientDashboardPath);
	}

	// 3) Read filters from URL (same principle as admin/applications)
	const qRaw = normalizeSearchParam(resolvedSearchParams.q, "");
	const q = qRaw.trim();

	const sortParam = normalizeSearchParam(resolvedSearchParams.sort, "last_asc");
	const sort: SortMode = sortParam === "last_desc" ? "last_desc" : "last_asc";

	const ascending = sort === "last_asc";

	const fmtShort = new Intl.DateTimeFormat(locale, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});

	// 4) Build query (server-side filtering)
	let queryBuilder = supabase
		.from("client_profiles")
		.select(
			[
				"user_id",
				"first_name",
				"middle_name",
				"last_name",
				"date_of_birth",
				"citizenship_country",
				"current_location",
				//"current_visa_status",
				"phone_country_code",
				"phone_number",
				"whatsapp_country_code",
				"whatsapp_number",
				"passport_expiry",
				"visit_purpose",
				"immigration_goal",
				"updated_at",
			].join(","),
		)
		.order("last_name", { ascending })
		.order("first_name", { ascending: true })
		.limit(500);

	if (q) {
		// Search first OR last name (case-insensitive)
		const like = `%${q}%`;
		queryBuilder = queryBuilder.or(`first_name.ilike.${like},last_name.ilike.${like}`);
	}

	const { data, error } = await queryBuilder.returns<ClientProfileRow[]>();
	
	if (error) {
		console.error("[AdminClientProfilesPage] Error loading client_profiles", { error });
	}
	
	const clients: ClientProfileRow[] = data ?? [];
	

	return (
		<PageShell>
			<header className="hero-shell">
				<div className="hero-inner">
					<p className="hero-title">{t("eyebrow")}</p>
					<h1 className="hero-subtitle">{t("title")}</h1>
					<p className="hero-desc">{t("subtitle")}</p>
				</div>
			</header>

			<MainColumn>
				<div className={styles.mainInner}>
					<Panel
						title={t("panel.title")}
						subtitle={q ? t("panel.subtitleWithQuery", { q }) : t("panel.subtitle")}
						actions={
							<div className={styles.panelActions} aria-label={t("filters.label")}>
								<div className={styles.panelSort}>
									<span className="form-label">{t("filters.sortLabel")}</span>

									<div className={styles.filterChips}>
										<Link
											href={buildHref({ q, sort: "last_asc" })}
											className={`button ${sort === "last_asc" ? "button-primary" : "button-ghost"} ${styles.chip}`}
										>
											{t("filters.lastAsc")}
										</Link>

										<Link
											href={buildHref({ q, sort: "last_desc" })}
											className={`button ${sort === "last_desc" ? "button-primary" : "button-ghost"} ${styles.chip}`}
										>
											{t("filters.lastDesc")}
										</Link>
									</div>
								</div>

								<SearchField
									action={siteConfig.adminClientProfilesPath}
									name="q"
									defaultValue={q}
									hiddenFields={[{ name: "sort", value: sort }]}
									clearHref={buildHref({ sort })}
									srLabel={t("filters.searchLabel")}
									placeholder={t("filters.searchPlaceholder")}
									clearLabel={t("filters.clearButton")}
									searchLabel={t("filters.searchButton")}
								/>
								
							</div>
						}
					>
						{clients.length === 0 ? (
							<div className={styles.emptyState}>{t("empty")}</div>
						) : (
							<div className={styles.list} role="list">
								{clients.map((c) => {
									const fullName = [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(" ");

									const citizenship = c.citizenship_country ? humanize(c.citizenship_country) : "";
									const location = c.current_location ? humanize(c.current_location) : "";
									// const visaStatus = (c.current_visa_status || "").trim();

									const dob = safeDate(c.date_of_birth);
									const dobLabel = dob ? fmtShort.format(dob) : "";

									const phone = formatPhone(c.phone_country_code, c.phone_number);
									const whatsapp = formatPhone(c.whatsapp_country_code, c.whatsapp_number);

									const passportExpiry = safeDate(c.passport_expiry);
									const passportExpiryLabel = passportExpiry ? fmtShort.format(passportExpiry) : "";

									const intent = (c.visit_purpose || c.immigration_goal || "").trim();

									return (
										<Link
											key={c.user_id}
											href={siteConfig.adminClientProfileDetailsHref(c.user_id)}
											className={`row-hover-tint ${styles.rowLink}`}
										>
											<div className={`${styles.rowInner} row-hover-tint__inner`} role="listitem">
												<div className={styles.rowMain}>
													<h3 className={`case-row-name ${styles.rowName}`} title={fullName}>
														{fullName}
													</h3>

													<dl className={styles.metaGrid}>
														{citizenship ? (
															<div className={styles.metaItem}>
																<dt className="form-label">{t("fields.citizenship")}</dt>
																<dd className={styles.metaValue}>{citizenship}</dd>
															</div>
														) : null}

														{dobLabel ? (
															<div className={styles.metaItem}>
																<dt className="form-label">{t("fields.dob")}</dt>
																<dd className={styles.metaValue}>{dobLabel}</dd>
															</div>
														) : null}

														{location ? (
															<div className={styles.metaItem}>
																<dt className="form-label">{t("fields.location")}</dt>
																<dd className={styles.metaValue}>{location}</dd>
															</div>
														) : null}

														{/*{visaStatus ? (
															<div className={styles.metaItem}>
																<dt className="form-label">{t("fields.visaStatus")}</dt>
																<dd className={styles.metaValue}>{visaStatus}</dd>
															</div>
														) : null}*/}

														{passportExpiryLabel ? (
															<div className={styles.metaItem}>
																<dt className="form-label">{t("fields.passportExpiry")}</dt>
																<dd className={styles.metaValue}>{passportExpiryLabel}</dd>
															</div>
														) : null}

														{phone ? (
															<div className={styles.metaItem}>
																<dt className="form-label">{t("fields.phone")}</dt>
																<dd className={styles.metaValue}>{phone}</dd>
															</div>
														) : null}

														{whatsapp ? (
															<div className={styles.metaItem}>
																<dt className="form-label">{t("fields.whatsapp")}</dt>
																<dd className={styles.metaValue}>{whatsapp}</dd>
															</div>
														) : null}
													</dl>

													{intent ? (
														<p className={`text-sm text-muted ${styles.intentLine}`}>
															<span className="form-label">{t("fields.intent")}:</span>{" "}
															<span className={styles.intentValue}>{intent}</span>
														</p>
													) : null}
												</div>

												<div className={styles.rowSide} aria-hidden="true">
													<span className={`button button-ghost ${styles.rowCTA}`}>
														<span>{t("actions.view")}</span>
														<span className={styles.arrow}>{tGlobal("Common.symbols.arrowRight")}</span>
													</span>
												</div>
											</div>
										</Link>
									);
								})}
							</div>
						)}
					</Panel>
				</div>
			</MainColumn>
		</PageShell>
	);
}
