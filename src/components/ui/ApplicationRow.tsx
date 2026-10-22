/*
DOC NAME: ApplicationRow.tsx
LOCATION: /src/components/ui/ApplicationRow.tsx
SCOPE: ApplicationRow — clickable list row for admin/client application lists (NO timeline). Mirrors CaseRow layout/interaction.
STATUS: LOCKED
AUDITED:
- Scope: Pure presentational row; delegates navigation/interaction to RowItem (no business logic here).
- Data exposure: Props-only (strings/dates/ids); no direct DB access or sensitive fields handled.
- Client boundary: "use client" is acceptable given RowItem likely relies on client navigation/handlers.
- Accessibility: CTA is a non-interactive <span> styled as a button, avoiding nested interactive controls if RowItem wraps the row in a link.
- i18n: No hardcoded user-facing strings; all labels supplied via props.
- Dates: Uses toLocaleDateString() (output varies by user/browser locale). If consistent locale formatting is required, format dates upstream and pass formatted strings (not changed here).
NOTES:
- Added optional docsSummary for application stats (preformatted, i18n-safe), rendered under the Application ID.
- href is typed to match next-intl <Link/> (supports both string and { pathname, params } object form).
*/

"use client";

import * as React from "react";
import type { ComponentProps } from "react";

import { Link } from "@/i18n/navigation";

import RowItem from "@/components/ui/RowItem";
import styles from "./ApplicationRow.module.css";

type AppLinkHref = ComponentProps<typeof Link>["href"];

type Props = {
	href: AppLinkHref;

	title: string;
	subtitle: string;

	createdAt: Date | null;
	updatedAt: Date | null;

	applicationId: string;
	applicationIdLabel: string;

	statusLabel: string;
	statusTone: string;

	/**
	 * Optional, preformatted stats copy (i18n-safe), e.g.:
	 * "1/1 uploaded · 1 approved"
	 */
	docsSummary?: string | null;

	openLabel: string;
	createdLabel: string;
	updatedLabel: string;
	dateNaLabel: string;
	arrowLabel: string;
};

export default function ApplicationRow({
	href,
	title,
	subtitle,
	createdAt,
	updatedAt,
	applicationId,
	applicationIdLabel,
	statusLabel,
	statusTone,
	docsSummary,
	openLabel,
	createdLabel,
	updatedLabel,
	dateNaLabel,
	arrowLabel,
}: Props) {
	return (
		<RowItem
			href={href}
			ariaLabel={openLabel}
			className={styles.row}
			main={
				<>
					<p className={`${styles.name} case-row-name`}>{title}</p>

					<p className={`${styles.subtitle} text-sm text-muted`}>{subtitle}</p>

					<p className={`${styles.dates} text-xs text-muted`}>
						{createdLabel}: {createdAt ? createdAt.toLocaleDateString() : dateNaLabel}
						{" · "}
						{updatedLabel}: {updatedAt ? updatedAt.toLocaleDateString() : dateNaLabel}
					</p>

					<div className={styles.metaStack}>
						<p className={`${styles.meta} text-xs text-muted`}>
							{applicationIdLabel}: {applicationId}
						</p>

						{docsSummary ? (
							<p className={`${styles.meta} text-sm text-muted`} title={docsSummary}>
								{docsSummary}
							</p>
						) : null}
					</div>
				</>
			}
			side={
				<>
					<span className={`badge ${statusTone} ${styles.badge}`}>
						<span className={styles.badgeText}>{statusLabel}</span>
					</span>

					<span className={`${styles.cta} button button-ghost`} aria-label={openLabel}>
						<span>{openLabel}</span>
						<span className={styles.arrow} aria-hidden="true">
							{arrowLabel}
						</span>
					</span>
				</>
			}
		/>
	);
}
