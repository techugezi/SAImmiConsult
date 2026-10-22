/*
DOC NAME: CaseEditGuard.tsx
LOCATION: /src/components/admin/CaseEditGuard.tsx
SCOPE: Admin guard that locks/unlocks a form section; supports custom lock conditions (not only activation).
STATUS: UNLOCKED (lock after approved)
*/

"use client";

import * as React from "react";

type Props = {
	caseId: string;
	isActivated: boolean;
	isClosed: boolean;

	/**
	 * Optional: override the default lock behavior.
	 * - If omitted: locks when isActivated === true (existing behavior)
	 * - If provided: locks when lockWhen === true
	 */
	lockWhen?: boolean;

	/**
	 * Optional: separate storage keys per panel (recommended).
	 * Default matches existing behavior.
	 */
	storageKeyPrefix?: string;

	lockedTitle: string;
	lockedBody: string;
	unlockLabel: string;
	arrowLabel: string;

	noticeClassName?: string;
	noticeActionsClassName?: string;
	arrowClassName?: string;
	fieldsetLockedClassName?: string;

	children: React.ReactNode;
};

export default function CaseEditGuard({
	caseId,
	isActivated,
	isClosed,

	lockWhen,
	storageKeyPrefix,

	lockedTitle,
	lockedBody,
	unlockLabel,
	arrowLabel,

	noticeClassName,
	noticeActionsClassName,
	arrowClassName,
	fieldsetLockedClassName,

	children,
}: Props) {
	const effectiveLockWhen = typeof lockWhen === "boolean" ? lockWhen : Boolean(isActivated);
	const storageKey = `${storageKeyPrefix ?? "admin_case_unlock"}:${caseId}`;

	const [isLocked, setIsLocked] = React.useState<boolean>(Boolean(effectiveLockWhen));

	React.useEffect(() => {
		if (!effectiveLockWhen) {
			setIsLocked(false);
			return;
		}
		const v = sessionStorage.getItem(storageKey);
		setIsLocked(v !== "1");
	}, [effectiveLockWhen, storageKey]);

	const unlock = React.useCallback(() => {
		sessionStorage.setItem(storageKey, "1");
		setIsLocked(false);
	}, [storageKey]);

	const formLocked = Boolean(isClosed) || (Boolean(effectiveLockWhen) && Boolean(isLocked));

	return (
		<>
			{effectiveLockWhen && isLocked && !isClosed ? (
				<div className={noticeClassName}>
					<p className="text-md text-bold" style={{ margin: 0 }}>
						{lockedTitle}
					</p>
					<p className="text-sm text-muted" style={{ margin: 0 }}>
						{lockedBody}
					</p>

					<div className={noticeActionsClassName}>
						<button type="button" className="button button-secondary" onClick={unlock}>
							{unlockLabel}
							<span className={arrowClassName} aria-hidden="true">
								{arrowLabel}
							</span>
						</button>
					</div>
				</div>
			) : null}

			<fieldset
				disabled={formLocked}
				className={formLocked ? fieldsetLockedClassName : undefined}
			>
				{children}
			</fieldset>
		</>
	);
}
