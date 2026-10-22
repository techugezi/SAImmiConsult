/*
DOC NAME: DisclosurePanel.tsx
LOCATION: /src/components/ui/panel/DisclosurePanel.tsx
SCOPE: Collapsible Panel primitive (details/summary) using Panel tokens + global typography roles.
STATUS: NEW (LOCK ONCE ADDED)
NOTES:
- Uses --panel-* tokens (same as Panel primitive).
- Title/subtitle use global roles: .panel-title/.panel-subtitle (globals.css).
- Chevron glyph is passed in (i18n), no hardcoded symbols.
*/

import type React from "react";
import styles from "./disclosurePanel.module.css";

export function DisclosurePanel({
	id,
	title,
	subtitle,
	actions,
	children,
	disabled,
	defaultOpen,
	chevronLabel,
}: {
	id: string;
	title: string;
	subtitle?: string;
	actions?: React.ReactNode;
	children: React.ReactNode;
	disabled?: boolean;
	defaultOpen?: boolean;
	chevronLabel: string; // i18n glyph, e.g. "▾"
}) {
	return (
		<details
			id={id}
			className={`${styles.panel} ${disabled ? styles.disabled : ""}`}
			open={Boolean(defaultOpen)}
		>
			<summary className={styles.summary}>
				<div className={styles.headerText}>
					<h2 className="panel-title">{title}</h2>
					{subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
				</div>

				<div className={styles.headerRight}>
					{actions ? <div className={styles.actions}>{actions}</div> : null}
					<span className={styles.chevron} aria-hidden="true">
						{chevronLabel}
					</span>
				</div>
			</summary>

			<div className={styles.body}>{children}</div>
		</details>
	);
}
