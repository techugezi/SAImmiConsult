/*
DOC NAME: CaseRow.tsx
LOCATION: /src/components/ui/CaseRow.tsx
SCOPE: Global primitive (Case list row). Renders a full-row Link with status badge + CTA affordance. No hardcoded user-facing strings.
STATUS: LOCKED
APPLIES TO: /src/app/[locale]/(admin)/admin/cases/page.tsx and any case lists (Admin + Client) using <CaseRow />
NOTES:
- statusTone must be semantic badge class only (badge-neutral/action/caution/success/locked) from statuses.ts.
- All user-facing text must be passed in (i18n), including CTA arrow glyph if considered user-facing.
- CTA is a visual affordance only; avoid nested interactive semantics inside the row Link (use aria-hidden).
CONTENT:
*/

import type React from "react";

import { Link } from "@/i18n/navigation";

import RowItem from "@/components/ui/RowItem";
import styles from "./CaseRow.module.css";

import type { BadgeTone } from "@/config/statuses";

type LinkHref = React.ComponentProps<typeof Link>["href"];

type CaseRowProps = {
	href: LinkHref;
	name: string;

	createdAt?: Date | null;
	updatedAt?: Date | null;

	caseId: string;

	statusLabel: string;
	statusTone: BadgeTone;

	openLabel: string;

	// i18n labels (NO hardcoded languages/ fallbacks)
	createdLabel: string;
	updatedLabel: string;
	caseIdLabel: string;

	// i18n “not available” token (e.g. GlobalForm.Common.dates.na)
	dateNaLabel: string;

	// i18n glyph / affordance (e.g. "→") — avoids hardcoded symbols
	arrowLabel: string;
};

export default function CaseRow({
	href,
	name,
	createdAt,
	updatedAt,
	caseId,
	statusLabel,
	statusTone,
	openLabel,
	createdLabel,
	updatedLabel,
	caseIdLabel,
	dateNaLabel,
	arrowLabel,
}: CaseRowProps) {
	return (
		<RowItem
			href={href}
			className={styles.row}
			main={
				<>
					<p className={`${styles.name} case-row-name`}>{name}</p>

					<p className="text-sm text-muted">
						{createdLabel}: {createdAt ? createdAt.toLocaleDateString() : dateNaLabel}
						{" · "}
						{updatedLabel}: {updatedAt ? updatedAt.toLocaleDateString() : dateNaLabel}
					</p>

					<p className="text-xs text-muted">
						{caseIdLabel}: {caseId}
					</p>
				</>
			}
			side={
				<>
					<span className={`badge ${statusTone} ${styles.badge}`}>
						<span className={styles.badgeText}>{statusLabel}</span>
					</span>

					<span className={`button button-ghost ${styles.cta}`} aria-hidden="true">
						{openLabel}
						<span className={styles.arrow} aria-hidden="true">
							{arrowLabel}
						</span>
					</span>
				</>
			}
		/>
	);
}
