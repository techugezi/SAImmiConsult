/*
DOC NAME: route.ts
LOCATION: /src/app/[locale]/auth/callback/route.ts
SCOPE: Supabase auth callback handler. Converts error codes into UX-safe redirects.
STATUS: UNLOCKED (lock after verified)
*/

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { routing } from "@/i18n/routing";
import { siteConfig } from "@/config/siteConfig";

function isSupportedLocale(maybe: string) {
	return routing.locales.includes(maybe as any);
}

function safeLocaleFromPath(pathname: string) {
	const parts = pathname.split("/").filter(Boolean);
	const maybeLocale = parts[0] ?? "";
	return isSupportedLocale(maybeLocale) ? maybeLocale : routing.defaultLocale;
}

function redirectTo(request: NextRequest, pathname: string, search?: URLSearchParams) {
	const url = request.nextUrl.clone();
	url.pathname = pathname;
	url.search = search ? `?${search.toString()}` : "";
	url.hash = "";
	return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
	const url = request.nextUrl;
	const locale = safeLocaleFromPath(url.pathname);

	// Supabase sometimes duplicates error info in hash; server only sees query.
	const error = url.searchParams.get("error");
	const errorCode = url.searchParams.get("error_code");
	const code = url.searchParams.get("code"); // PKCE code when success
	const next = url.searchParams.get("next"); // optional

	// Prepare response we can attach cookies to (supabase auth exchange sets cookies)
	const response = NextResponse.next();

	const supabase = createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				getAll() {
					return request.cookies.getAll();
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

	/* ---------------------------------------------------------------------- */
	/* 1) Handle known error cases (no 404)                                    */
	/* ---------------------------------------------------------------------- */

	if (error) {
		// Normalize: Supabase uses otp_expired for email magic/confirm links
		if (errorCode === "otp_expired") {
			const q = new URLSearchParams();
			q.set("auth", "code_expired");
			return redirectTo(request, `/${locale}${siteConfig.loginPath}`, q);
		}

		// Generic auth callback error → back to login with flag
		const q = new URLSearchParams();
		q.set("auth", "callback_failed");
		return redirectTo(request, `/${locale}${siteConfig.loginPath}`, q);
	}

	/* ---------------------------------------------------------------------- */
	/* 2) Success flow: exchange code for session cookies                      */
	/* ---------------------------------------------------------------------- */

	if (code) {
		const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

		if (exchangeError) {
			const q = new URLSearchParams();
			q.set("auth", "callback_failed");
			return redirectTo(request, `/${locale}${siteConfig.loginPath}`, q);
		}

		// Choose where to send user after success
		const safeNext =
			typeof next === "string" && next.startsWith("/") ? next : siteConfig.clientDashboardPath;

		// Redirect with cookies attached to THIS response
		const redirectUrl = request.nextUrl.clone();
		redirectUrl.pathname = `/${locale}${safeNext}`;
		redirectUrl.search = "";
		redirectUrl.hash = "";

		return NextResponse.redirect(redirectUrl, { headers: response.headers });
	}

	/* ---------------------------------------------------------------------- */
	/* 3) Missing code and no error → treat as invalid link                    */
	/* ---------------------------------------------------------------------- */

	{
		const q = new URLSearchParams();
		q.set("auth", "invalid_link");
		return redirectTo(request, `/${locale}${siteConfig.loginPath}`, q);
	}
}
