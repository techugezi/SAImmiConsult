/*
DOC NAME: StatCard.tsx
LOCATION: /src/components/ui/StatCard.tsx
SCOPE: StatCard — global primitive (LOCKED). Renders stat card markup only. No page-level layout logic.
STATUS: LOCKED
APPLIES TO: Used across Admin/Client pages (e.g., /src/app/[locale]/(admin)/admin/cases/page.tsx)
NOTES:
- Do not change global class contract: .stat-card/.stat-label/.stat-value/.stat-help and tone modifiers.
- NO hardcoded UI strings. Caller supplies label/help already i18n’d.
CONTENT:
*/

type StatCardTone = "slate" | "sky" | "amber" | "emerald" | "rose";

type StatCardProps = {
	label: string;
	value: number;
	help: string;
	tone?: StatCardTone;
};

const TONE_CLASS: Record<StatCardTone, string> = {
	slate: "stat-tone-slate",
	sky: "stat-tone-sky",
	amber: "stat-tone-amber",
	emerald: "stat-tone-emerald",
	rose: "stat-tone-rose",
};

export default function StatCard({
	label,
	value,
	help,
	tone = "slate",
}: StatCardProps) {
	return (
		<article className={`stat-card ${TONE_CLASS[tone]}`}>
			<p className="stat-label">{label}</p>
			<p className="stat-value">{value}</p>
			<p className="stat-help">{help}</p>
		</article>
	);
}
