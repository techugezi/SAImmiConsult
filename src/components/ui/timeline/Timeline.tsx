/* DOC NAME: Timeline.tsx
   LOCATION: /src/components/ui/timeline/Timeline.tsx
   SCOPE: Timeline renderer — stable contract for displaying normalized timeline events with i18n keys.
   STATUS: UNLOCKED (lock after approved)
   NOTES:
   - Uses `events` (TimelineEvent[]) and `translate`.
   - No hardcoded UI strings: callers pass `translate` and `dateNaLabel`.
   - Renders grouped timeline (dot per group header, not per item).
   - No nested “cards” per event; this is a rail + text list.
*/

import type React from "react";

import type { TimelineEvent } from "@/lib/timeline/normalizeTimelineEvents";

import styles from "./Timeline.module.css";

type TimelineProps = {
	locale: string;
	dateNaLabel: string;

	events: TimelineEvent[] | null | undefined;

	translate: (key: string, values?: Record<string, any>) => string;
};

function safeDate(value: string): Date | null {
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return null;
	return d;
}

function safeT(translate: TimelineProps["translate"], key: string): string | null {
	try {
		return translate(key);
	} catch {
		return null;
	}
}

function minuteBucketKey(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	const hh = String(d.getHours()).padStart(2, "0");
	const mm = String(d.getMinutes()).padStart(2, "0");
	return `${y}-${m}-${day} ${hh}:${mm}`;
}

function isMilestoneType(type: string): boolean {
	// Safe “milestone emphasis” defaults.
	// Extend as your canonical timeline evolves (no UI copy here, just type checks).
	const s = type.trim().toLowerCase();

	if (s === "case_created") return true;
	if (s === "intake_submitted") return true;
	if (s === "consultation_requested") return true;
	if (s === "consultation_scheduled") return true;
	if (s === "case_activated") return true;

	if (s === "application_created") return true;
	if (s === "application_status_changed") return true;
	if (s === "document_status_changed") return true;
	if (s === "drive_folders_provisioned") return true;

	return false;
}

type Group = {
	key: string;
	label: string;
	occurredAtForSort: number;
	items: TimelineEvent[];
	scopeHint: "case" | "application" | "mixed" | "unknown";
	hasMilestone: boolean;
};

export default function Timeline({ locale, dateNaLabel, events, translate }: TimelineProps) {
	const fmt = new Intl.DateTimeFormat(locale, {
		year: "numeric",
		month: "short",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});

	const ariaLabel = safeT(translate, "Timeline.ariaLabel") ?? "";
	const emptyLabel = safeT(translate, "Timeline.empty") ?? "";

	const safeEvents = Array.isArray(events) ? events : [];

	if (safeEvents.length === 0) {
		return (
			<div className={`${styles.root} timeline`} aria-label={ariaLabel}>
				<p className="text-sm text-muted" style={{ margin: 0 }}>
					{emptyLabel}
				</p>
			</div>
		);
	}

	// Group by same minute (same visible time cluster).
	// Assumes incoming events are already in the desired order (often newest-first).
	const groupsMap = new Map<string, { items: TimelineEvent[]; sortTs: number }>();

	for (const evt of safeEvents) {
		const d = safeDate(evt.occurred_at);
		const ts = d ? d.getTime() : 0;

		const key = d ? minuteBucketKey(d) : "na";
		const cur = groupsMap.get(key);

		if (!cur) {
			groupsMap.set(key, { items: [evt], sortTs: ts });
		} else {
			cur.items.push(evt);
			cur.sortTs = Math.max(cur.sortTs, ts);
		}
	}

	const groups: Group[] = [];

	for (const [key, val] of groupsMap.entries()) {
		const sortTs = val.sortTs;
		const d = sortTs ? new Date(sortTs) : null;
		const label = d ? fmt.format(d) : dateNaLabel;

		let hasCase = false;
		let hasApp = false;

		let hasMilestone = false;

		for (const it of val.items) {
			const type = typeof it.type === "string" ? it.type : "";
			if (isMilestoneType(type)) hasMilestone = true;

			// Optional scope hint: normalizeTimelineEvents may attach a hint.
			// We do not require it; purely a styling hook.
			const scope = (it as any)?.scope;
			if (scope === "case") hasCase = true;
			if (scope === "application") hasApp = true;
		}

		const scopeHint: Group["scopeHint"] =
			hasCase && hasApp ? "mixed" : hasCase ? "case" : hasApp ? "application" : "unknown";

		// Keep the inner order stable (do not reshuffle; caller decides ordering).
		groups.push({
			key,
			label,
			occurredAtForSort: sortTs,
			items: val.items,
			scopeHint,
			hasMilestone,
		});
	}

	// Sort groups newest-first (matches your screenshots).
	groups.sort((a, b) => b.occurredAtForSort - a.occurredAtForSort);

	return (
		<div className={`${styles.root} timeline`} aria-label={ariaLabel}>
			<div className={`${styles.list} timelineList`}>
				{groups.map((g) => {
					const scopeClass =
						g.scopeHint === "case"
							? "timelineScopeCase"
							: g.scopeHint === "application"
								? "timelineScopeApp"
								: g.scopeHint === "mixed"
									? "timelineScopeMixed"
									: "timelineScopeUnknown";

					const groupClass = [
						styles.group,
						"timelineGroup",
						scopeClass,
						g.hasMilestone ? "timelineGroupMilestone" : "",
					]
						.filter(Boolean)
						.join(" ");

					return (
						<section key={g.key} className={groupClass}>
							<div className={`${styles.groupRail} timelineRailCell`} aria-hidden="true">
								<span className={`${styles.dot} timelineDot`} />
							</div>

							<div className={`${styles.groupBody} timelineGroupBody`}>
								<div className={`${styles.groupHeader} timelineGroupHeader`}>
									<p className={`${styles.timeLabel} timelineTime`} style={{ margin: 0 }}>
										{g.label}
									</p>
								</div>

								<div className={`${styles.items} timelineItems`}>
									{g.items.map((evt) => {
										const title = evt.title_key
											? safeT(translate, evt.title_key) ?? evt.type
											: evt.type;

										const desc = evt.desc_key ? safeT(translate, evt.desc_key) : null;

										const itemClass = [
											styles.item,
											"timelineItem",
											isMilestoneType(evt.type) ? "timelineItemMilestone" : "",
										]
											.filter(Boolean)
											.join(" ");

										return (
											<div key={evt.id} className={itemClass}>
												<p className={`${styles.itemTitle} timelineItemTitle`} style={{ margin: 0 }}>
													{title}
												</p>

												{desc ? (
													<p className="text-xs text-muted" style={{ margin: 0 }}>
														{desc}
													</p>
												) : null}
											</div>
										);
									})}
								</div>
							</div>
						</section>
					);
				})}
			</div>
		</div>
	);
}
