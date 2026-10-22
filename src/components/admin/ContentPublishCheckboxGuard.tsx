/*
DOC NAME: ContentPublishCheckboxGuard.tsx
LOCATION: /src/components/admin/ContentPublishCheckboxGuard.tsx
SCOPE: Client UI guard for publish checkbox. Enables publish only when required fields (EN+RU) are non-empty in the same form.
STATUS: UNLOCKED (lock after verified)
*/

"use client";

import * as React from "react";

type Props = {
	name: string;
	value: string;

	/**
	 * Field names (within the same <form>) that must be non-empty
	 * before the publish checkbox can be enabled.
	 */
	requiredNames: string[];

	defaultChecked?: boolean;
};

function readFieldValue(form: HTMLFormElement, fieldName: string) {
	const el = form.elements.namedItem(fieldName);
	if (!el) return "";

	// namedItem() can return RadioNodeList or an Element
	// We only need basic value extraction for input/textarea.
	const anyEl: any = el;

	if (typeof anyEl?.value === "string") return anyEl.value;

	// If it's a RadioNodeList-like object, it may still have .value
	try {
		const v = (anyEl as unknown as { value?: string })?.value;
		return typeof v === "string" ? v : "";
	} catch {
		return "";
	}
}

function allRequiredFilled(form: HTMLFormElement, requiredNames: string[]) {
	for (const n of requiredNames) {
		const v = readFieldValue(form, n);
		if (v.trim().length === 0) return false;
	}
	return true;
}

export default function ContentPublishCheckboxGuard({
	name,
	value,
	requiredNames,
	defaultChecked,
}: Props) {
	const inputRef = React.useRef<HTMLInputElement | null>(null);
	const [disabled, setDisabled] = React.useState<boolean>(true);

	React.useEffect(() => {
		const input = inputRef.current;
		const form = input?.form;
		if (!input || !form) return;

		const refresh = () => {
			const ok = allRequiredFilled(form, requiredNames);
			setDisabled(!ok);

			// If it becomes invalid, force draft mode (unchecked).
			if (!ok && input.checked) {
				input.checked = false;
			}
		};

		refresh();

		// Listen at form level so it reacts to any required field changes.
		form.addEventListener("input", refresh);
		form.addEventListener("change", refresh);

		return () => {
			form.removeEventListener("input", refresh);
			form.removeEventListener("change", refresh);
		};
	}, [requiredNames]);

	return (
		<input
			ref={inputRef}
			type="checkbox"
			name={name}
			value={value}
			defaultChecked={defaultChecked}
			disabled={disabled}
		/>
	);
}
