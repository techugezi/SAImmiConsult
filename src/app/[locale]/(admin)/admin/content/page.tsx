/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/(admin)/admin/content/page.tsx
SCOPE: Admin Site Content (News + FAQ) maintenance page. Uses server actions + Supabase service role. Revalidates cached public reads.
STATUS: LOCKED
AUDITED:
- FIX: Server actions moved to ./actions.ts to satisfy Next.js route-module export constraints (prevents build type error).
- Gate: Enforces admin/consultant access via auth.getUser() + user_roles BEFORE any service-role client is used.
- Service role containment: Service role access is centralized server-side (never referenced inline).
- RLS posture: All reads/writes on site_news/site_faq are via service role ONLY after gate.
- Input normalization: Trims + bounds input sizes and normalizes slugs to URL-safe format.
- Publish safety: Requires BOTH locales for publish and blocks publish if incomplete.
- Cache invalidation: Server actions call revalidateTag(SITE_CONTENT_TAG) after any mutation so public pages refresh.
*/

export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/* Imports                                                                    */
/* -------------------------------------------------------------------------- */

import "server-only";

import * as React from "react";

import { unstable_noStore as noStore } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import {
	createServerSupabaseClient,
	createAdminSupabaseClient,
} from "@/lib/supabaseServer";

import { siteConfig } from "@/config/siteConfig";

/* -------------------------------------------------------------------------- */
/* Server actions (moved out of route module)                                 */
/* -------------------------------------------------------------------------- */

import {
	createNews,
	updateNews,
	deleteNews,
	createFaq,
	updateFaq,
	deleteFaq,
} from "./actions";

/* -------------------------------------------------------------------------- */
/* UI Components                                                              */
/* -------------------------------------------------------------------------- */

import { PageShell } from "@/components/ui/layout/PageShell";
import { MainColumn } from "@/components/ui/layout/MainColumn";
import { DisclosurePanel } from "@/components/ui/panel/DisclosurePanel";
import ConfirmSubmitButton from "@/components/ui/ConfirmSubmitButton";
import ContentPublishCheckboxGuard from "@/components/admin/ContentPublishCheckboxGuard";
import PendingSubmitButton from "@/components/ui/PendingSubmitButton";

import styles from "./content.module.css";

import type { CSSProperties } from "react";

/* -------------------------------------------------------------------------- */
/* Admin Supabase (Service Role)                                              */
/* -------------------------------------------------------------------------- */

function getAdminSupabase() {
	return createAdminSupabaseClient();
}

/* -------------------------------------------------------------------------- */
/* Logging Utilities                                                          */
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

/* -------------------------------------------------------------------------- */
/* Retry Wrapper (Transient Fetch Failures)                                   */
/* -------------------------------------------------------------------------- */

async function withRetry<T>(label: string, fn: () => Promise<T>) {
	let lastErr: unknown = null;

	for (let attempt = 1; attempt <= 3; attempt++) {
		try {
			return await fn();
		} catch (err) {
			lastErr = err;
			logPostgrestError(`${label} (attempt ${attempt})`, err);

			if (attempt < 3) {
				await new Promise((r) => setTimeout(r, 150 * attempt));
			}
		}
	}

	throw lastErr;
}

/* -------------------------------------------------------------------------- */
/* Auth Gate                                                                  */
/* -------------------------------------------------------------------------- */

