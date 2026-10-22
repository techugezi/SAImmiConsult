/*
DOC NAME: ToastHost.tsx
LOCATION: /src/components/ui/ToastHost.tsx
SCOPE: Query-driven toast renderer; clears one-time query keys without moving scroll position.
STATUS: UNLOCKED
*/

"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type ToastTone = "success" | "error" | "warning" | "info";

export type ToastPayload = {
	tone: ToastTone;
	title: string;
	body?: string;
	sticky?: boolean; // errors typically sticky
	clearQueryKeys?: string[]; // keys to remove after showing once (do NOT include "open")
	durationMs?: number; // overrides default auto-dismiss duration
};

export default function ToastHost({
	toast,
	classNames,
	labels,
}: {
	toast: ToastPayload | null;
	classNames: {
		host: string;
		toast: string;
		top: string;
		titleRow: string;
		icon: string;
		title: string;
		body: string;
		close: string;
		toneSuccess: string;
		toneError: string;
		toneWarning: string;
		toneInfo: string;
	};
	labels: {
		regionAriaLabel: string; // i18n
		closeButtonAriaLabel: string; // i18n
	};
}) {
	const router = useRouter();
	const pathname = usePathname();
	const sp = useSearchParams();

	const [visible, setVisible] = React.useState(Boolean(toast));

	React.useEffect(() => {
		if (!toast) return;

		setVisible(true);

		// Auto-dismiss only for non-sticky toasts
		let t: number | null = null;
		if (!toast.sticky) {
			const ms = typeof toast.durationMs === "number" ? toast.durationMs : 12000;
			t = window.setTimeout(() => setVisible(false), ms);
		}

		// Strip query keys that created the toast so refresh doesn't repeat it.
		// IMPORTANT: do NOT strip "open" (panel expansion behavior depends on it).
		// IMPORTANT: do NOT scroll on replace, otherwise the page "jumps" after saves.
		const keys = toast.clearQueryKeys ?? [];
		if (keys.length > 0) {
			const next = new URLSearchParams(sp.toString());
			let changed = false;

			for (const k of keys) {
				if (next.has(k)) {
					next.delete(k);
					changed = true;
				}
			}

			if (changed) {
				const qs = next.toString();
				const href = qs.length > 0 ? `${pathname}?${qs}` : pathname;
				router.replace(href, { scroll: false });
			}
		}

		return () => {
			if (t) window.clearTimeout(t);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [toast]);

	if (!toast || !visible) return null;

	const toneClass =
		toast.tone === "success"
			? classNames.toneSuccess
			: toast.tone === "error"
				? classNames.toneError
				: toast.tone === "warning"
					? classNames.toneWarning
					: classNames.toneInfo;

	const ariaRole = toast.tone === "error" ? "alert" : "status";
	const ariaLive = toast.tone === "error" ? "assertive" : "polite";

	return (
		<div className={classNames.host} role="region" aria-label={labels.regionAriaLabel}>
			<div className={`${classNames.toast} ${toneClass}`} role={ariaRole} aria-live={ariaLive}>
				<div className={classNames.top}>
					<div className={classNames.titleRow}>
						<span className={classNames.icon} aria-hidden="true" />
						<p className={classNames.title}>{toast.title}</p>
					</div>

					<button
						type="button"
						className={classNames.close}
						onClick={() => setVisible(false)}
						aria-label={labels.closeButtonAriaLabel}
					>
						×
					</button>
				</div>

				{toast.body ? <p className={classNames.body}>{toast.body}</p> : null}
			</div>
		</div>
	);
}
