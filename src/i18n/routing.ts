/*
DOC NAME: routing.ts
LOCATION: /src/i18n/routing.ts
SCOPE: next-intl routing map (App Router). Defines supported locales + typed pathnames.
STATUS: UNLOCKED (lock after verified)
AUDIT:
- Fixed missing leading slashes that can corrupt pathname building (e.g. "[object Object]" URLs).
- Added missing canonical app routes used by siteConfig (home + admin + client).
- Kept mappings minimal and explicit to avoid accidental route exposure.
*/

import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
	// Supported locales
	locales: ["en", "ru"] as const,

	// Used when no locale matches or when detection fails
	defaultLocale: "ru",

	// Localized pathnames (keep canonical paths on the right-hand side)
	pathnames: {
		// Public site
		"/": "/",
		"/home": "/home",
		"/about": "/about",
		"/services": "/services",
		"/services/immigration": "/services/immigration",
		"/services/emigration": "/services/emigration",
		"/services/visa-types": "/services/visa-types",
		"/services/additional-support": "/services/additional-support",
		"/news": "/news",
		"/news/[slug]": "/news/[slug]",
		"/faq": "/faq",
		"/contact": "/contact",

		// Auth
		"/login": "/login",
		"/signup": "/signup",
		"/auth/success": "/auth/success",

		// Password flows (present in siteConfig)
		"/password/forgot": "/password/forgot",
		"/password/reset": "/password/reset",
		"/password/change": "/password/change",

		// Client area (present in siteConfig)
		"/client/account": "/client/account",
		"/client/dashboard": "/client/dashboard",
		"/client/cases": "/client/cases",
		"/client/cases/new": "/client/cases/new",
		"/client/cases/[id]": "/client/cases/[id]",
		"/client/documents": "/client/documents",
		"/client/applications": "/client/applications",
		"/client/applications/new": "/client/applications/new",
		"/client/applications/[id]": "/client/applications/[id]",

		// Admin area (present in siteConfig)
		"/admin/account": "/admin/account",
		"/admin/dashboard": "/admin/dashboard",
		"/admin/cases": "/admin/cases",
		"/admin/cases/[id]": "/admin/cases/[id]",
		"/admin/applications": "/admin/applications",
		"/admin/applications/[id]": "/admin/applications/[id]",
		"/admin/documents": "/admin/documents",
		"/admin/clientprofiles": "/admin/clientprofiles",
		"/admin/clientprofiles/[id]": "/admin/clientprofiles/[id]",
		"/admin/content": "/admin/content",
	},
});

export type AppLocale = (typeof routing.locales)[number];
