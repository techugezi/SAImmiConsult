/*
DOC NAME: ChevronIcon.tsx
LOCATION: /src/components/ui/icons/ChevronIcon.tsx
SCOPE: Reusable chevron SVG icon (visual-only). Use with global chevron classes for rotation.
STATUS: UNLOCKED
*/

import type React from "react";

type ChevronIconProps = {
	className?: string;
	title?: string;
};

export default function ChevronIcon({ className, title }: ChevronIconProps) {
	return (
		<svg
			viewBox="0 0 24 24"
			focusable="false"
			aria-hidden={title ? undefined : "true"}
			role={title ? "img" : "presentation"}
			className={className}
		>
			{title ? <title>{title}</title> : null}
			<path
				d="M6 9l6 6 6-6"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.25"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
