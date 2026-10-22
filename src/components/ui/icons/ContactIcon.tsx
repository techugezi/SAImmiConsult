/*
DOC NAME: ContactIcon.tsx
LOCATION: /src/components/ui/icons/ContactIcon.tsx
SCOPE: Shared contact method icon (email/whatsapp/telegram) for consistent UI across pages.
STATUS: UNLOCKED (lock after verified)
*/

import type * as React from "react";

type ContactMethod = "email" | "whatsapp" | "telegram";

export default function ContactIcon({ method }: { method: ContactMethod }) {
	if (method === "email") {
		return (
			<svg
				aria-hidden="true"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="M4 4h16v16H4z" />
				<path d="m4 6 8 7 8-7" />
			</svg>
		);
	}

	if (method === "whatsapp") {
		return (
			<svg
				aria-hidden="true"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="M21 11.5a8.5 8.5 0 0 1-12.7 7.4L3 20l1.2-4.7A8.5 8.5 0 1 1 21 11.5z" />
				<path d="M8.5 9.5c1 2 2.5 3.5 4.5 4.5" />
			</svg>
		);
	}

	// telegram
	return (
		<svg
			aria-hidden="true"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M22 2 11 13" />
			<path d="M22 2 15 22l-4-9-9-4 20-7z" />
		</svg>
	);
}
