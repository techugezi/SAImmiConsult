/*
DOC NAME: route.ts
LOCATION: /src/app/api/public/news/route.ts
SCOPE: Public news feed (safe subset) for client-side consumption (Home ticker, etc).
STATUS: UNLOCKED (lock after verified)
AUDIT:
- Server-only.
- Uses canonical getPublicNews() source.
- Clamps query params.
- Returns client-safe JSON only.
- Prefer pinned items when available.
*/

import "server-only";

import { NextResponse } from "next/server";
import { getPublicNews } from "@/lib/siteContent";

/* -------------------------------------------------------------------------- */
/* Config                                                                     */
/* -------------------------------------------------------------------------- */

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 20;

function parseLimit(value: string | null): number {
	if (!value) return DEFAULT_LIMIT;

	const n = Number.parseInt(value, 10);
	if (!Number.isFinite(n)) return DEFAULT_LIMIT;

	return Math.max(1, Math.min(MAX_LIMIT, n));
}

/* -------------------------------------------------------------------------- */
/* Route                                                                      */
/* -------------------------------------------------------------------------- */

export async function GET(req: Request) {
	try {
		const url = new URL(req.url);
		const limit = parseLimit(url.searchParams.get("limit"));

		const news = await getPublicNews();

		const list = Array.isArray(news) ? news : [];
		const pinned = list.filter((n: any) => Boolean(n?.pinned));
		const source = pinned.length > 0 ? pinned : list;

		const items = source
			.slice(0, limit)
			.map((n: any) => ({
				id: String(n?.id ?? ""),
				slug: String(n?.slug ?? ""),
				published_at: n?.published_at ? String(n.published_at) : null,
				pinned: Boolean(n?.pinned),
				title_en: String(n?.title_en ?? ""),
				title_ru: String(n?.title_ru ?? ""),
			}))
			.filter((x) => x.id.length > 0 && x.slug.length > 0);

		return NextResponse.json(
			{ items },
			{
				status: 200,
				headers: {
					// Public content: allow CDN caching but keep it reasonably fresh
					"Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
				},
			},
		);
	} catch {
		return NextResponse.json(
			{ items: [] as any[] },
			{
				status: 200,
				headers: { "Cache-Control": "no-store" },
			},
		);
	}
}
