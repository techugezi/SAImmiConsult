/*
DOC NAME: RowItem.tsx
LOCATION: /src/components/ui/RowItem.tsx
SCOPE: Shared row layout primitive (layout/interaction only). Domain wrappers (CaseRow/ApplicationRow) provide content + semantics.
STATUS: LOCKED
AUDITED:
- Primitive safety: Pure presentational wrapper (no data access, no side effects).
- Navigation: Uses i18n Link wrapper for locale-safe routing.
- Accessibility: Supports aria-label passthrough for row-level link semantics.
- Layout boundary: Main/Side split enforced here; domain rows own content + strings.
NOTES:
- No translation keys were changed.
- No logic changes were required.
*/

import * as React from "react";

import { Link } from "@/i18n/navigation";
import styles from "./RowItem.module.css";

type LinkHref = React.ComponentProps<typeof Link>["href"];

type RowItemProps = {
	href: LinkHref;
	className?: string;
	ariaLabel?: string;

	main: React.ReactNode;
	side: React.ReactNode;
};

export default function RowItem({ href, className, ariaLabel, main, side }: RowItemProps) {
	return (
		<Link
			href={href}
			className={className ? `${styles.row} ${className}` : styles.row}
			aria-label={ariaLabel}
		>
			<div className={styles.main}>{main}</div>
			<div className={styles.side}>{side}</div>
		</Link>
	);
}
