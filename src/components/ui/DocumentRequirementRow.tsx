/*
DOC NAME: DocumentRequirementRow.tsx
LOCATION: /src/components/ui/DocumentRequirementRow.tsx
SCOPE: DocumentRequirementRow primitive — composition only (no business logic).
STATUS: UNLOCKED
*/

import type React from "react";

import styles from "./DocumentRequirementRow.module.css";

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
}: Props) {
	return (
		<div className={styles.row}>
			<div className={styles.main}>
				<div className={styles.titleLine}>
					<h3 className="text-md text-bold" style={{ margin: 0 }}>
						{title}
					</h3>

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
