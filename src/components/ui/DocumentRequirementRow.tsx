/*
DOC NAME: DocumentRequirementRow.tsx
LOCATION: /src/components/ui/DocumentRequirementRow.tsx
SCOPE: DocumentRequirementRow primitive — composition only (no business logic).
STATUS: UNLOCKED
*/

import type React from "react";

import styles from "./DocumentRequirementRow.module.css";

export type DocumentRequirementUploadState = "idle" | "selected" | "uploaded";

type RequiredProps =
	| {
			required: true;
			requiredLabel: string;
	  }
	| {
			required?: false;
			requiredLabel?: string;
	  };

type Props = {
	title: string;
	description: string;
	statusLabel: string;
	statusTone?: string;
	note?: string | null;
	uploadedOnLabel: string;
	uploadedOnValue: string;
	action?: React.ReactNode;
	uploadState?: DocumentRequirementUploadState;
	showUploadedCheck?: boolean;
	needsAttention?: boolean;
} & RequiredProps;

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
						{required ? (
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