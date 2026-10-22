/*
DOC NAME: GuardedSubmitButton.tsx
LOCATION: /src/components/admin/GuardedSubmitButton.tsx
SCOPE: Client-side guarded submit button (dirty locking + required-field gating + confirm modal).
STATUS: UNLOCKED (lock after approved)
*/

"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { createPortal } from "react-dom";

import confirmStyles from "@/components/ui/ConfirmDialog.module.css";

type ConditionalRequired = {
	whenFieldName: string;
	whenValue: string;
	requiredFieldNames: string[];
};

type ConfirmWhenFieldChanged = {
	fieldName: string;
	requireNonEmpty?: boolean;
};

type ConfirmWhenFieldsChanged = {
	fieldNames: string[];
	requireNonEmpty?: boolean;
	onlyWhenFieldUnchanged?: string;
};

type Props = {
	/**
	 * Fields that must be non-empty before submit is enabled.
	 * Optional for safety/back-compat: defaults to [].
	 */
	requiredFieldNames?: string[];

	/**
	 * Optional: If ANY of these fields is non-empty, allow submit (still respects
	 * lockUntilDirty + conditionalRequired).
	 * Use this for cases like “notes should unguard CTA when typed”.
	 */
	unlockOnNonEmptyFieldNames?: string[];

	formId: string;

	conditionalRequired?: ConditionalRequired;

	className?: string;
	label: string;
	pendingLabel?: string;
	arrowClassName?: string;
	arrowLabel?: string;

	lockUntilDirty?: boolean;
	disabled?: boolean;

	confirmTitle?: string;
	confirmCancelLabel?: string;
	confirmContinueLabel?: string;

	/**
	 * Back-compat generic confirm message.
	 * Used as fallback when more specific messages are not provided.
	 */
	confirmMessage?: string;

	/** Confirm when submitting dirty changes on an activated case. */
	confirmOnActivatedDirty?: boolean;
	confirmMessageActivatedDirty?: string;

	/** Confirm when a specific field changed. */
	confirmWhenFieldChanged?: ConfirmWhenFieldChanged;
	confirmMessageFieldChanged?: string;

	/** Confirm on any dirty submit (useful for checklists). */
	confirmOnDirty?: boolean;
	confirmMessageOnDirty?: string;

	/** Confirm when any of these fields change (e.g. scheduling fields). */
	confirmWhenFieldsChanged?: ConfirmWhenFieldsChanged;
	confirmMessageOnFieldsChanged?: string;

	isActivated?: boolean;
	isCaseClosed?: boolean;
};

function isNonEmpty(v: FormDataEntryValue | null) {
	if (typeof v !== "string") return false;
	return v.trim().length > 0;
}

function normalizeEntry(v: FormDataEntryValue) {
	if (typeof v !== "string") return "";
	return v.trim();
}

function snapshotForm(form: HTMLFormElement) {
	const fd = new FormData(form);
	const map = new Map<string, string[]>();

	for (const [k, v] of fd.entries()) {
		if (k === "caseId" || k === "locale") continue;
		const s = normalizeEntry(v);
		const arr = map.get(k) ?? [];
		arr.push(s);
		map.set(k, arr);
	}

	const flat: Record<string, string> = {};
	for (const [k, arr] of map.entries()) {
		flat[k] = arr.join("\u0000");
	}

	return flat;
}

function isDirty(a: Record<string, string>, b: Record<string, string>) {
	const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
	for (const k of keys) {
		if ((a[k] ?? "") !== (b[k] ?? "")) return true;
	}
	return false;
}

