/*
DOC NAME: Panel.tsx
LOCATION: /src/components/ui/panel/Panel.tsx
SCOPE: Panel primitive composition only (layout in panel.module.css, typography roles in globals.css)
STATUS: LOCKED
APPLIES TO: Any usage of <Panel /> across Admin + Client
NOTES:
- panel-title / panel-subtitle MUST remain global roles (globals.css).
- No typography/color rules in panel.module.css.
CONTENT:
*/

import type React from "react";
import styles from "./panel.module.css";

export function Panel({
	title,
	subtitle,
	actions,
	children,
}: {
	title: string;
	subtitle?: string;
	actions?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<section className={styles.panel}>
			<header className={styles.header}>
				<div className={styles.headerText}>
					<h2 className="panel-title">{title}</h2>
					{subtitle ? <p className="panel-subtitle">{subtitle}</p> : null}
				</div>

				{actions ? <div className={styles.actions}>{actions}</div> : null}
			</header>

			<div className={styles.body}>{children}</div>
		</section>
	);
}
