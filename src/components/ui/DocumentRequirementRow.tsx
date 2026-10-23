/*
DOC NAME: DocumentRequirementRow.tsx
LOCATION: /src/components/ui/DocumentRequirementRow.tsx
SCOPE: DocumentRequirementRow primitive — composition only (no business logic).
STATUS: UNLOCKED
*/

import type React from "react";

import styles from "./DocumentRequirementRow.module.css";

export type DocumentRequirementUploadState = "idle" | "selected" | "uploaded";

type Props = {
	title: string;
	description: string;

	/**
	 * Status badge (ex: "Approved", "Missing", "Resubmit")
	 */
	statusLabel: string;

	/**
	 * Global badge tone class (ex: "badge-success" | "badge-caution" | "badge-neutral")
	 * Matches IdentityCards badge usage.
	 */
	statusTone?: string;

	/**
	 * Optional note line under description
	 */
	note?: string | null;

	uploadedOnLabel: string;
	uploadedOnValue: string;

	action?: React.ReactNode;

	/**
	 * Visual state of the row, driven by the client wrapper.
	 * - "idle": no file picked, nothing uploaded
	 * - "selected": a file is picked but upload has not succeeded yet
	 * - "uploaded": upload succeeded (or document already persisted as uploaded)
	 */
	uploadState?: DocumentRequirementUploadState;

	/**
	 * When true, renders the green check circle next to the title.
	 */
	showUploadedCheck?: boolean;

	/**
	 * When true, the row is tinted protea pink to signal "needs attention"
	 * (e.g. reviewer flagged it for resubmission). This override wins over
	 * `uploadState` for the row tint — the check circle is still suppressed
	 * because the review cycle isn't complete.
	 */
	needsAttention?: boolean;

	/**
	 * When true, renders the "Required" badge. The corresponding
	 * `requiredLabel` is only used when this is true.
	 */
	required?: boolean;

	/**
	 * Label for the "Required" badge. Safe to pass regardless of `required`.
	 */
	requiredLabel?: string;
};

export default function DocumentRequirementRow({
	title,
	description,
	required,
	requiredLabel,
	statusLabel,
	statusTone = "badge-neutral",
	note,
	uploadedOnLabel,
	uploadedOnValue,
	action,
	uploadState = "idle",
	showUploadedCheck = false,
	needsAttention = false,
}: Props) {
	const rowStateClass = needsAttention
		? styles.rowNeedsAttention
		: uploadState === "selected"
			? styles.rowSelected
			: uploadState === "uploaded"
				? styles.rowUploaded
				: "";

	const showCheck = showUploadedCheck && !needsAttention;

	return (
		<div
			className={[styles.row, rowStateClass].filter(Boolean).join(" ")}
			data-upload-state={
				needsAttention ? "needs-attention" : uploadState
			}
		>
			<div className={styles.main}>
				<div className={styles.titleLine}>
					<h3 className="text-md text-bold" style={{ margin: 0 }}>
						{title}
					</h3>

					{showCheck ? (
						<span
							className={styles.uploadedCheck}
							role="img"
							aria-label="Uploaded"
						>
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth={3}
								strokeLinecap="round"
								strokeLinejoin="round"
								aria-hidden="true"
							>
								<polyline points="20 6 9 17 4 12" />
							</svg>
						</span>
					) : null}

					<div className={styles.badges}>
						{required && requiredLabel ? (
							<span className="badge badge-neutral">
								<span>{requiredLabel}</span>
							</span>
						) : null}

						<span className={`badge ${statusTone}`}>
							<span>{statusLabel}</span>
						</span>
					</div>
				</div>

				<p className="text-sm text-muted" style={{ margin: 0 }}>
					{description}
				</p>

				{note ? (
					<p className="text-sm text-muted" style={{ margin: 0 }}>
						{note}
					</p>
				) : null}

				<p className="text-sm text-muted" style={{ margin: 0 }}>
					{uploadedOnLabel} {uploadedOnValue}
				</p>
			</div>

			<div className={styles.side}>
				{action ? <div className={styles.actionSlot}>{action}</div> : null}
			</div>
		</div>
	);
}