/*
DOC NAME: NewCaseCTA.tsx
LOCATION: /src/components/ui/NewCaseCTA.tsx
SCOPE: Client CTA button that optionally shows a confirm dialog before navigating.
STATUS: UNLOCKED (lock after verified)
*/

"use client";

import * as React from "react";
import type { ComponentProps } from "react";
import { Link, useRouter } from "@/i18n/navigation";

import ConfirmDialog from "@/components/ui/ConfirmDialog";

type RouterInstance = ReturnType<typeof useRouter>;
type RouterPushHref = Parameters<RouterInstance["push"]>[0];

// Keep Link href typing available for consumers (optional)
type AppLinkHref = ComponentProps<typeof Link>["href"];

type Props = {
	// IMPORTANT: match router.push expected href exactly (stricter than Link href)
	href: RouterPushHref;

	label: string;

	shouldConfirm: boolean;
	confirmTitle: string;
	confirmBody: string;

	cancelLabel: string;
	confirmLabel: string;
	arrowLabel: string;
};

function normalizeHref(href: RouterPushHref): RouterPushHref {
	// next-intl typed router expects query to be undefined or QueryParams (not null)
	if (typeof href === "object" && href) {
		const anyHref: any = href;
		if ("query" in anyHref && anyHref.query === null) {
			const { query, ...rest } = anyHref;
			return rest as RouterPushHref;
		}
	}
	return href;
}

export default function NewCaseCTA({
	href,
	label,
	shouldConfirm,
	confirmTitle,
	confirmBody,
	cancelLabel,
	confirmLabel,
	arrowLabel,
}: Props) {
	const router = useRouter();
	const [open, setOpen] = React.useState(false);

	const onClick = () => {
		if (!shouldConfirm) {
			router.push(normalizeHref(href));
			return;
		}
		setOpen(true);
	};

	const onCancel = () => setOpen(false);

	const onConfirm = () => {
		setOpen(false);
		router.push(normalizeHref(href));
	};

	return (
		<>
			<button type="button" className="button button-primary" onClick={onClick}>
				{label}
			</button>

			<ConfirmDialog
				open={open}
				title={confirmTitle}
				body={confirmBody}
				cancelLabel={cancelLabel}
				confirmLabel={confirmLabel}
				arrowLabel={arrowLabel}
				onCancel={onCancel}
				onConfirm={onConfirm}
				cancelButtonClassName="button button-secondary"
				confirmButtonClassName="button button-primary"
			/>
		</>
	);
}