export default function GuardedSubmitButton({
	formId,
	requiredFieldNames = [],
	unlockOnNonEmptyFieldNames = [],
	conditionalRequired,
	className,
	label,
	pendingLabel,
	arrowClassName,
	arrowLabel,

	lockUntilDirty = false,
	disabled,

	confirmTitle,
	confirmCancelLabel,
	confirmContinueLabel,

	confirmMessage,

	confirmOnActivatedDirty = false,
	confirmMessageActivatedDirty,

	confirmWhenFieldChanged,
	confirmMessageFieldChanged,

	confirmOnDirty = false,
	confirmMessageOnDirty,

	confirmWhenFieldsChanged,
	confirmMessageOnFieldsChanged,

	isActivated,
	isCaseClosed,
}: Props) {
	const { pending } = useFormStatus();

	// ✅ IMPORTANT: start locked until we have computed actual form state
	const [canSubmit, setCanSubmit] = React.useState(false);

	const [dirty, setDirty] = React.useState(false);
	const [watchedFieldChanged, setWatchedFieldChanged] = React.useState(false);
	const [watchedFieldsChanged, setWatchedFieldsChanged] = React.useState(false);

	const [confirmOpen, setConfirmOpen] = React.useState(false);
	const bypassConfirmOnceRef = React.useRef(false);

	const initialSnapshotRef = React.useRef<Record<string, string> | null>(null);

	const continueBtnRef = React.useRef<HTMLButtonElement | null>(null);
	const previouslyFocusedRef = React.useRef<HTMLElement | null>(null);

	const [confirmBody, setConfirmBody] = React.useState<string>("");

	React.useEffect(() => {
		const form = document.getElementById(formId) as HTMLFormElement | null;
		if (!form) return;

		if (!initialSnapshotRef.current) {
			initialSnapshotRef.current = snapshotForm(form);
			setDirty(false);
			setWatchedFieldChanged(false);
			setWatchedFieldsChanged(false);
		}

		const compute = () => {
			const fd = new FormData(form);

			const baseRequiredOk = requiredFieldNames.every((name) => {
				const all = fd.getAll(name);
				if (all.length > 1) return true;
				if (all.length === 1) return isNonEmpty(all[0]);
				return false;
			});

			const unlockedByNonEmpty = unlockOnNonEmptyFieldNames.some((name) => {
				const all = fd.getAll(name);
				if (all.length > 1) {
					return all.some((v) => isNonEmpty(v));
				}
				if (all.length === 1) return isNonEmpty(all[0]);
				return false;
			});

			// “Either base required fields are valid OR user has typed into an unlock field”
			const baseOk = baseRequiredOk || unlockedByNonEmpty;

			let conditionalOk = true;
			if (conditionalRequired) {
				const current = fd.get(conditionalRequired.whenFieldName);
				const currentValue = typeof current === "string" ? current.trim() : "";
				if (currentValue === conditionalRequired.whenValue) {
					conditionalOk = conditionalRequired.requiredFieldNames.every((name) =>
						isNonEmpty(fd.get(name)),
					);
				}
			}

			setCanSubmit(baseOk && conditionalOk);

			if (initialSnapshotRef.current) {
				const now = snapshotForm(form);
				const start = initialSnapshotRef.current;

				const nowDirty = isDirty(start, now);
				setDirty(nowDirty);

				if (confirmWhenFieldChanged?.fieldName) {
					const name = confirmWhenFieldChanged.fieldName;
					const before = start[name] ?? "";
					const after = now[name] ?? "";
					const requireNonEmpty = confirmWhenFieldChanged.requireNonEmpty !== false;

					const changed =
						before !== after && (!requireNonEmpty || (after ?? "").trim().length > 0);

					setWatchedFieldChanged(changed);
				} else {
					setWatchedFieldChanged(false);
				}

				if (confirmWhenFieldsChanged?.fieldNames?.length) {
					const requireNonEmpty = confirmWhenFieldsChanged.requireNonEmpty === true;

					let controllerUnchangedOk = true;
					if (confirmWhenFieldsChanged.onlyWhenFieldUnchanged) {
						const ctrl = confirmWhenFieldsChanged.onlyWhenFieldUnchanged;
						controllerUnchangedOk = (start[ctrl] ?? "") === (now[ctrl] ?? "");
					}

					const changed =
						controllerUnchangedOk &&
						confirmWhenFieldsChanged.fieldNames.some((name) => {
							const before = start[name] ?? "";
							const after = now[name] ?? "";
							if (before === after) return false;
							if (!requireNonEmpty) return true;
							return after.trim().length > 0;
						});

					setWatchedFieldsChanged(changed);
				} else {
					setWatchedFieldsChanged(false);
				}
			}
		};

		compute();
		form.addEventListener("input", compute);
		form.addEventListener("change", compute);

		return () => {
			form.removeEventListener("input", compute);
			form.removeEventListener("change", compute);
		};
	}, [
		formId,
		requiredFieldNames,
		unlockOnNonEmptyFieldNames,
		conditionalRequired,
		confirmWhenFieldChanged,
		confirmWhenFieldsChanged,
	]);

	const lockedByPristine = Boolean(lockUntilDirty) && !dirty;
	const isDisabled = Boolean(disabled) || pending || !canSubmit || lockedByPristine;

	const pickConfirmBody = () => {
		// 1) Specific field changed (e.g. final_application_type, next_case_status)
		if (confirmWhenFieldChanged && watchedFieldChanged) {
			const msg = (confirmMessageFieldChanged ?? confirmMessage ?? "").trim();
			return msg;
		}

		// 2) Any of a set of fields changed (e.g. scheduling details)
		if (confirmWhenFieldsChanged && watchedFieldsChanged) {
			const msg = (confirmMessageOnFieldsChanged ?? confirmMessage ?? "").trim();
			return msg;
		}

		// 3) Activated + dirty guard
		if (confirmOnActivatedDirty && Boolean(isActivated) && Boolean(dirty)) {
			const msg = (confirmMessageActivatedDirty ?? confirmMessage ?? "").trim();
			return msg;
		}

		// 4) Generic dirty guard
		if (confirmOnDirty && Boolean(dirty)) {
			const msg = (confirmMessageOnDirty ?? confirmMessage ?? "").trim();
			return msg;
		}

		return "";
	};

	const shouldConfirm =
		!isDisabled &&
		!bypassConfirmOnceRef.current &&
		!Boolean(isCaseClosed) &&
		(() => {
			const body = pickConfirmBody();
			return body.length > 0;
		})();

	const onClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
		if (!shouldConfirm) return;

		e.preventDefault();
		e.stopPropagation();

		const body = pickConfirmBody();
		setConfirmBody(body);
		setConfirmOpen(true);
	};

	const submitAfterConfirm = () => {
		const form = document.getElementById(formId) as HTMLFormElement | null;
		if (!form) {
			setConfirmOpen(false);
			return;
		}

		bypassConfirmOnceRef.current = true;
		setConfirmOpen(false);

		form.requestSubmit();

		window.setTimeout(() => {
			bypassConfirmOnceRef.current = false;
		}, 0);
	};

	React.useEffect(() => {
		if (!confirmOpen) return;

		previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		const raf = window.requestAnimationFrame(() => {
			continueBtnRef.current?.focus();
		});

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") setConfirmOpen(false);
		};
		window.addEventListener("keydown", onKeyDown);

		return () => {
			window.cancelAnimationFrame(raf);
			window.removeEventListener("keydown", onKeyDown);
			document.body.style.overflow = prevOverflow;

			previouslyFocusedRef.current?.focus?.();
			previouslyFocusedRef.current = null;
		};
	}, [confirmOpen]);

	const triggerClassName =
		typeof className === "string" && className.trim().length > 0 ? className : "button button-primary";

	const cancelBtnClassName = `button button-secondary ${confirmStyles.secondaryButton}`;
	const continueBtnClassName = `${triggerClassName} ${confirmStyles.primaryButton}`;

	const modal = confirmOpen ? (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby={`${formId}-confirm-title`}
			className={confirmStyles.overlay}
		>
			<button
				type="button"
				className={confirmStyles.backdrop}
				aria-label={confirmCancelLabel ?? "Cancel"}
				onClick={() => setConfirmOpen(false)}
			/>

			<div className={`surface-soft ${confirmStyles.panel}`}>
				<p id={`${formId}-confirm-title`} className={`text-md text-bold ${confirmStyles.title}`}>
					{confirmTitle}
				</p>

				<p className={`text-sm text-muted ${confirmStyles.body}`}>{confirmBody}</p>

				<div className={confirmStyles.actions}>
					<button
						type="button"
						onClick={() => setConfirmOpen(false)}
						className={cancelBtnClassName}
					>
						{confirmCancelLabel}
					</button>

					<button
						type="button"
						onClick={submitAfterConfirm}
						className={continueBtnClassName}
						ref={continueBtnRef}
					>
						{confirmContinueLabel}
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

	return (
		<>
			<button type="submit" className={triggerClassName} disabled={isDisabled} onClick={onClick}>
				{pending ? (pendingLabel ?? label) : label}
				{arrowLabel ? (
					<span className={arrowClassName} aria-hidden="true">
						{arrowLabel}
					</span>
				) : null}
			</button>

			{typeof document !== "undefined" && modal ? createPortal(modal, document.body) : null}
		</>
	);
}
