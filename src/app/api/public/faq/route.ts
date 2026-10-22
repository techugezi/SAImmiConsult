/*
DOC NAME: route.ts
LOCATION: /src/app/api/public/faq/route.ts
SCOPE: Public FAQ feed endpoint for client-safe consumption (e.g., Home top-3 preview).
STATUS: UNLOCKED (lock after verified)
AUDIT:
- Server-only.
- Uses canonical getPublicFaq() source.
- Clamps query params.
- Returns client-safe JSON only.
- Conservative caching headers.
*/

import "server-only";

import { NextResponse } from "next/server";
import { getPublicFaq } from "@/lib/siteContent";

/* -------------------------------------------------------------------------- */
/* Config                                                                     */
/* -------------------------------------------------------------------------- */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

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

		const faqs = await getPublicFaq();

		const items = (Array.isArray(faqs) ? faqs : [])
			.slice(0, limit)
			.map((f: any) => ({
				id: String(f?.id ?? ""),

				question_en: String(f?.question_en ?? ""),
				question_ru: String(f?.question_ru ?? ""),

				answer_md_en: String(f?.answer_md_en ?? ""),
				answer_md_ru: String(f?.answer_md_ru ?? ""),

				// Optional consumer fields (still safe):
				sort_order: typeof f?.sort_order === "number" ? f.sort_order : null,
				updated_at: typeof f?.updated_at === "string" ? f.updated_at : null,
			}))
			.filter((x) => x.id.length > 0);

		return NextResponse.json(
			{ items },
			{
				status: 200,
				headers: {
					"Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
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