async function assertAdminOrConsultantOrNotFound() {
	const sessionSupabase = await createServerSupabaseClient();

	const {
		data: { user },
		error,
	} = await withRetry("[AdminContent] auth.getUser", async () => {
		return await sessionSupabase.auth.getUser();
	});

	if (error) logPostgrestError("[AdminContent] auth.getUser error:", error);
	if (!user) redirect(siteConfig.loginPath);

	const { data: roleRow, error: roleError } = await withRetry(
		"[AdminContent] user_roles read",
		async () => {
			return await sessionSupabase
				.from("user_roles")
				.select("role")
				.eq("user_id", user.id)
				.maybeSingle();
		},
	);

	if (roleError) {
		logPostgrestError("[AdminContent] user_roles read error:", roleError);
		redirect(siteConfig.loginPath);
	}

	const role = (roleRow?.role ?? "").toString();
	const allowed = role === "admin" || role === "consultant";

	if (!allowed) {
		redirect(siteConfig.clientDashboardPath);
	}

	return { actorUserId: user.id, actorRole: role };
}

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type NewsRow = {
	id: string;
	slug: string;
	title_en: string;
	title_ru: string;
	summary_en: string;
	summary_ru: string;
	body_md_en: string;
	body_md_ru: string;
	is_published: boolean;
	published_at: string | null;
	pinned: boolean;
	created_at: string;
	updated_at: string;
};

type FaqRow = {
	id: string;
	question_en: string;
	question_ru: string;
	answer_md_en: string;
	answer_md_ru: string;
	sort_order: number;
	is_published: boolean;
	created_at: string;
	updated_at: string;
};

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

type ContentPageProps = {
	searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
};

function pickFirstParam(v: string | string[] | undefined) {
	if (!v) return "";
	return Array.isArray(v) ? (v[0] ?? "") : v;
}

const ADMIN_CONTENT_ERROR_PARAM = "err";
const ADMIN_CONTENT_ERR_PUBLISH_LOCALES = "publish_requires_both_locales";

