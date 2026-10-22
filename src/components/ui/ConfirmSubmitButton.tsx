/*
DOC NAME: ConfirmSubmitButton.tsx
LOCATION: /src/components/admin/ConfirmSubmitButton.tsx
SCOPE: Button that confirms, then submits a target form by id (used for destructive actions like closing a case).
STATUS: UNLOCKED (lock after verified)
*/

"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import confirmStyles from "@/components/ui/ConfirmDialog.module.css";

type Props = {
	formId: string;

	label: string;
	className?: string;
	disabled?: boolean;

	/**
	 * Preferred label to show while the action is in-flight (e.g., "Saving...", "Closing...").
	 * (Kept separate from the confirmContinueLabel which is the confirm button text before submit.)
	 */
	pendingLabel?: string;

	/** Back-compat (older prop name). Prefer pendingLabel going forward. */
	deletingLabel?: string;

	confirmTitle: string;
	confirmBody: string;
	confirmCancelLabel: string;
	confirmContinueLabel: string;

	/** Optional arrow label for the confirm continue button. */
	arrowLabel?: string;
	arrowClassName?: string;

	/** Optional override for cancel button styling (defaults to "button button-secondary"). */
	confirmCancelClassName?: string;

	/** Optional override for continue button styling (defaults to trigger className). */
	confirmContinueClassName?: string;
};

export default function ConfirmSubmitButton({
	formId,
	label,
	className,
	disabled,

	pendingLabel,
	deletingLabel,

	confirmTitle,
	confirmBody,
	confirmCancelLabel,
	confirmContinueLabel,

	arrowLabel,
	arrowClassName,
	confirmCancelClassName,
	confirmContinueClassName,
}: Props) {
	const [open, setOpen] = React.useState(false);
	const [submitting, setSubmitting] = React.useState(false);

	const continueBtnRef = React.useRef<HTMLButtonElement | null>(null);
	const previouslyFocusedRef = React.useRef<HTMLElement | null>(null);

	const triggerClassName =
		typeof className === "string" && className.trim().length > 0
			? className
			: "button button-primary";

	const continueBtnClassName = (() => {
		const base =
			typeof confirmContinueClassName === "string" && confirmContinueClassName.trim().length > 0
				? confirmContinueClassName
				: triggerClassName;

		// NOTE: confirmStyles.primaryButton is layout-only (no visuals)
		return `${base} ${confirmStyles.primaryButton}`;
	})();

	const cancelBtnClassName = (() => {
		const base =
			typeof confirmCancelClassName === "string" && confirmCancelClassName.trim().length > 0
				? confirmCancelClassName
				: "button button-secondary";

		// NOTE: confirmStyles.secondaryButton is layout-only (no visuals)
		return `${base} ${confirmStyles.secondaryButton}`;
	})();

	const effectivePendingLabelRaw =
		typeof pendingLabel === "string" && pendingLabel.trim().length > 0
			? pendingLabel.trim()
			: typeof deletingLabel === "string" && deletingLabel.trim().length > 0
				? deletingLabel.trim()
				: "";

	const hasPendingLabel = effectivePendingLabelRaw.length > 0;

	const close = () => {
		setOpen(false);

		// If we have a pending label, we intentionally keep `submitting=true`
		// so the trigger button can continue showing the pending text until navigation/unmount.
		if (!hasPendingLabel) {
			setSubmitting(false);
		}
	};

	const submitAfterConfirm = () => {
		const form = document.getElementById(formId) as HTMLFormElement | null;
		if (!form) {
			close();
			return;
		}

		setSubmitting(true);

		// Submit the actual target form
		form.requestSubmit();

		// Back-compat: if no pending label is provided, reset immediately (as before).
		if (!hasPendingLabel) {
			window.setTimeout(() => {
				setSubmitting(false);
			}, 0);
		}

		close();
	};

	React.useEffect(() => {
		if (!open) return;

		previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		const raf = window.requestAnimationFrame(() => {
			continueBtnRef.current?.focus();
		});

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") close();
		};

		window.addEventListener("keydown", onKeyDown);

		return () => {
			window.cancelAnimationFrame(raf);
			window.removeEventListener("keydown", onKeyDown);

			document.body.style.overflow = prevOverflow;

			previouslyFocusedRef.current?.focus?.();
			previouslyFocusedRef.current = null;
		};
	}, [open]);

	const modal = open ? (
		<div role="dialog" aria-modal="true" aria-label={confirmTitle} className={confirmStyles.overlay}>
			<button
				type="button"
				className={confirmStyles.backdrop}
				aria-label={confirmCancelLabel}
				onClick={close}
			/>

			<div className={`surface-soft ${confirmStyles.panel}`}>
				<div className={confirmStyles.header}>
					<p className={`text-md text-bold ${confirmStyles.title}`}>{confirmTitle}</p>
				</div>

				<p className={`text-sm text-muted ${confirmStyles.body}`}>{confirmBody}</p>

				<div className={confirmStyles.actions}>
					<button type="button" className={cancelBtnClassName} onClick={close}>
						{confirmCancelLabel}
					</button>

					<button
						type="button"
						className={continueBtnClassName}
						onClick={submitAfterConfirm}
						ref={continueBtnRef}
						disabled={submitting}
					>
						{submitting && hasPendingLabel ? effectivePendingLabelRaw : confirmContinueLabel}
						{arrowLabel ? (
							<span className={arrowClassName ?? confirmStyles.arrow} aria-hidden="true">
								{arrowLabel}
							</span>
						) : null}
					</button>
				</div>
			</div>
		</div>
	) : null;

	const triggerLabel = submitting && hasPendingLabel ? effectivePendingLabelRaw : label;

	return (
		<>
			<button
				type="button"
				className={triggerClassName}
				disabled={Boolean(disabled) || submitting}
				onClick={() => setOpen(true)}
			>
				{triggerLabel}
			</button>

			{typeof document !== "undefined" && modal ? createPortal(modal, document.body) : null}
		</>
	);
}
