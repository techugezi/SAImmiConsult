/*
DOC NAME: FormFieldLock.tsx
LOCATION: /src/components/ui/FormFieldLock.tsx
SCOPE: Client helper to disable specific form controls based on a controller field value, with optional hidden mirrors to preserve submitted values.
STATUS: UNLOCKED (lock after approved)
*/

"use client";

import * as React from "react";

type Props = {
	formId: string;
	controllerName: string;
	disableWhenValues: string[];
	targetNames: string[];
};

function isControllerEl(el: Element | null): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
	return (
		el instanceof HTMLInputElement ||
		el instanceof HTMLSelectElement ||
		el instanceof HTMLTextAreaElement
	);
}

function readValue(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
	return typeof el.value === "string" ? el.value : "";
}

export default function FormFieldLock({
	formId,
	controllerName,
	disableWhenValues,
	targetNames,
}: Props) {
	React.useEffect(() => {
		const form = document.getElementById(formId) as HTMLFormElement | null;
		if (!form) return;

		const controller = form.querySelector(`[name="${controllerName}"]`);
		if (!isControllerEl(controller)) return;

		const apply = () => {
			const controllerValue = readValue(controller).trim();
			const locked = disableWhenValues.includes(controllerValue);

			for (const name of targetNames) {
				const primary = form.querySelector(
					`[data-guard-primary="${name}"]`,
				);
				const mirror = form.querySelector(
					`[data-guard-mirror="${name}"]`,
				);

				if (isControllerEl(primary)) {
					primary.disabled = locked;

					if (mirror instanceof HTMLInputElement) {
						mirror.disabled = !locked;
						mirror.value = readValue(primary);
					}
				}
			}
		};

		apply();

		controller.addEventListener("change", apply);
		controller.addEventListener("input", apply);

		return () => {
			controller.removeEventListener("change", apply);
			controller.removeEventListener("input", apply);
		};
	}, [formId, controllerName, disableWhenValues, targetNames]);

	return null;
}
