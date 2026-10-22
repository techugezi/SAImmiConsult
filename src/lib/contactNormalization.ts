/* DOC NAME: Contact Normalization Helpers
   LOCATION: src/lib/contactNormalization.ts
   SCOPE: Lightweight normalization/format checks for contact details (non-invasive)
   STATUS: LOCKED
   AUDIT (PROD PRIMING):
   - Hardened all helpers against null-ish / non-string inputs (defensive, nuisance-free).
   - Email normalization: trims + lowercases; added optional validator helper for UI gating (no behavior change unless used).
   - Telegram normalization: trims, strips leading "@", removes internal whitespace; added optional validator helper.
   - WhatsApp normalization:
     - Accepts pasted E.164 (+27...) or "00" international prefix safely.
     - Ensures callingCode is digits-only; strips any leading "+" from stored options defensively.
     - Keeps “best-effort” behavior (returns e164=null if invalid), never throws.
   - Fixed inferWhatsAppFromE164 bug: comparing calling-code length now uses digits-only length (previously could mis-rank if callingCode had "+").
   - No UI strings, no styling, no side effects; pure functions for predictable prod behavior.
*/

import type { WhatsAppCountryOption } from "@/config/whatsappCountries";

function safeString(v: unknown): string {
	return typeof v === "string" ? v : "";
}

function digitsOnly(raw: string): string {
	return safeString(raw).replace(/\D/g, "");
}

/* -------------------------------------------------------------------------- */
/* Email                                                                       */
/* -------------------------------------------------------------------------- */

export function normalizeEmail(raw: string): string {
	return safeString(raw).trim().toLowerCase();
}

/**
 * Optional lightweight validator (UI gating only; DB remains the final gate).
 * NOTE: This is intentionally simple and non-invasive.
 */
export function isValidEmailFormat(raw: string): boolean {
	const v = normalizeEmail(raw);
	if (!v) return false;
	return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(v);
}

/* -------------------------------------------------------------------------- */
/* Telegram                                                                    */
/* -------------------------------------------------------------------------- */

export function normalizeTelegramUsername(raw: string): string {
	let v = safeString(raw).trim();

	if (v.startsWith("@")) v = v.slice(1);

	// Telegram usernames are typically contiguous; remove whitespace to avoid nuisance inputs.
	v = v.replace(/\s+/g, "");

	return v;
}

/**
 * Optional lightweight validator (UI gating only; DB remains the final gate).
 * Telegram usernames are 5–32 chars, letters/digits/underscore.
 */
export function isValidTelegramUsernameFormat(raw: string): boolean {
	const v = normalizeTelegramUsername(raw);
	if (!v) return false;
	return /^[A-Za-z0-9_]{5,32}$/.test(v);
}

/* -------------------------------------------------------------------------- */
/* WhatsApp                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Normalize WhatsApp input to E.164: +<countryCode><nationalNumber>
 * - callingCode must be digits only (no +)
 * - rawNumber can include spaces/leading 0/+ / 00 prefix; we strip to digits and normalize
 * - minimal validation: E.164 length (8..15 digits total) & no leading 0 country code
 */
export function normalizeWhatsAppE164(
	country: WhatsAppCountryOption,
	rawNumber: string,
): { e164: string | null; nationalDigits: string | null; callingCode: string } {
	const callingCode = digitsOnly(country?.callingCode);
	let n = digitsOnly(rawNumber);

	if (!callingCode) {
		return { e164: null, nationalDigits: null, callingCode: "" };
	}

	if (!n) {
		return { e164: null, nationalDigits: null, callingCode };
	}

	// Handle common international prefix "00" (e.g. 0027...)
	if (n.startsWith("00")) {
		n = n.slice(2);
	}

	// If user pasted a full international number (e.g. +27...), strip leading callingCode if present
	if (n.startsWith(callingCode)) {
		n = n.slice(callingCode.length);
	}

	// If user typed a national format with leading 0, remove it (common)
	if (n.startsWith("0")) {
		n = n.replace(/^0+/, "");
	}

	const full = callingCode + n;

	// E.164: country code + national number, total digits 8..15 (excluding +)
	if (!/^[1-9][0-9]{7,14}$/.test(full)) {
		return { e164: null, nationalDigits: n || null, callingCode };
	}

	return { e164: `+${full}`, nationalDigits: n || null, callingCode };
}

/**
 * If DB has whatsapp_e164 but legacy fields are empty, infer best-effort:
 * - match the longest calling code from our supported list that prefixes the digits
 */
export function inferWhatsAppFromE164(
	e164: string,
	options: readonly WhatsAppCountryOption[],
): { iso2: string | null; callingCode: string | null; nationalDigits: string | null } {
	const digits = digitsOnly(e164);
	if (!digits) return { iso2: null, callingCode: null, nationalDigits: null };

	let best: { opt: WhatsAppCountryOption; ccDigits: string } | null = null;

	for (const o of options ?? []) {
		const ccDigits = digitsOnly(o?.callingCode);
		if (!ccDigits) continue;

		if (digits.startsWith(ccDigits)) {
			if (!best || ccDigits.length > best.ccDigits.length) {
				best = { opt: o, ccDigits };
			}
		}
	}

	if (!best) return { iso2: null, callingCode: null, nationalDigits: null };

	return {
		iso2: best.opt.iso2 ?? null,
		callingCode: best.ccDigits,
		nationalDigits: digits.slice(best.ccDigits.length) || null,
	};
}
