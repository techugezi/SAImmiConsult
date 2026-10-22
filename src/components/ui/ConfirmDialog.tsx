/*
DOC NAME: ConfirmDialog.tsx
LOCATION: /src/components/ui/ConfirmDialog.tsx
SCOPE: Confirm dialog overlay rendered via React portal (page-level). Layout/interaction only; copy passed in from caller (i18n handled upstream).
STATUS: UNLOCKED (lock after verified)
*/

"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import styles from "./ConfirmDialog.module.css";

type Props = {
	open: boolean;

	title: string;
	body: string;

	cancelLabel: string;
	confirmLabel: string;
	arrowLabel: string;

	onCancel: () => void;
	onConfirm: () => void;

	confirmButtonClassName?: string;
	cancelButtonClassName?: string;
};

export default function ConfirmDialog({
	open,
	title,
	body,
	cancelLabel,
	confirmLabel,
	arrowLabel,
	onCancel,
	onConfirm,
	confirmButtonClassName,
	cancelButtonClassName,
}: Props) {
	const [mounted, setMounted] = React.useState(false);

	const cancelRef = React.useRef<HTMLButtonElement | null>(null);
	const panelRef = React.useRef<HTMLDivElement | null>(null);

	React.useEffect(() => {
		setMounted(true);
	}, []);

	// Lock body scroll while open
	React.useEffect(() => {
		if (!open) return;

		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		return () => {
			document.body.style.overflow = prevOverflow;
		};
	}, [open]);

	// Focus + escape
	React.useEffect(() => {
		if (!open) return;

		cancelRef.current?.focus();

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") onCancel();
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [open, onCancel]);

	if (!open || !mounted) return null;

	const content = (
		<div className={styles.overlay} role="dialog" aria-modal="true" aria-label={title}>
			<button
				type="button"
				className={styles.backdrop}
				onClick={onCancel}
				aria-label={cancelLabel}
			/>
	
			<div ref={panelRef} className={`surface-soft ${styles.panel}`}>
				<header className={styles.header}>
					<p className={`text-md text-bold ${styles.title}`}>{title}</p>
					<p className={`text-sm text-muted ${styles.body}`}>{body}</p>
				</header>

				<div className={styles.actions}>
					<button
						ref={cancelRef}
						type="button"
						className={cancelButtonClassName ?? "button button-secondary"}
						onClick={onCancel}
					>
						{cancelLabel}
					</button>

					<button
						type="button"
						className={confirmButtonClassName ?? "button button-primary"}
						onClick={onConfirm}
					>
						<span className={styles.primaryButton}>
							{confirmLabel}
							<span className={styles.arrow} aria-label={arrowLabel}>
								{arrowLabel}
							</span>
						</span>
					</button>
				</div>
			</div>
		</div>
	);

	// Critical: portal to body so it overlays the entire page (not trapped by panel stacking contexts)
	return createPortal(content, document.body);
}