export default async function AdminContentPage({ searchParams }: ContentPageProps) {
	noStore();

	await assertAdminOrConsultantOrNotFound();
	const supabase = getAdminSupabase();

	const uiLocale = await getLocale();
	const tAdmin = await getTranslations("AdminContent");
	const tGlobal = await getTranslations("GlobalForm");

	const resolvedSearchParams = searchParams ? await searchParams : {};
	const err = pickFirstParam(resolvedSearchParams?.[ADMIN_CONTENT_ERROR_PARAM]);

	const chevronLabel = tGlobal("Common.symbols.chevronDown");

	const { data: newsRows, error: newsErr } = await supabase
		.from("site_news")
		.select(
			"id,slug,title_en,title_ru,summary_en,summary_ru,body_md_en,body_md_ru,is_published,published_at,pinned,created_at,updated_at",
		)
		.order("pinned", { ascending: false })
		.order("published_at", { ascending: false })
		.order("created_at", { ascending: false });

	if (newsErr) logPostgrestError("[AdminContent] load news error:", newsErr);
	const news = (newsRows ?? []) as NewsRow[];

	const { data: faqRows, error: faqErr } = await supabase
		.from("site_faq")
		.select(
			"id,question_en,question_ru,answer_md_en,answer_md_ru,sort_order,is_published,created_at,updated_at",
		)
		.order("is_published", { ascending: false })
		.order("sort_order", { ascending: true })
		.order("created_at", { ascending: false });

	if (faqErr) logPostgrestError("[AdminContent] load faq error:", faqErr);
	const faqs = (faqRows ?? []) as FaqRow[];

	const fmt = new Intl.DateTimeFormat(uiLocale, {
		year: "numeric",
		month: "short",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});

	return (
		<PageShell>
			<header className="hero-shell">
				<div className="hero-inner">
					<p className="hero-title">{tAdmin("hero.title")}</p>
					<h1 className="hero-subtitle">{tAdmin("hero.subtitle")}</h1>
					<h2 className="hero-desc">{tAdmin("hero.description")}</h2>
				</div>
			</header>

			<MainColumn>
				<div className="stack">
					{/* ─────────────────────── News ─────────────────────── */}
					<DisclosurePanel
						id="panel-news"
						title={tAdmin("news.title")}
						subtitle={tAdmin("news.subtitle")}
						defaultOpen={false}
						chevronLabel={chevronLabel}
					>
						{err === ADMIN_CONTENT_ERR_PUBLISH_LOCALES ? (
							<div
								className="surface-soft"
								style={{
									padding: "var(--space-4)",
									borderRadius: "var(--radius-xl)",
								}}
							>
								<p className="text-sm text-bold" style={{ margin: 0 }}>
									{tAdmin("errors.publishRequiresBothLocales.title")}
								</p>
								<p className="text-sm text-muted" style={{ margin: "var(--space-1) 0 0" }}>
									{tAdmin("errors.publishRequiresBothLocales.body")}
								</p>
							</div>
						) : null}

						<div className="stack">
							<div className={`surface-soft ${styles.block}`}>
								<p className={`text-sm text-muted ${styles.blockHint}`}>{tAdmin("news.createHint")}</p>

								<form action={createNews} className={styles.form}>
									<input type="hidden" name="locale" value={uiLocale} />

									<div className={styles.grid}>
										<div className={styles.field}>
											<label className="form-label" htmlFor="news_title_en">
												{tAdmin("news.fields.titleEn")}
											</label>
											<input id="news_title_en" name="title_en" className="form-control" />
											<p className="text-sm text-muted" style={{ margin: 0 }}>
												{tAdmin("news.hints.title")}
											</p>
										</div>

										<div className={styles.field}>
											<label className="form-label" htmlFor="news_title_ru">
												{tAdmin("news.fields.titleRu")}
											</label>
											<input id="news_title_ru" name="title_ru" className="form-control" />
										</div>

										<div className={styles.field}>
											<label className="form-label" htmlFor="news_slug">
												{tAdmin("news.fields.slug")}
											</label>
											<input id="news_slug" name="slug" className="form-control" />
											<p className="text-sm text-muted" style={{ margin: 0 }}>
												{tAdmin("news.hints.slug")}
											</p>
										</div>

										<div className={styles.fieldFull}>
											<div className={styles.grid}>
												<div className={styles.field}>
													<label className="form-label" htmlFor="news_summary_en">
														{tAdmin("news.fields.summaryEn")}
													</label>
													<textarea id="news_summary_en" name="summary_en" className="form-control" rows={2} />
													<p className="text-sm text-muted" style={{ margin: 0 }}>
														{tAdmin("news.hints.summary")}
													</p>
												</div>

												<div className={styles.field}>
													<label className="form-label" htmlFor="news_summary_ru">
														{tAdmin("news.fields.summaryRu")}
													</label>
													<textarea id="news_summary_ru" name="summary_ru" className="form-control" rows={2} />
												</div>
											</div>
										</div>

										<div className={styles.fieldFull}>
											<div className={styles.grid}>
												<div className={styles.field}>
													<label className="form-label" htmlFor="news_body_en">
														{tAdmin("news.fields.bodyEn")}
													</label>
													<textarea id="news_body_en" name="body_md_en" className="form-control" rows={6} />
													<p className="text-sm text-muted" style={{ margin: 0 }}>
														{tAdmin("news.hints.body")}
													</p>
												</div>

												<div className={styles.field}>
													<label className="form-label" htmlFor="news_body_ru">
														{tAdmin("news.fields.bodyRu")}
													</label>
													<textarea id="news_body_ru" name="body_md_ru" className="form-control" rows={6} />
												</div>
											</div>
										</div>

										<div className={styles.fieldRow}>
											<div className="stack" style={{ "--stack-gap": "var(--space-1)" } as CSSProperties}>
												<label className={styles.inline}>
													<ContentPublishCheckboxGuard
														name="is_published"
														value="1"
														requiredNames={[
															"title_en",
															"title_ru",
															"summary_en",
															"summary_ru",
															"body_md_en",
															"body_md_ru",
														]}
													/>
													<span>{tAdmin("news.fields.publishNow")}</span>
												</label>
												<p className="text-sm text-muted" style={{ margin: 0 }}>
													{tAdmin("news.hints.publishNow")}
												</p>
											</div>

											<div className="stack" style={{ "--stack-gap": "var(--space-1)" } as CSSProperties}>
												<label className={styles.inline}>
													<input type="checkbox" name="pinned" value="1" />
													<span>{tAdmin("news.fields.pinned")}</span>
												</label>
												<p className="text-sm text-muted" style={{ margin: 0 }}>
													{tAdmin("news.hints.pinned")}
												</p>
											</div>
										</div>
									</div>

									<div className={styles.actions}>
										<PendingSubmitButton
											className="button button-primary"
											label={tAdmin("news.actions.create")}
											pendingLabel={tAdmin("news.actions.creating")}
										/>
									</div>
								</form>
							</div>

							{news.length === 0 ? (
								<div className={`surface-soft ${styles.block}`}>
									<p className="text-sm text-muted" style={{ margin: 0 }}>
										{tAdmin("news.empty")}
									</p>
								</div>
							) : (
								<div className="stack">
									{news.map((n) => {
										const displayTitle = uiLocale.startsWith("ru") ? n.title_ru : n.title_en;
										const publishedLabel =
											n.is_published && n.published_at
												? `${tAdmin("common.published")} ${fmt.format(new Date(n.published_at))}`
												: tAdmin("common.draft");

										return (
											<DisclosurePanel
												key={n.id}
												id={`news-${n.id}`}
												title={[n.title_en?.trim(), n.title_ru?.trim()]
													.filter((v) => typeof v === "string" && v.length > 0)
													.join(` ${tGlobal("Common.symbols.dot")} `)}
												subtitle={publishedLabel}
												chevronLabel={chevronLabel}
											>
												<div
													key={n.id}
													data-status={n.is_published ? "published" : "draft"}
													className={`surface-soft ${styles.block} ${styles.contentCard}`}
												>
													<div className={styles.rowHeader}>
														<div className={styles.rowTitle}>
															<div className={styles.titleLine}>
																<p className="text-md text-bold" style={{ margin: 0 }}>
																	{displayTitle}
																</p>

																<span className={`badge ${n.is_published ? "badge-success" : "badge-neutral"}`}>
																	{publishedLabel}
																</span>
															</div>

															<p className="text-sm text-muted" style={{ margin: 0 }}>
																{tAdmin("news.meta.slug")}: {n.slug}
																{n.pinned ? (
																	<>
																		{" "}
																		<span aria-hidden="true">{tGlobal("Common.symbols.dot")}</span>{" "}
																		{tAdmin("news.meta.pinned")}
																	</>
																) : null}
															</p>
														</div>

														<form id={`delete-news-${n.id}`} action={deleteNews}>
															<input type="hidden" name="locale" value={uiLocale} />
															<input type="hidden" name="id" value={n.id} />
														</form>

														<ConfirmSubmitButton
															formId={`delete-news-${n.id}`}
															className="button button-danger"
															label={tAdmin("common.delete")}
															deletingLabel={tAdmin("common.deleting")}
															confirmTitle={tGlobal("Confirm.title")}
															confirmBody={tAdmin("news.confirmDelete")}
															confirmCancelLabel={tGlobal("Confirm.cancel")}
															confirmContinueLabel={tGlobal("Confirm.continue")}
														/>
													</div>

													<form action={updateNews} className={styles.form}>
														<input type="hidden" name="locale" value={uiLocale} />
														<input type="hidden" name="id" value={n.id} />

														<div className={styles.grid}>
															<div className={styles.field}>
																<label className="form-label" htmlFor={`news_title_en_${n.id}`}>
																	{tAdmin("news.fields.titleEn")}
																</label>
																<input
																	id={`news_title_en_${n.id}`}
																	name="title_en"
																	defaultValue={n.title_en}
																	className="form-control"
																/>
															</div>

															<div className={styles.field}>
																<label className="form-label" htmlFor={`news_title_ru_${n.id}`}>
																	{tAdmin("news.fields.titleRu")}
																</label>
																<input
																	id={`news_title_ru_${n.id}`}
																	name="title_ru"
																	defaultValue={n.title_ru}
																	className="form-control"
																/>
															</div>

															<div className={styles.field}>
																<label className="form-label" htmlFor={`news_slug_${n.id}`}>
																	{tAdmin("news.fields.slug")}
																</label>
																<input
																	id={`news_slug_${n.id}`}
																	name="slug"
																	defaultValue={n.slug}
																	className="form-control"
																/>
															</div>

															<div className={styles.fieldFull}>
																<div className={styles.grid}>
																	<div className={styles.field}>
																		<label className="form-label" htmlFor={`news_summary_en_${n.id}`}>
																			{tAdmin("news.fields.summaryEn")}
																		</label>
																		<textarea
																			id={`news_summary_en_${n.id}`}
																			name="summary_en"
																			defaultValue={n.summary_en}
																			className="form-control"
																			rows={2}
																		/>
																	</div>

																	<div className={styles.field}>
																		<label className="form-label" htmlFor={`news_summary_ru_${n.id}`}>
																			{tAdmin("news.fields.summaryRu")}
																		</label>
																		<textarea
																			id={`news_summary_ru_${n.id}`}
																			name="summary_ru"
																			defaultValue={n.summary_ru}
																			className="form-control"
																			rows={2}
																		/>
																	</div>
																</div>
															</div>

															<div className={styles.fieldFull}>
																<div className={styles.grid}>
																	<div className={styles.field}>
																		<label className="form-label" htmlFor={`news_body_en_${n.id}`}>
																			{tAdmin("news.fields.bodyEn")}
																		</label>
																		<textarea
																			id={`news_body_en_${n.id}`}
																			name="body_md_en"
																			defaultValue={n.body_md_en}
																			className="form-control"
																			rows={6}
																		/>
																	</div>

																	<div className={styles.field}>
																		<label className="form-label" htmlFor={`news_body_ru_${n.id}`}>
																			{tAdmin("news.fields.bodyRu")}
																		</label>
																		<textarea
																			id={`news_body_ru_${n.id}`}
																			name="body_md_ru"
																			defaultValue={n.body_md_ru}
																			className="form-control"
																			rows={6}
																		/>
																	</div>
																</div>
															</div>

															<div className={styles.fieldRow}>
																<label className={styles.inline}>
																	<ContentPublishCheckboxGuard
																		name="is_published"
																		value="1"
																		defaultChecked={n.is_published}
																		requiredNames={[
																			"title_en",
																			"title_ru",
																			"summary_en",
																			"summary_ru",
																			"body_md_en",
																			"body_md_ru",
																		]}
																	/>
																	<span>{tAdmin("news.fields.published")}</span>
																</label>

																<label className={styles.inline}>
																	<input
																		type="checkbox"
																		name="pinned"
																		value="1"
																		defaultChecked={n.pinned}
																	/>
																	<span>{tAdmin("news.fields.pinned")}</span>
																</label>
															</div>
														</div>

														<div className={styles.actions}>
															<PendingSubmitButton
																className="button button-secondary"
																label={tGlobal("Buttons.save")}
																pendingLabel={tGlobal("Buttons.saving")}
															/>
														</div>
													</form>
												</div>
											</DisclosurePanel>
										);
									})}
								</div>
							)}
						</div>
					</DisclosurePanel>

					{/* ─────────────────────── FAQ ─────────────────────── */}
					<DisclosurePanel
						id="panel-faq"
						title={tAdmin("faq.title")}
						subtitle={tAdmin("faq.subtitle")}
						defaultOpen={false}
						chevronLabel={chevronLabel}
					>
						<div className="stack">
							<div className={`surface-soft ${styles.block}`}>
								<p className={`text-sm text-muted ${styles.blockHint}`}>{tAdmin("faq.createHint")}</p>

								<form action={createFaq} className={styles.form}>
									<input type="hidden" name="locale" value={uiLocale} />

									<div className={styles.grid}>
										<div className={styles.field}>
											<label className="form-label" htmlFor="faq_question_en">
												{tAdmin("faq.fields.questionEn")}
											</label>
											<input id="faq_question_en" name="question_en" className="form-control" />
											<p className="text-sm text-muted" style={{ margin: 0 }}>
												{tAdmin("faq.hints.question")}
											</p>
										</div>

										<div className={styles.field}>
											<label className="form-label" htmlFor="faq_question_ru">
												{tAdmin("faq.fields.questionRu")}
											</label>
											<input id="faq_question_ru" name="question_ru" className="form-control" />
										</div>

										<div className={styles.fieldFull}>
											<div className={styles.grid}>
												<div className={styles.field}>
													<label className="form-label" htmlFor="faq_answer_en">
														{tAdmin("faq.fields.answerEn")}
													</label>
													<textarea id="faq_answer_en" name="answer_md_en" className="form-control" rows={5} />
													<p className="text-sm text-muted" style={{ margin: 0 }}>
														{tAdmin("faq.hints.answer")}
													</p>
												</div>

												<div className={styles.field}>
													<label className="form-label" htmlFor="faq_answer_ru">
														{tAdmin("faq.fields.answerRu")}
													</label>
													<textarea id="faq_answer_ru" name="answer_md_ru" className="form-control" rows={5} />
												</div>
											</div>
										</div>

										<div className={styles.fieldRow}>
											<div className={styles.smallField}>
												<label className="form-label" htmlFor="faq_sort">
													{tAdmin("faq.fields.sortOrder")}
												</label>
												<input id="faq_sort" name="sort_order" className="form-control" defaultValue="100" />
												<p className="text-sm text-muted" style={{ margin: 0 }}>
													{tAdmin("faq.hints.sortOrder")}
												</p>
											</div>

											<div className="stack" style={{ "--stack-gap": "var(--space-1)" } as CSSProperties}>
												<label className={styles.inline}>
													<ContentPublishCheckboxGuard
														name="is_published"
														value="1"
														defaultChecked={true}
														requiredNames={["question_en", "question_ru", "answer_md_en", "answer_md_ru"]}
													/>
													<span>{tAdmin("faq.fields.published")}</span>
												</label>
												<p className="text-sm text-muted" style={{ margin: 0 }}>
													{tAdmin("faq.hints.published")}
												</p>
											</div>
										</div>
									</div>

									<div className={styles.actions}>
										<PendingSubmitButton
											className="button button-primary"
											label={tAdmin("faq.actions.create")}
											pendingLabel={tAdmin("faq.actions.creating")}
										/>
									</div>
								</form>
							</div>

							{faqs.length === 0 ? (
								<div className={`surface-soft ${styles.block}`}>
									<p className="text-sm text-muted" style={{ margin: 0 }}>
										{tAdmin("faq.empty")}
									</p>
								</div>
							) : (
								<div className="stack">
									{faqs.map((f) => {
										const displayQ = uiLocale.startsWith("ru") ? f.question_ru : f.question_en;
										const publishedLabel = f.is_published ? tAdmin("common.published") : tAdmin("common.draft");

										return (
											<DisclosurePanel
												key={f.id}
												id={`faq-${f.id}`}
												title={[f.question_en?.trim(), f.question_ru?.trim()]
													.filter((v) => typeof v === "string" && v.length > 0)
													.join(` ${tGlobal("Common.symbols.dot")} `)}
												subtitle={publishedLabel}
												chevronLabel={chevronLabel}
											>
												<div
													key={f.id}
													data-status={f.is_published ? "published" : "draft"}
													className={`surface-soft ${styles.block} ${styles.contentCard}`}
												>
													<div className={styles.rowHeader}>
														<div className={styles.rowTitle}>
															<div className={styles.titleLine}>
																<p className="text-md text-bold" style={{ margin: 0 }}>
																	{displayQ}
																</p>

																<span className={`badge ${f.is_published ? "badge-success" : "badge-neutral"}`}>
																	{publishedLabel}
																</span>
															</div>

															<p className="text-sm text-muted" style={{ margin: 0 }}>
																{tAdmin("faq.meta.order")}: {f.sort_order}
															</p>
														</div>

														<form id={`delete-faq-${f.id}`} action={deleteFaq}>
															<input type="hidden" name="locale" value={uiLocale} />
															<input type="hidden" name="id" value={f.id} />
														</form>

														<ConfirmSubmitButton
															formId={`delete-faq-${f.id}`}
															className="button button-danger"
															label={tAdmin("common.delete")}
															deletingLabel={tAdmin("common.deleting")}
															confirmTitle={tGlobal("Confirm.title")}
															confirmBody={tAdmin("faq.confirmDelete")}
															confirmCancelLabel={tGlobal("Confirm.cancel")}
															confirmContinueLabel={tGlobal("Confirm.continue")}
														/>
													</div>

													<form action={updateFaq} className={styles.form}>
														<input type="hidden" name="locale" value={uiLocale} />
														<input type="hidden" name="id" value={f.id} />

														<div className={styles.grid}>
															<div className={styles.field}>
																<label className="form-label" htmlFor={`faq_question_en_${f.id}`}>
																	{tAdmin("faq.fields.questionEn")}
																</label>
																<input
																	id={`faq_question_en_${f.id}`}
																	name="question_en"
																	defaultValue={f.question_en}
																	className="form-control"
																/>
															</div>

															<div className={styles.field}>
																<label className="form-label" htmlFor={`faq_question_ru_${f.id}`}>
																	{tAdmin("faq.fields.questionRu")}
																</label>
																<input
																	id={`faq_question_ru_${f.id}`}
																	name="question_ru"
																	defaultValue={f.question_ru}
																	className="form-control"
																/>
															</div>

															<div className={styles.fieldFull}>
																<div className={styles.grid}>
																	<div className={styles.field}>
																		<label className="form-label" htmlFor={`faq_answer_en_${f.id}`}>
																			{tAdmin("faq.fields.answerEn")}
																		</label>
																		<textarea
																			id={`faq_answer_en_${f.id}`}
																			name="answer_md_en"
																			defaultValue={f.answer_md_en}
																			className="form-control"
																			rows={5}
																		/>
																	</div>

																	<div className={styles.field}>
																		<label className="form-label" htmlFor={`faq_answer_ru_${f.id}`}>
																			{tAdmin("faq.fields.answerRu")}
																		</label>
																		<textarea
																			id={`faq_answer_ru_${f.id}`}
																			name="answer_md_ru"
																			defaultValue={f.answer_md_ru}
																			className="form-control"
																			rows={5}
																		/>
																	</div>
																</div>
															</div>

															<div className={styles.fieldRow}>
																<div className={styles.smallField}>
																	<label className="form-label" htmlFor={`faq_sort_${f.id}`}>
																		{tAdmin("faq.fields.sortOrder")}
																	</label>
																	<input
																		id={`faq_sort_${f.id}`}
																		name="sort_order"
																		defaultValue={String(f.sort_order)}
																		className="form-control"
																	/>
																</div>

																<label className={styles.inline}>
																	<ContentPublishCheckboxGuard
																		name="is_published"
																		value="1"
																		defaultChecked={f.is_published}
																		requiredNames={["question_en", "question_ru", "answer_md_en", "answer_md_ru"]}
																	/>
																	<span>{tAdmin("faq.fields.published")}</span>
																</label>
															</div>
														</div>

														<div className={styles.actions}>
															<PendingSubmitButton
																className="button button-secondary"
																label={tGlobal("Buttons.save")}
																pendingLabel={tGlobal("Buttons.saving")}
															/>
														</div>
													</form>
												</div>
											</DisclosurePanel>
										);
									})}
								</div>
							)}
						</div>
					</DisclosurePanel>
				</div>
			</MainColumn>
		</PageShell>
	);
}
