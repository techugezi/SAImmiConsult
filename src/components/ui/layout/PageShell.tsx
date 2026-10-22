/*
DOC NAME: PageShell.tsx
LOCATION: /src/components/ui/layout/PageShell.tsx
SCOPE: PageShell — global layout primitive wrapper (layout only).
STATUS: UNLOCKED
*/

import type React from "react";
import styles from "./layout.module.css";

type Props = {
	children: React.ReactNode;
};

export function PageShell({ children }: Props) {
	return (
		<div className={`${styles.page} app-page`}>
			<div className={styles.shell}>{children}</div>
		</div>
	);
}