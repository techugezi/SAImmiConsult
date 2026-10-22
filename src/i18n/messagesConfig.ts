/*
DOC NAME: messagesConfig.ts
LOCATION: /src/i18n/messagesConfig.ts
SCOPE: Single source of truth for message section file names (drives dynamic imports in request.ts).
STATUS: UNLOCKED (lock after verified)
AUDIT:
- Hardened typing: explicit readonly tuple + derived union type preserved.
- No behavioral change in runtime output; list contents unchanged.
- Normalized formatting/indentation to reduce accidental diffs and improve maintainability.
- Keeps section file names as the only allowed dynamic-import surface area for i18n.
*/

export const MESSAGE_SECTION_FILES = [
	// site navigation
	"common",
	"navbar",
	"home",
	"about",
	"contact",
	"faq",
	"news",

	// services
	"services",
	"services.immigration",
	"services.emigration",
	"services.visa-types",
	"services.additional",

	"footer",

	// login / signup
	"login",
	"signup",
	"auth.success",

	// auth / password
	"password.form",

	// client
	"client.profile",
	"client.nav",
	"client.dashboard",
	"client.applications",
	"client.application",
	"client.documents",
	"client.newapplicationwizard",
	"client.wizard",
	"client.form",
	"client.clientcasewizard",
	"client.cases",
	"client.statusstepwizard",

	// admin
	"admin.dashboard",
	"admin.applications",
	"admin.clientprofiles",
	"admin.cases",
	"admin.casedetails",
	"admin.content",
	"admin.account",
	"admin.statusstepwizard",

	// config & globals
	"document.types",
	"global.form",
	"global",
	"journey",
] as const;

export type SectionFile = (typeof MESSAGE_SECTION_FILES)[number];
