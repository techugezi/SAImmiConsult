/*
DOC NAME: PendingSubmitButton.tsx
LOCATION: /src/components/ui/PendingSubmitButton.tsx
SCOPE: Client submit button that shows a pending label while a server action is in-flight (useFormStatus).
STATUS: UNLOCKED (lock after verified)
*/

"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";

type Props = {
	className?: string;
	label: string;
	pendingLabel: string;
};

export default function PendingSubmitButton({ className, label, pendingLabel }: Props) {
	const { pending } = useFormStatus();

	return (
		<button type="submit" className={className} disabled={pending} aria-disabled={pending}>
			{pending ? pendingLabel : label}
		</button>
	);
}
