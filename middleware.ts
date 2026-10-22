/*
DOC NAME: middleware.ts
LOCATION: /middleware.ts (or /src/middleware.ts depending on your repo)
SCOPE: Compose next-intl locale routing with Supabase SSR session cookie sync (document navigations only).
STATUS: UNLOCKED (lock after verified)
*/

import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { routing } from "@/i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

function isSupportedLocale(maybe: string) {
	return routing.locales.includes(maybe as any);
}

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// A) If user lands on "/{locale}" or "/{locale}/" => "/{locale}/home"
	// (do this BEFORE intl middleware to avoid extra hops)
	const localeRootMatch = pathname.match(/^\/([^/]+)\/?$/);
	if (localeRootMatch) {
		const maybeLocale = localeRootMatch[1];
		if (isSupportedLocale(maybeLocale)) {
			const url = request.nextUrl.clone();
			url.pathname = `/${maybeLocale}/home`;
			return NextResponse.redirect(url);
		}
	}

	// B) Let next-intl do its thing first (e.g. "/" -> "/en" or detected locale)
	const response = intlMiddleware(request);

	// C) If the request was "/" and next-intl returned a redirect to "/{locale}",
	// upgrade it to "/{locale}/home"
	if (pathname === "/") {
		const location = response.headers.get("location");
		if (location) {
			try {
				const target = new URL(location, request.url);
				const targetPath = target.pathname.replace(/\/+$/, ""); // trim trailing slash

				const m = targetPath.match(/^\/([^/]+)$/);
				if (m && isSupportedLocale(m[1])) {
					target.pathname = `/${m[1]}/home`;
					return NextResponse.redirect(target);
				}
			} catch {
				// ignore malformed location and continue
			}
		}
	}

/* ---------------------------------------------------------------------- */
/* PERF GUARDS                                                             */
/* ---------------------------------------------------------------------- */

	// Only do auth/session sync for real document navigations.
	const accept = request.headers.get("accept") || "";
	const isDocumentRequest = accept.includes("text/html");
	
	// PERF: Avoid touching Supabase auth unless we actually have auth cookies.
	const allCookies = request.cookies.getAll();
	const hasSupabaseAuthCookies =
		allCookies.some((c) => c.name.startsWith("sb-")) ||
		allCookies.some((c) => c.name.includes("supabase")) ||
		allCookies.some((c) => c.name.includes("access-token")) ||
		allCookies.some((c) => c.name.includes("refresh-token"));
	
	// Optional: identify protected surfaces (used for clarity/logging/guards elsewhere)
	const parts = pathname.split("/").filter(Boolean);
	const maybeLocale = parts[0];
	const isProtectedSurface =
		isSupportedLocale(maybeLocale || "") && (parts[1] === "admin" || parts[1] === "client");
	
	// Session sync only when:
	// - it's a document request AND
	// - we already have auth cookies to refresh/validate
	if (isDocumentRequest && hasSupabaseAuthCookies) {
		// Create Supabase client ONLY when we will actually use it
		const supabase = createServerClient(
			process.env.NEXT_PUBLIC_SUPABASE_URL!,
			process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
			{
				cookies: {
					getAll() {
						return allCookies;
					},
					setAll(cookiesToSet) {
						cookiesToSet.forEach(({ name, value, options }) => {
							response.cookies.set({
								name,
								value,
								...(options as CookieOptions),
							});
						});
					},
				},
			},
		);
	
		await supabase.auth.getSession();
	}
	
	// (isProtectedSurface intentionally unused here; kept as a readable landmark)
	void isProtectedSurface;
}