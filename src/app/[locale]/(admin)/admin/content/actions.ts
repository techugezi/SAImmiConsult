/*
DOC NAME: actions.ts
LOCATION: /src/app/[locale]/(admin)/admin/content/actions.ts
SCOPE: Server actions for Admin Site Content (News + FAQ). Server-only. Revalidates cached public reads.
STATUS: LOCKED
*/

import "server-only";

import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import {
	createServerSupabaseClient,
	createAdminSupabaseClient,
} from "@/lib/supabaseServer";

import { siteConfig } from "@/config/siteConfig";

/* -------------------------------------------------------------------------- */
/* Cache tagging (public pages should fetch with this tag)                    */
/* -------------------------------------------------------------------------- */

export const SITE_CONTENT_TAG = "site-content";

export const ADMIN_CONTENT_ERROR_PARAM = "err";
export const ADMIN_CONTENT_ERR_PUBLISH_LOCALES = "publish_requires_both_locales";

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
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function normalizeSlug(input: string) {
	const s = input.trim().toLowerCase();
	const cleaned = s
		.replace(/['"]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");

	return cleaned.length > 0 ? cleaned : `post-${Date.now()}`;
}

function withSlugSuffix(baseSlug: string, attempt: number) {
	if (attempt <= 1) return baseSlug;
	return `${baseSlug}-${attempt}`;
}

function isUniqueSlugViolation(err: unknown) {
	const e: any = err;
	return (
		e?.code === "23505" &&
		typeof e?.message === "string" &&
		e.message.includes("site_news_slug_ux")
	);
}

function requireBothLocalesForPublish(en: string, ru: string) {
	return en.trim().length > 0 && ru.trim().length > 0;
}

/* -------------------------------------------------------------------------- */
/* Server actions: News                                                       */
/* -------------------------------------------------------------------------- */

export async function createNews(formData: FormData) {
	"use server";

	await assertAdminOrConsultantOrNotFound();
	const supabase = getAdminSupabase();

	const locale = (formData.get("locale") || "en").toString();

	const titleEnRaw =
		typeof formData.get("title_en") === "string" ? (formData.get("title_en") as string) : "";
	const titleRuRaw =
		typeof formData.get("title_ru") === "string" ? (formData.get("title_ru") as string) : "";
	const summaryEnRaw =
		typeof formData.get("summary_en") === "string" ? (formData.get("summary_en") as string) : "";
	const summaryRuRaw =
		typeof formData.get("summary_ru") === "string" ? (formData.get("summary_ru") as string) : "";
	const bodyEnRaw =
		typeof formData.get("body_md_en") === "string" ? (formData.get("body_md_en") as string) : "";
	const bodyRuRaw =
		typeof formData.get("body_md_ru") === "string" ? (formData.get("body_md_ru") as string) : "";

	const slugRaw = typeof formData.get("slug") === "string" ? (formData.get("slug") as string) : "";
	const publishRaw =
		typeof formData.get("is_published") === "string" ? (formData.get("is_published") as string) : "";
	const pinnedRaw = typeof formData.get("pinned") === "string" ? (formData.get("pinned") as string) : "";

	const title_en = titleEnRaw.trim().slice(0, 160);
	const title_ru = titleRuRaw.trim().slice(0, 160);
	const summary_en = summaryEnRaw.trim().slice(0, 400);
	const summary_ru = summaryRuRaw.trim().slice(0, 400);
	const body_md_en = bodyEnRaw.trim().slice(0, 20000);
	const body_md_ru = bodyRuRaw.trim().slice(0, 20000);

	const slug = normalizeSlug(slugRaw.length > 0 ? slugRaw : title_en);

	const is_published = publishRaw === "1";
	const pinned = pinnedRaw === "1";

	if (is_published) {
		const ok =
			requireBothLocalesForPublish(title_en, title_ru) &&
			requireBothLocalesForPublish(summary_en, summary_ru) &&
			requireBothLocalesForPublish(body_md_en, body_md_ru);

		if (!ok) {
			redirect(
				`/${locale}${siteConfig.adminContentPath}?${ADMIN_CONTENT_ERROR_PARAM}=${ADMIN_CONTENT_ERR_PUBLISH_LOCALES}`,
			);
		}
	}

	const published_at = null;

	const baseSlug = slug;
	let lastError: unknown = null;

	for (let attempt = 1; attempt <= 8; attempt++) {
		const nextSlug = withSlugSuffix(baseSlug, attempt);

		const { error } = await supabase.from("site_news").insert({
			slug: nextSlug,
			title_en,
			title_ru,
			summary_en,
			summary_ru,
			body_md_en,
			body_md_ru,
			is_published,
			published_at,
			pinned,
		});

		if (!error) {
			lastError = null;
			break;
		}

		lastError = error;

		if (!isUniqueSlugViolation(error)) {
			break;
		}
	}

	if (lastError) {
		logPostgrestError("[AdminContent] createNews error:", lastError);
		throw new Error("Failed to create news.");
	}

	revalidateTag(SITE_CONTENT_TAG, "max");
	return;
}

export async function updateNews(formData: FormData) {
	"use server";

	await assertAdminOrConsultantOrNotFound();
	const supabase = getAdminSupabase();

	const locale = (formData.get("locale") || "en").toString();

	const id = typeof formData.get("id") === "string" ? (formData.get("id") as string).trim() : "";
	if (id.length === 0) redirect(`/${locale}${siteConfig.adminContentPath}`);

	const titleEnRaw =
		typeof formData.get("title_en") === "string" ? (formData.get("title_en") as string) : "";
	const titleRuRaw =
		typeof formData.get("title_ru") === "string" ? (formData.get("title_ru") as string) : "";
	const summaryEnRaw =
		typeof formData.get("summary_en") === "string" ? (formData.get("summary_en") as string) : "";
	const summaryRuRaw =
		typeof formData.get("summary_ru") === "string" ? (formData.get("summary_ru") as string) : "";
	const bodyEnRaw =
		typeof formData.get("body_md_en") === "string" ? (formData.get("body_md_en") as string) : "";
	const bodyRuRaw =
		typeof formData.get("body_md_ru") === "string" ? (formData.get("body_md_ru") as string) : "";

	const slugRaw = typeof formData.get("slug") === "string" ? (formData.get("slug") as string) : "";
	const publishRaw =
		typeof formData.get("is_published") === "string" ? (formData.get("is_published") as string) : "";
	const pinnedRaw = typeof formData.get("pinned") === "string" ? (formData.get("pinned") as string) : "";

	const title_en = titleEnRaw.trim().slice(0, 160);
	const title_ru = titleRuRaw.trim().slice(0, 160);
	const summary_en = summaryEnRaw.trim().slice(0, 400);
	const summary_ru = summaryRuRaw.trim().slice(0, 400);
	const body_md_en = bodyEnRaw.trim().slice(0, 20000);
	const body_md_ru = bodyRuRaw.trim().slice(0, 20000);

	const slug = normalizeSlug(slugRaw.length > 0 ? slugRaw : title_en);

	const is_published = publishRaw === "1";
	const pinned = pinnedRaw === "1";

	if (is_published) {
		const ok =
			requireBothLocalesForPublish(title_en, title_ru) &&
			requireBothLocalesForPublish(summary_en, summary_ru) &&
			requireBothLocalesForPublish(body_md_en, body_md_ru);

		if (!ok) {
			redirect(
				`/${locale}${siteConfig.adminContentPath}?${ADMIN_CONTENT_ERROR_PARAM}=${ADMIN_CONTENT_ERR_PUBLISH_LOCALES}`,
			);
		}
	}

	const { data: existing, error: loadErr } = await supabase
		.from("site_news")
		.select("is_published,published_at")
		.eq("id", id)
		.maybeSingle();

	if (loadErr || !existing) {
		logPostgrestError("[AdminContent] updateNews load error:", loadErr);
		redirect(`/${locale}${siteConfig.adminContentPath}`);
	}

	const published_at = is_published ? (existing.published_at ?? null) : null;

	const { error } = await supabase
		.from("site_news")
		.update({
			slug,
			title_en,
			title_ru,
			summary_en,
			summary_ru,
			body_md_en,
			body_md_ru,
			is_published,
			published_at: is_published ? published_at : null,
			pinned,
		})
		.eq("id", id);

	if (error) {
		logPostgrestError("[AdminContent] updateNews error:", error);
		throw new Error("Failed to update news.");
	}

	revalidateTag(SITE_CONTENT_TAG, "max");
	return;
}

export async function deleteNews(formData: FormData) {
	"use server";

	await assertAdminOrConsultantOrNotFound();
	const supabase = getAdminSupabase();

	const locale = (formData.get("locale") || "en").toString();
	const id = typeof formData.get("id") === "string" ? (formData.get("id") as string).trim() : "";
	if (id.length === 0) redirect(`/${locale}${siteConfig.adminContentPath}`);

	const { error } = await supabase.from("site_news").delete().eq("id", id);

	if (error) {
		logPostgrestError("[AdminContent] deleteNews error:", error);
		throw new Error("Failed to delete news.");
	}

	revalidateTag(SITE_CONTENT_TAG, "max");
	return;
}

/* -------------------------------------------------------------------------- */
/* Server actions: FAQ                                                        */
/* -------------------------------------------------------------------------- */

export async function createFaq(formData: FormData) {
	"use server";

	await assertAdminOrConsultantOrNotFound();
	const supabase = getAdminSupabase();

	const locale = (formData.get("locale") || "en").toString();

	const qEnRaw =
		typeof formData.get("question_en") === "string" ? (formData.get("question_en") as string) : "";
	const qRuRaw =
		typeof formData.get("question_ru") === "string" ? (formData.get("question_ru") as string) : "";
	const aEnRaw =
		typeof formData.get("answer_md_en") === "string" ? (formData.get("answer_md_en") as string) : "";
	const aRuRaw =
		typeof formData.get("answer_md_ru") === "string" ? (formData.get("answer_md_ru") as string) : "";

	const sortRaw = typeof formData.get("sort_order") === "string" ? (formData.get("sort_order") as string) : "0";

	const is_published = formData.get("is_published") === "1";

	const question_en = qEnRaw.trim().slice(0, 240);
	const question_ru = qRuRaw.trim().slice(0, 240);
	const answer_md_en = aEnRaw.trim().slice(0, 20000);
	const answer_md_ru = aRuRaw.trim().slice(0, 20000);

	const sort_order = Number.isFinite(Number(sortRaw)) ? Number(sortRaw) : 0;

	if (is_published) {
		const ok =
			requireBothLocalesForPublish(question_en, question_ru) &&
			requireBothLocalesForPublish(answer_md_en, answer_md_ru);

		if (!ok) {
			redirect(
				`/${locale}${siteConfig.adminContentPath}?${ADMIN_CONTENT_ERROR_PARAM}=${ADMIN_CONTENT_ERR_PUBLISH_LOCALES}`,
			);
		}
	}

	const { error } = await supabase.from("site_faq").insert({
		question_en,
		question_ru,
		answer_md_en,
		answer_md_ru,
		sort_order,
		is_published,
	});

	if (error) {
		logPostgrestError("[AdminContent] createFaq error:", error);
		throw new Error("Failed to create FAQ.");
	}

	revalidateTag(SITE_CONTENT_TAG, "max");
	return;
}

export async function updateFaq(formData: FormData) {
	"use server";

	await assertAdminOrConsultantOrNotFound();
	const supabase = getAdminSupabase();

	const locale = (formData.get("locale") || "en").toString();

	const id = typeof formData.get("id") === "string" ? (formData.get("id") as string).trim() : "";
	if (id.length === 0) redirect(`/${locale}${siteConfig.adminContentPath}`);

	const qEnRaw =
		typeof formData.get("question_en") === "string" ? (formData.get("question_en") as string) : "";
	const qRuRaw =
		typeof formData.get("question_ru") === "string" ? (formData.get("question_ru") as string) : "";
	const aEnRaw =
		typeof formData.get("answer_md_en") === "string" ? (formData.get("answer_md_en") as string) : "";
	const aRuRaw =
		typeof formData.get("answer_md_ru") === "string" ? (formData.get("answer_md_ru") as string) : "";

	const sortRaw = typeof formData.get("sort_order") === "string" ? (formData.get("sort_order") as string) : "0";

	const is_published = formData.get("is_published") === "1";

	const question_en = qEnRaw.trim().slice(0, 240);
	const question_ru = qRuRaw.trim().slice(0, 240);
	const answer_md_en = aEnRaw.trim().slice(0, 20000);
	const answer_md_ru = aRuRaw.trim().slice(0, 20000);

	const sort_order = Number.isFinite(Number(sortRaw)) ? Number(sortRaw) : 0;

	if (is_published) {
		const ok =
			requireBothLocalesForPublish(question_en, question_ru) &&
			requireBothLocalesForPublish(answer_md_en, answer_md_ru);

		if (!ok) {
			redirect(
				`/${locale}${siteConfig.adminContentPath}?${ADMIN_CONTENT_ERROR_PARAM}=${ADMIN_CONTENT_ERR_PUBLISH_LOCALES}`,
			);
		}
	}

	const { error } = await supabase
		.from("site_faq")
		.update({
			question_en,
			question_ru,
			answer_md_en,
			answer_md_ru,
			sort_order,
			is_published,
		})
		.eq("id", id);

	if (error) {
		logPostgrestError("[AdminContent] updateFaq error:", error);
		throw new Error("Failed to update FAQ.");
	}

	revalidateTag(SITE_CONTENT_TAG, "max");
	return;
}

export async function deleteFaq(formData: FormData) {
	"use server";

	await assertAdminOrConsultantOrNotFound();
	const supabase = getAdminSupabase();

	const locale = (formData.get("locale") || "en").toString();
	const id = typeof formData.get("id") === "string" ? (formData.get("id") as string).trim() : "";
	if (id.length === 0) redirect(`/${locale}${siteConfig.adminContentPath}`);

	const { error } = await supabase.from("site_faq").delete().eq("id", id);

	if (error) {
		logPostgrestError("[AdminContent] deleteFaq error:", error);
		throw new Error("Failed to delete FAQ.");
	}

	revalidateTag(SITE_CONTENT_TAG, "max");
	return;
}
