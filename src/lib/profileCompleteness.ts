/* DOC NAME: profileCompleteness.ts
   LOCATION: /src/lib/profileCompleteness.ts
   SCOPE: Profile completeness helpers for gating flows (client-facing). Server/client safe.
   STATUS: UNLOCKED
   AUDIT:
   - Removed reliance on deprecated/non-existent field "phone_number" (portal uses whatsapp_e164/contact_email/telegram_username).
   - Uses “minimum viable identity” check (first_name + last_name + citizenship_country + date_of_birth) AND at least one reachable contact.
   - Treats any stored contact link/value as sensitive (no logging, no returning raw values).
   - Normalizes whitespace and handles null/undefined safely; no i18n strings; pure logic only.
*/

export type ClientProfileLike = {
	first_name?: string | null;
	last_name?: string | null;
	citizenship_country?: string | null;
	date_of_birth?: string | null;

	// Contact channels used by the portal
	contact_email?: string | null;
	telegram_username?: string | null;
	whatsapp_e164?: string | null;

	// Optional if you want to require passport at a later stage
	passport_expiry?: string | null;
};

function hasText(v: unknown): boolean {
	return typeof v === "string" && v.trim().length > 0;
}

function hasReachableContact(profile: ClientProfileLike): boolean {
	// Keep it lightweight: DB/RLS is the final gate; UI uses this for routing/gating only.
	return hasText(profile.contact_email) || hasText(profile.telegram_username) || hasText(profile.whatsapp_e164);
}

export function isProfileIncomplete(profile: ClientProfileLike | null | undefined): boolean {
	if (!profile) return true;

	// Minimum viable identity (required for most flows)
	const hasIdentity =
		hasText(profile.first_name) &&
		hasText(profile.last_name) &&
		hasText(profile.citizenship_country) &&
		hasText(profile.date_of_birth);

	if (!hasIdentity) return true;

	// Require at least one contact method so consultant can reach the client
	if (!hasReachableContact(profile)) return true;

	return false;
}

/**
 * If you need a stricter gate for document/application flows, use this.
 * Example: require passport_expiry too.
 */
export function isProfileApplicationReady(profile: ClientProfileLike | null | undefined): boolean {
	if (isProfileIncomplete(profile)) return false;
	return hasText(profile?.passport_expiry);
}
