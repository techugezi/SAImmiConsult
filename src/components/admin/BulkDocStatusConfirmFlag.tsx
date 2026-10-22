/*
DOC NAME: BulkDocStatusConfirmFlag.tsx
LOCATION: /src/components/admin/BulkDocStatusConfirmFlag.tsx
SCOPE: Client helper that sets a hidden confirm flag when user attempts to change status on any selected non-pending document.
STATUS: UNLOCKED (lock after verified)
*/

"use client";

import * as React from "react";

type ClientDocumentStatus = "pending" | "approved" | "resubmit" | "rejected";

type Props = {
	formId: string;
	checkboxName: string;
	statusSelectName: string;
	statusByDocType: Record<string, ClientDocumentStatus>;
	outputName: string;
};

function computeFlag(
	form: HTMLFormElement,
	checkboxName: string,
	statusSelectName: string,
	statusByDocType: Record<string, ClientDocumentStatus>,
) {
	const target = form.querySelector<HTMLSelectElement>(`select[name="${statusSelectName}"]`)?.value ?? "";

	const checked = Array.from(
		form.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${checkboxName}"]:checked`),
	)
		.map((n) => n.value.trim())
		.filter((v) => v.length > 0);

	for (const docTypeId of checked) {
		const current = statusByDocType[docTypeId];
		if (!current) continue;

		if (current !== "pending" && target.length > 0 && target !== current) {
			return "1";
		}
	}

	return "0";
}

export default function BulkDocStatusConfirmFlag({
	formId,
	checkboxName,
	statusSelectName,
	statusByDocType,
	outputName,
}: Props) {
	React.useEffect(() => {
		const form = document.getElementById(formId) as HTMLFormElement | null;
		if (!form) return;

		const hidden = form.querySelector<HTMLInputElement>(`input[type="hidden"][name="${outputName}"]`);
		if (!hidden) return;

		const sync = () => {
			hidden.value = computeFlag(form, checkboxName, statusSelectName, statusByDocType);
		};

		sync();

		form.addEventListener("change", sync);
		form.addEventListener("input", sync);

		return () => {
			form.removeEventListener("change", sync);
			form.removeEventListener("input", sync);
		};
	}, [formId, checkboxName, statusSelectName, statusByDocType, outputName]);

	return null;
}
