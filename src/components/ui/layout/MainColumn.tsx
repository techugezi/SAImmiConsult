/*
DOC NAME: MainColumn.tsx
LOCATION: /src/components/ui/layout/MainColumn.tsx
SCOPE: Layout primitive wrapper (composition only)
STATUS: UNLOCKED (was LOCKED; unlock approved to support className passthrough)
APPLIES TO: Any page using <MainColumn />
NOTES:
- Must remain a thin wrapper around layout.module.css column + global .stack.
- No typography, color, or spacing logic in TSX (spacing controlled via global .stack and tokens).
- Supports optional className passthrough for wrapper-level layout overrides (e.g., overlap).
CONTENT:
*/

import type React from "react";
import styles from "./layout.module.css";

type Props = {
	children: React.ReactNode;
	className?: string;
};

export function MainColumn({ children, className }: Props) {
	const extra = typeof className === "string" ? className.trim() : "";
	const composed = extra.length > 0 ? `${styles.column} stack ${extra}` : `${styles.column} stack`;

	return <div className={composed}>{children}</div>;
}
