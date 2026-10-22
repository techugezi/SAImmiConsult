/*
DOC NAME: siteContent.ts
LOCATION: /src/lib/siteContent.ts
SCOPE: Server-only cached reads for public site content (News + FAQ). Tag revalidated by /admin/content mutations.
STATUS: UNLOCKED (lock after verified)
AUDIT:
- FIXED: slug cache safety — now caches per-slug (prevents cross-slug cache collisions).
- REMOVED: all console logging (prod-safe; avoids leaking DB/errors in server logs).
- KEPT: anon public Supabase client inside cache() (no cookies / no session binding).
- BEHAVIOR: on Supabase errors, returns [] / null (silent failure, no logs).
*/

import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache as cache } from "next/cache";

export const SITE_CONTENT_TAG = "site-content";

/* -------------------------------------------------------------------------- */
/* Public Supabase client (anon)                                               */
/* IMPORTANT: Do NOT use cookies() / createServerSupabaseClient() in cache()   */
/* -------------------------------------------------------------------------- */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let publicClient: SupabaseClient | null = null;

function getPublicSupabase(): SupabaseClient {
	if (publicClient) return publicClient;

	if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
		throw new Error(
			"Public site content requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
		);
	}

	publicClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
			detectSessionInUrl: false,
		},
		global: { headers: { "X-Client-Info": "sa-immi-public-content" } },
	});

	return publicClient;
}

/* -------------------------------------------------------------------------- */
/* Types (DB shape: EN/RU columns)                                             */
/* -------------------------------------------------------------------------- */

export type PublicNewsRow = {
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

export type PublicFaqRow = {
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
/* Cached reads (tagged)                                                       */
/* -------------------------------------------------------------------------- */

export const getPublicNews = cache(
	async (): Promise<PublicNewsRow[]> => {
		const supabase = getPublicSupabase();

		const { data, error } = await supabase
			.from("site_news")
			.select(
				"id,slug,title_en,title_ru,summary_en,summary_ru,body_md_en,body_md_ru,is_published,published_at,pinned,created_at,updated_at",
			)
			.eq("is_published", true)
			.or("published_at.is.null,published_at.lte.now()")
			.order("pinned", { ascending: false })
			.order("published_at", { ascending: false })
			.order("created_at", { ascending: false });

		if (error) return [];
		return (data ?? []) as PublicNewsRow[];
	},
	["site-content:news"],
	{ tags: [SITE_CONTENT_TAG] },
);

/**
 * Slug-safe cached read:
 * - Creates a per-slug cached function instance so the cache key is guaranteed unique per slug.
 * - Avoids any chance of cross-slug cache collisions under a static key.
 */
function getPublicNewsBySlugCached(slug: string) {
	return cache(
		async (): Promise<PublicNewsRow | null> => {
			const supabase = getPublicSupabase();

			const { data, error } = await supabase
				.from("site_news")
				.select(
					"id,slug,title_en,title_ru,summary_en,summary_ru,body_md_en,body_md_ru,is_published,published_at,pinned,created_at,updated_at",
				)
				.eq("slug", slug)
				.eq("is_published", true)
				.or("published_at.is.null,published_at.lte.now()")
				.maybeSingle();

			if (error) return null;
			return (data ?? null) as PublicNewsRow | null;
		},
		["site-content:news:slug", slug],
		{ tags: [SITE_CONTENT_TAG] },
	)();
}

function normalizeSlug(input: unknown): string {
	if (typeof input !== "string") return "";
	const s = input.trim().toLowerCase();

	// Hard cap to avoid unbounded cache keys / abuse (should exceed any real slug needs).
	if (s.length === 0 || s.length > 160) return "";

	// Conservative allowlist: adjust ONLY if your slug format truly differs.
	if (!/^[a-z0-9-]+$/.test(s)) return "";

	return s;
}

export async function getPublicNewsBySlug(slug: string): Promise<PublicNewsRow | null> {
	const s = normalizeSlug(slug);
	if (!s) return null;
	return await getPublicNewsBySlugCached(s);
}

export const getPublicFaq = cache(
	async (): Promise<PublicFaqRow[]> => {
		const supabase = getPublicSupabase();

		const { data, error } = await supabase
			.from("site_faq")
			.select(
				"id,question_en,question_ru,answer_md_en,answer_md_ru,sort_order,is_published,created_at,updated_at",
			)
			.eq("is_published", true)
			.order("sort_order", { ascending: true })
			.order("updated_at", { ascending: false });

		if (error) return [];
		return (data ?? []) as PublicFaqRow[];
	},
	["site-content:faq"],
	{ tags: [SITE_CONTENT_TAG] },
);
