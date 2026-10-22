/*
DOC NAME: IdentityCards.tsx
LOCATION: /src/components/ui/identity/IdentityCards.tsx
SCOPE: Global primitive — identity cards grid + optional actions row (layout + composition only).
STATUS: UNLOCKED (lock after approved)
NOTES:
- No hardcoded UI strings: callers pass content.
- Uses global typography roles via classNames; module CSS is layout-only.
*/

import type React from "react";
import styles from "./IdentityCards.module.css";

export function IdentityCards({
	children,
	actions,
	ariaLabel,
}: {
	children: React.ReactNode;
	actions?: React.ReactNode;
	ariaLabel?: string;
}) {
	return (
		<section aria-label={ariaLabel}>
			<div className={styles.grid}>{children}</div>

			{actions ? <div className={styles.actions}>{actions}</div> : null}
		</section>
	);
}

export function IdentityCard({ children }: { children: React.ReactNode }) {
	return <article className={`surface-soft ${styles.card}`}>{children}</article>;
}

/* Utility wrapper: forces children to stack under a heading (layout-only) */
export function IdentityStack({
	children,
	split,
}: {
	children: React.ReactNode;
	split?: boolean;
}) {
	return <div className={`${styles.stack}${split ? ` ${styles.stackSplit}` : ""}`}>{children}</div>;
}

/* Optional helpers to keep pages clean + consistent */
export function IdentityBadgeRow({ children }: { children: React.ReactNode }) {
	return <div className={styles.badgeRow}>{children}</div>;
}

export function IdentityLabel({ children }: { children: React.ReactNode }) {
	return <p className="form-label">{children}</p>;
}

export function IdentityValue({ children }: { children: React.ReactNode }) {
	return <p className="text-lg text-black">{children}</p>;
}

export function IdentityMeta({ children }: { children: React.ReactNode }) {
	return <div className="text-sm text-muted">{children}</div>;
}

export function IdentityMono({ children }: { children: React.ReactNode }) {
	return <p className={`text-sm ${styles.breakAll}`}>{children}</p>;
}
