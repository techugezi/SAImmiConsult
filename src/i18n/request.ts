/*
DOC NAME: request.ts
LOCATION: /src/i18n/request.ts
SCOPE: next-intl request config (server-only). Loads and merges per-locale message sections based on messagesConfig.
STATUS: UNLOCKED (lock after verified)
AUDIT:
- Added server-only strict mode flag (I18N_STRICT) to fail-fast in CI/staging for missing/invalid translation section files.
- Kept prod-safe behavior (non-strict mode silently returns {} for missing sections; no logging).
- Hardened merge: validates imported JSON default is object-like (prevents unexpected shapes).
- Reduced allocations: deterministic merge using Object.assign in a loop.
*/

import "server-only";

import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

import { MESSAGE_SECTION_FILES, type SectionFile } from "./messagesConfig";

/**
 * If true, missing/invalid translation section files will THROW.
 * Use for CI / staging to detect regressions early.
 *
 * Server-only flag. Do NOT prefix with NEXT_PUBLIC_.
 */
const I18N_STRICT = process.env.I18N_STRICT === "true";

type MessagesObject = Record<string, unknown>;

async function importSection(locale: string, file: SectionFile): Promise<MessagesObject> {
	try {
		const mod = await import(`../messages/${locale}/${file}.json`);
		const val = (mod as any)?.default;

		// Ensure we only merge plain object-ish values
		if (val && typeof val === "object" && !Array.isArray(val)) {
			return val as MessagesObject;
		}

		// Unexpected shape: treat as missing
		if (I18N_STRICT) {
			throw new Error("I18N_SECTION_INVALID_SHAPE");
		}

		return {};
	} catch {
		if (I18N_STRICT) {
			throw new Error("I18N_SECTION_MISSING");
		}
		return {};
	}
}

async function loadMessagesForLocale(locale: string): Promise<MessagesObject> {
	const parts = await Promise.all(
		MESSAGE_SECTION_FILES.map((file) => importSection(locale, file)),
	);

	// Deterministic merge, minimal allocations
	const messages: MessagesObject = {};
	for (const part of parts) {
		Object.assign(messages, part);
	}

	return messages;
}

export default getRequestConfig(async ({ requestLocale }) => {
	const requested = await requestLocale;

	const locale = hasLocale(routing.locales, requested)
		? requested
		: routing.defaultLocale;

	const messages = await loadMessagesForLocale(locale);

	return { locale, messages };
});
