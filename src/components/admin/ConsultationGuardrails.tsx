/*
DOC NAME: ConsultationGuardrails.tsx
LOCATION: /src/components/admin/ConsultationGuardrails.tsx
SCOPE: Client-only helper that explains Consultation guardrails based on the selected status value.
STATUS: UNLOCKED (lock after approved)
*/

"use client";

import * as React from "react";

type GuardrailsContent =
	| { title: string; body: string }
	| { title: string; items: string[] };

type Props = {
	formId: string;
	fieldName: string;
	defaultValue: string;

	ariaLabel: string;

	titleLabel: string;

	requested: GuardrailsContent;
	booked: GuardrailsContent;
	completed: GuardrailsContent;

	className?: string;
	listClassName?: string;
};

function isItems(x: GuardrailsContent): x is { title: string; items: string[] } {
	return Array.isArray((x as any).items);
}

export default function ConsultationGuardrails({
	formId,
	fieldName,
	defaultValue,
	ariaLabel,
	titleLabel,
	requested,
	booked,
	completed,
	className,
	listClassName,
}: Props) {
	const [value, setValue] = React.useState<string>(defaultValue);

	React.useEffect(() => {
		const form = document.getElementById(formId) as HTMLFormElement | null;
		if (!form) return;

		const field = form.elements.namedItem(fieldName) as HTMLSelectElement | null;
		if (!field) return;

		const read = () => {
			const v = typeof field.value === "string" ? field.value.trim() : "";
			setValue(v.length > 0 ? v : defaultValue);
		};

		read();
		field.addEventListener("change", read);

		return () => {
			field.removeEventListener("change", read);
		};
	}, [formId, fieldName, defaultValue]);

	const content = (() => {
		if (value === "consultation_booked") return booked;
		if (value === "consultation_completed") return completed;
		return requested;
	})();

	return (
		<div className={className} aria-label={ariaLabel}>
			<p className="form-label" style={{ margin: 0 }}>
				{titleLabel}
			</p>

			<p className="text-md text-bold" style={{ margin: 0 }}>
				{content.title}
			</p>

			{isItems(content) ? (
				<ul className={listClassName}>
					{content.items.map((it, idx) => (
						<li key={`${idx}-${it}`}>{it}</li>
					))}
				</ul>
			) : (
				<p className="text-sm text-muted" style={{ margin: 0 }}>
					{content.body}
				</p>
			)}
		</div>
	);
}
