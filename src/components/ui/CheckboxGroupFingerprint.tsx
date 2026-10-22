/*
DOC NAME: CheckboxGroupFingerprint.tsx
LOCATION: /src/components/ui/CheckboxGroupFingerprint.tsx
SCOPE: Client helper that writes a stable fingerprint for a checkbox group into a hidden input for guards/confirmations.
STATUS: LOCKED
*/

"use client";

import * as React from "react";

type Props = {
	formId: string;
	checkboxName: string;
	outputName: string;
};

function computeFingerprint(form: HTMLFormElement, checkboxName: string) {
	const nodes = Array.from(
		form.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${checkboxName}"]`),
	);

	const checkedValues = nodes
		.filter((n) => n.checked)
		.map((n) => n.value.trim())
		.filter((v) => v.length > 0)
		.sort();

	return checkedValues.join("|");
}

export default function CheckboxGroupFingerprint({ formId, checkboxName, outputName }: Props) {
	React.useEffect(() => {
		const form = document.getElementById(formId) as HTMLFormElement | null;
		if (!form) return;

		const hidden = form.querySelector<HTMLInputElement>(`input[type="hidden"][name="${outputName}"]`);
		if (!hidden) return;

		const sync = () => {
			hidden.value = computeFingerprint(form, checkboxName);
		};

		// initial
		sync();

		// keep light: one listener on the form
		form.addEventListener("change", sync);
		return () => {
			form.removeEventListener("change", sync);
		};
	}, [formId, checkboxName, outputName]);

	return null;
}
