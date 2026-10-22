/* DOC NAME: normalizeTimelineEvents.ts
   LOCATION: /src/lib/timeline/normalizeTimelineEvents.ts
   SCOPE: Timeline adapter — validates, normalizes, backfills i18n keys from event type, and sorts events for UI.
   STATUS: UNLOCKED (lock after approved)
*/

import { TIMELINE_I18N_KEYS, isTimelineEventType, type TimelineEventType } from "@/config/timeline";

export type TimelineEventActorRole = "client" | "consultant" | "admin" | "system";

export type TimelineEvent = {
	id: string;
	type: TimelineEventType;
	occurred_at: string;

	title_key: string;
	desc_key?: string | null;

	actor?: {
		role?: TimelineEventActorRole;
		user_id?: string | null;
	} | null;

	meta?: Record<string, unknown> | null;

	version?: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeString(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

function safeIso(value: unknown): string | null {
	const s = safeString(value);
	if (!s) return null;

	const d = new Date(s);
	if (Number.isNaN(d.getTime())) return null;

	// Keep original string to preserve timezone info as stored
	return s;
}

function safeId(value: unknown): string | null {
	const s = safeString(value);
	if (!s) return null;
	return s.trim().length > 0 ? s.trim() : null;
}

function coerceActor(value: unknown): TimelineEvent["actor"] {
	if (!isRecord(value)) return null;

	const roleRaw = safeString(value.role);
	const userIdRaw = safeString(value.user_id);

	const role =
		roleRaw === "client" || roleRaw === "consultant" || roleRaw === "admin" || roleRaw === "system"
			? roleRaw
			: undefined;

	const user_id = userIdRaw && userIdRaw.trim().length > 0 ? userIdRaw.trim() : null;

	if (!role && !user_id) return null;

	return { role, user_id };
}

function coerceMeta(value: unknown): Record<string, unknown> | null {
	if (!isRecord(value)) return null;
	return value;
}

function ensureTitleKeys(type: TimelineEventType, titleKeyRaw: unknown, descKeyRaw: unknown) {
	const title_key = safeString(titleKeyRaw) ?? TIMELINE_I18N_KEYS[type].titleKey;
	const desc_key = safeString(descKeyRaw) ?? TIMELINE_I18N_KEYS[type].descKey ?? null;
	return { title_key, desc_key };
}

/**
 * Normalizes raw JSONB timeline to a strict TimelineEvent[].
 * - Drops invalid rows
 * - Backfills title_key/desc_key based on type mapping
 * - Sorts descending by occurred_at
 * - Backward compatible with legacy rows that had { type, occurred_at } only
 */
export function normalizeTimelineEvents(raw: unknown): TimelineEvent[] {
	if (!Array.isArray(raw)) return [];

	const out: TimelineEvent[] = [];

	for (const item of raw) {
		if (!isRecord(item)) continue;

		const typeRaw = safeString(item.type);
		if (!typeRaw || !isTimelineEventType(typeRaw)) continue;

		const occurred_at = safeIso(item.occurred_at);
		if (!occurred_at) continue;

		const id = safeId(item.id) ?? `${typeRaw}:${occurred_at}`;

		const { title_key, desc_key } = ensureTitleKeys(typeRaw, item.title_key, item.desc_key);

		const actor = coerceActor(item.actor);
		const meta = coerceMeta(item.meta);

		const versionRaw = typeof item.version === "number" ? item.version : null;

		out.push({
			id,
			type: typeRaw,
			occurred_at,
			title_key,
			desc_key,
			actor,
			meta,
			version: versionRaw,
		});
	}

	out.sort((a, b) => {
		const da = new Date(a.occurred_at).getTime();
		const db = new Date(b.occurred_at).getTime();
		return db - da;
	});

	return out;
}
