/*
DOC NAME: DocumentReviewTable.tsx
LOCATION: /src/components/admin/DocumentReviewTable.tsx
SCOPE: Client-side table to review latest uploaded documents per requirement (status + notes) with strict selection guards.
STATUS: UNLOCKED (lock after verified)
*/

"use client";

import * as React from "react";

import { getDocumentUiMeta, DOCUMENT_STATUS, type DocumentStatusId } from "@/config/statuses";
import styles from "./DocumentReviewTable.module.css";

export type DocumentReviewRow = {
	documentTypeId: string;

	label: string;
	description: string;

	// latest doc snapshot (per document_type_id, latest = max copy_number)
	hasDoc: boolean;
	copyNumber: number | null;
	uploadedAtLabel: string;

	driveLink: string | null;
	driveLinkMissing: boolean;

	status: StatusSelectValue | "missing";
	notes: string;
};

type StatusSelectValue = (typeof DOCUMENT_STATUS)[keyof typeof DOCUMENT_STATUS];
type StatusLabels = Record<StatusSelectValue | "missing", string>;

type Labels = {
	title: string;
	subtitle: string;

	selectHelp: string;

	columns: {
		requirement: string;
		status: string;
		notes: string;
		file: string;
	};

	actions: {
		openFile: string;
		noFile: string;
	};

	statusLabels: StatusLabels;

	aria: {
		selectRow: string;
		statusSelect: string;
		notesInput: string;
		openFile: string;
	};
};

type Props = {
	rows: DocumentReviewRow[];

	labels: Labels;

	/**
	 * Form field name for selected row ids
	 * (server action reads formData.getAll(thisName)).
	 */
	selectedName: string;

	/** Prefix for the per-row status input name: `${statusNamePrefix}${documentTypeId}` */
	statusNamePrefix: string;

	/** Prefix for the per-row notes input name: `${notesNamePrefix}${documentTypeId}` */
	notesNamePrefix: string;
};

function isDbStatus(v: unknown): v is StatusSelectValue {
	return Object.values(DOCUMENT_STATUS).includes(v as StatusSelectValue);
}

