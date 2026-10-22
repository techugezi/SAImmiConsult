/*
DOC NAME: ApplicationStatusGuardrails.tsx
LOCATION: /src/components/admin/ApplicationStatusGuardrails.tsx
SCOPE: Generic live guardrails for AdminApplications forms (watches a field value and renders value-specific guidance).
STATUS: UNLOCKED (lock after approved)
*/

"use client";

import * as React from "react";

type MessageMap = Record<string, string>;

type Props = {
	formId: string;
	fieldName: string;

	title: string;
	defaultBody: string;

	bodiesByValue: MessageMap;

	className?: string;
	titleClassName?: string;
	bodyClassName?: string;
};

function readFieldValue(form: HTMLFormElement, fieldName: string) {
	const el = form.elements.namedItem(fieldName);
	if (!el) return "";

	if (el instanceof HTMLSelectElement) return (el.value ?? "").toString();
	if (el instanceof HTMLInputElement) return (el.value ?? "").toString();
	if (el instanceof HTMLTextAreaElement) return (el.value ?? "").toString();

	// RadioNodeList is possible for repeated names.
	// Keep it safe + minimal: attempt to read `.value` if present.
	const anyEl = el as any;
	const v = typeof anyEl?.value === "string" ? anyEl.value : "";
	return (v ?? "").toString();
}

export default function ApplicationStatusGuardrails({
	formId,
	fieldName,
	title,
	defaultBody,
	bodiesByValue,
	className,
	titleClassName,
	bodyClassName,
}: Props) {
	const [value, setValue] = React.useState<string>("");

	React.useEffect(() => {
		const form = document.getElementById(formId) as HTMLFormElement | null;
		if (!form) return;

		const compute = () => {
			const next = readFieldValue(form, fieldName).trim();
			setValue(next);
		};

		compute();
		form.addEventListener("input", compute);
		form.addEventListener("change", compute);

		return () => {
			form.removeEventListener("input", compute);
			form.removeEventListener("change", compute);
		};
	}, [formId, fieldName]);

	const body =
		(value.length > 0 && typeof bodiesByValue[value] === "string" && bodiesByValue[value].trim().length > 0)
			? bodiesByValue[value]
			: defaultBody;

	return (
		<div className={className}>
			<p className={titleClassName ?? "form-label"} style={{ margin: 0 }}>
				{title}
			</p>
			<p className={bodyClassName ?? "text-sm text-muted"} style={{ margin: 0 }}>
				{body}
			</p>
		</div>
	);
}
