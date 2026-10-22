/*
DOC NAME: DocSelectionNonPendingFlag.tsx
LOCATION: /src/components/admin/DocSelectionNonPendingFlag.tsx
SCOPE: Client helper that flags when selected documents include any non-pending status (drives confirm modal).
STATUS: UNLOCKED (lock after verified)
*/

"use client";

import * as React from "react";

type Props = {
	formId: string;
	checkboxName: string; // e.g. "documentIds"
	outputName: string; // e.g. "hasNonPendingSelection"
};

function computeFlag(form: HTMLFormElement, checkboxName: string) {
	const nodes = Array.from(
		form.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${checkboxName}"]`),
	);

	for (const n of nodes) {
		if (!n.checked) continue;

		const status = (n.dataset.status ?? "").trim().toLowerCase();
		if (status.length > 0 && status !== "pending") return "1";
	}

	return "0";
}

export default function DocSelectionNonPendingFlag({ formId, checkboxName, outputName }: Props) {
	React.useEffect(() => {
		const form = document.getElementById(formId) as HTMLFormElement | null;
		if (!form) return;

		const hidden = form.querySelector<HTMLInputElement>(`input[type="hidden"][name="${outputName}"]`);
		if (!hidden) return;

		const sync = () => {
			hidden.value = computeFlag(form, checkboxName);
		};

		sync();
		form.addEventListener("change", sync);

		return () => {
			form.removeEventListener("change", sync);
		};
	}, [formId, checkboxName, outputName]);

	return null;
}