export default function DocumentReviewTable({
	rows,
	labels,
	selectedName,
	statusNamePrefix,
	notesNamePrefix,
}: Props) {
	const [statusById, setStatusById] = React.useState<Record<string, StatusSelectValue | "missing">>(() => {
		const init: Record<string, StatusSelectValue | "missing"> = {};
		for (const r of rows) init[r.documentTypeId] = r.status;
		return init;
	});

	const [notesById, setNotesById] = React.useState<Record<string, string>>(() => {
		const init: Record<string, string> = {};
		for (const r of rows) init[r.documentTypeId] = r.notes ?? "";
		return init;
	});

	const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

	const canSelect = React.useCallback(
		(row: DocumentReviewRow) => {
			const s = statusById[row.documentTypeId];

			// Rule 4: drive_link must exist if doc exists; missing means upstream failure -> block selection + save.
			if (!row.hasDoc) return false;
			if (row.driveLinkMissing) return false;

			// Rule 5: selected rows must be non-pending
			if (s === "pending") return false;

			// UI-only "missing" state should never be selectable
			if (s === "missing") return false;

			return true;
		},
		[statusById],
	);

	// If status becomes pending/missing (or driveLink becomes invalid), auto-unselect
	React.useEffect(() => {
		setSelectedIds((prev) => {
			const keep: string[] = [];
			for (const id of prev) {
				const row = rows.find((r) => r.documentTypeId === id);
				if (!row) continue;
				if (canSelect(row)) keep.push(id);
			}
			return keep;
		});
	}, [rows, canSelect]);

	const toggleSelected = (id: string, next: boolean) => {
		setSelectedIds((prev) => {
			if (next) {
				if (prev.includes(id)) return prev;
				return [...prev, id];
			}
			return prev.filter((x) => x !== id);
		});
	};

	return (
		<section className={styles.wrap} aria-label={labels.title}>
			<header className={styles.header}>
				<p className="form-label" style={{ margin: 0 }}>
					{labels.title}
				</p>
				<p className="text-sm text-muted" style={{ margin: 0 }}>
					{labels.subtitle}
				</p>

				<p className="text-sm text-muted" style={{ margin: 0 }}>
					{labels.selectHelp}
				</p>
			</header>

			<div className={styles.list}>
				{rows.map((r) => {
					const currentStatus = statusById[r.documentTypeId];
					const statusIsDb = isDbStatus(currentStatus);

					const meta = getDocumentUiMeta(currentStatus as any);

					const rowSelected = selectedIds.includes(r.documentTypeId);
					const selectable = canSelect(r);

					const disableRowEdits = !r.hasDoc || r.driveLinkMissing;

					const statusName = `${statusNamePrefix}${r.documentTypeId}`;
					const notesName = `${notesNamePrefix}${r.documentTypeId}`;

					return (
						<div key={r.documentTypeId} className={`surface-soft ${styles.row}`}>
							<div className={styles.rowTop}>
								<label className={styles.selectCol}>
									<input
										type="checkbox"
										name={selectedName}
										value={r.documentTypeId}
										checked={rowSelected}
										onChange={(e) => toggleSelected(r.documentTypeId, e.target.checked)}
										disabled={!selectable}
										aria-label={labels.aria.selectRow}
									/>
								</label>

								<div className={styles.mainCol}>
									<p className="text-md text-bold" style={{ margin: 0 }}>
										{labels.columns.requirement}: {r.label}
									</p>
									<p className="text-sm text-muted" style={{ margin: 0 }}>
										{r.description}
									</p>

									<div className={styles.metaLine}>
										{r.hasDoc ? (
											<p className="text-sm text-muted" style={{ margin: 0 }}>
												{r.copyNumber !== null ? `v${r.copyNumber}` : ""}
												{r.uploadedAtLabel.length > 0 ? ` · ${r.uploadedAtLabel}` : ""}
											</p>
										) : (
											<p className="text-sm text-muted" style={{ margin: 0 }}>
												{labels.actions.noFile}
											</p>
										)}
									</div>

									{r.hasDoc && r.driveLinkMissing ? (
										<div className={styles.inlineAlert}>
											<span className={`badge badge-action`}>
												
												<span>{labels.actions.noFile}</span>
											</span>
										</div>
									) : null}
								</div>

								<div className={styles.controlsCol}>
									<div className={styles.badgeRow}>
										<span className={`badge ${meta.badgeTone}`}>
											
											<span>{labels.statusLabels[currentStatus]}</span>
										</span>
									</div>

									<label className={styles.field}>
										<span className="form-label">{labels.columns.status}</span>

										<select
											className="form-control"
											name={statusName}
											value={statusIsDb ? currentStatus : "pending"}
											onChange={(e) => {
												const v = e.target.value;
												if (!isDbStatus(v)) return;

												setStatusById((prev) => ({
													...prev,
													[r.documentTypeId]: v,
												}));
											}}
											disabled={disableRowEdits}
											aria-label={labels.aria.statusSelect}
										>
											<option value="pending">{labels.statusLabels.pending}</option>
											<option value="approved">{labels.statusLabels.approved}</option>
											<option value="resubmit">{labels.statusLabels.resubmit}</option>
											<option value="rejected">{labels.statusLabels.rejected}</option>
										</select>
									</label>

									<div className={styles.fileRow}>
										<span className="form-label">{labels.columns.file}</span>

										{r.driveLink && !r.driveLinkMissing ? (
											<a
												href={r.driveLink}
												target="_blank"
												rel="noopener noreferrer"
												className="button button-secondary"
												aria-label={labels.aria.openFile}
											>
												{labels.actions.openFile}
											</a>
										) : (
											<p className="text-sm text-muted" style={{ margin: 0 }}>
												{labels.actions.noFile}
											</p>
										)}
									</div>
								</div>
							</div>

							<label className={styles.notesRow}>
								<span className="form-label">{labels.columns.notes}</span>
								<textarea
									className={`form-control form-control-note ${styles.notesTextarea}`}
									name={notesName}
									value={notesById[r.documentTypeId] ?? ""}
									onChange={(e) =>
										setNotesById((prev) => ({
											...prev,
											[r.documentTypeId]: e.target.value,
										}))
									}
									disabled={disableRowEdits}
									rows={4}
									aria-label={labels.aria.notesInput}
								/>
							</label>
						</div>
					);
				})}
			</div>
		</section>
	);
}
