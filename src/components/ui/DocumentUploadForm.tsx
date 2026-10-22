/*
DOC NAME: DocumentUploadForm.tsx
LOCATION: /src/components/ui/DocumentUploadForm.tsx
SCOPE: Client-side document upload UI + validation + CTA trigger (global primitive).
STATUS: UNLOCKED (lock after approved)
*/

"use client";

import { useCallback, useMemo, useRef, useState, useTransition, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { uploadFileToGoogleDrive } from "@/components/server/uploadFileToGoogleDrive";

import {
	type DocumentFormatGroup,
	buildAcceptAttr,
	getAcceptedExtensionsForGroup,
	isAllowedFileForGroup,
	normalizeDocumentFormatGroup,
} from "@/config/documentFormats";

import styles from "./DocumentUploadForm.module.css";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_SIZE_MB = 10;

export type DocumentRequirement = {
	id: string;
	labelKey: string;
	required: boolean;
	formatGroup?: DocumentFormatGroup | string | null;
};

export type UploadedDocument = {
	id: string;
	document_type_id: string;
	status: "pending" | "approved" | "resubmit" | "rejected";
	admin_feedback: string | null;
	uploaded_at: string;
	file_name: string;
};

type Props = {
	applicationId: string;
	documentReq: DocumentRequirement;
	uploadedDoc?: UploadedDocument;
	clientName: string;
	isLocked?: boolean;
	applicationFolderId: string;
	onUploadSuccess?: () => void;
};

function UploadIcon() {
	return (
		<svg
			aria-hidden="true"
			focusable="false"
			width="1.1em"
			height="1.1em"
			viewBox="0 0 24 24"
			fill="none"
		>
			<path
				d="M12 3v10m0-10 4 4m-4-4-4 4M4 14v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

export default function DocumentUploadForm({
	applicationId,
	documentReq,
	uploadedDoc,
	clientName,
	applicationFolderId,
	onUploadSuccess,
	isLocked = false,
}: Props) {
	const t = useTranslations("ClientDocuments");
	const router = useRouter();

	const inputRef = useRef<HTMLInputElement | null>(null);

	const [file, setFile] = useState<File | null>(null);
	const [isPending, startTransition] = useTransition();
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);

	const formatGroup = useMemo(() => {
		return normalizeDocumentFormatGroup(documentReq.formatGroup);
	}, [documentReq.formatGroup]);

	const acceptAttr = useMemo(() => {
		return buildAcceptAttr(formatGroup);
	}, [formatGroup]);

	const acceptedExts = useMemo(() => {
		return getAcceptedExtensionsForGroup(formatGroup);
	}, [formatGroup]);

	const isDisabled = isPending || Boolean(isLocked);

	const clearFileInput = useCallback(() => {
		if (inputRef.current) inputRef.current.value = "";
	}, []);

	const handlePickFile = useCallback(() => {
		if (isDisabled) return;
		inputRef.current?.click();
	}, [isDisabled]);

	const handleFileChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			if (isDisabled) return;

			setUploadError(null);
			setUploadSuccess(false);

			const selectedFile = event.target.files?.[0] || null;
			if (!selectedFile) {
				setFile(null);
				return;
			}

			if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
				setUploadError(t("upload.fileTooLarge", { size: MAX_FILE_SIZE_MB }));
				setFile(null);
				clearFileInput();
				return;
			}

			if (!isAllowedFileForGroup(selectedFile, formatGroup)) {
				setUploadError(t("upload.invalidFile"));
				setFile(null);
				clearFileInput();
				return;
			}

			setFile(selectedFile);
		},
		[isDisabled, t, formatGroup, clearFileInput],
	);

	const handleCancel = useCallback(() => {
		if (isDisabled) return;
		setFile(null);
		setUploadError(null);
		setUploadSuccess(false);
		clearFileInput();
	}, [isDisabled, clearFileInput]);

	const handleUpload = useCallback(async () => {
		if (!file || isDisabled) return;

		startTransition(async () => {
			setUploadError(null);
			setUploadSuccess(false);

			try {
				await uploadFileToGoogleDrive({
					file,
					folderId: applicationFolderId,
					applicationId,
					documentTypeId: documentReq.id,
					clientName,
				});

				setUploadSuccess(true);
				setFile(null);
				clearFileInput();

				router.refresh();

				if (typeof onUploadSuccess === "function") {
					onUploadSuccess();
				}
			} catch (error: any) {
				// eslint-disable-next-line no-console
				console.error("Upload failed:", error);
				setUploadError(error?.message || t("upload.error"));
			}
		});
	}, [
		file,
		isDisabled,
		applicationFolderId,
		applicationId,
		documentReq.id,
		clientName,
		onUploadSuccess,
		router,
		t,
		clearFileInput,
	]);

	return (
		<div className={styles.root}>
			<input
				ref={inputRef}
				type="file"
				className={styles.hiddenInput}
				onChange={handleFileChange}
				accept={acceptAttr}
				disabled={isDisabled}
			/>

			{file ? (
				<div className={styles.pendingBox}>
					<p className="text-sm text-muted">{t("upload.fileSelected", { fileName: file.name })}</p>

					<div className={styles.actionsRow}>
						<button
							type="button"
							className="button button-ghost"
							onClick={handleCancel}
							disabled={isDisabled}
						>
							{t("upload.cancel")}
						</button>

						<button
							type="button"
							className="button button-primary"
							onClick={handleUpload}
							disabled={isDisabled}
						>
							{isPending ? t("upload.uploading") : t("upload.confirm")}
						</button>
					</div>
				</div>
			) : (
				<button
					type="button"
					className="button button-secondary"
					onClick={handlePickFile}
					disabled={isDisabled}
					aria-disabled={isDisabled ? "true" : "false"}
				>
					<UploadIcon />
					<span>{uploadedDoc ? t("upload.replace") : t("upload.button")}</span>
				</button>
			)}

			{uploadError ? (
				<p className={`${styles.message} text-sm`}>{uploadError}</p>
			) : null}

			<div className={styles.helper}>
				<p className="text-sm text-muted">
					<span className="text-bold">{t("list.formats")}:</span> {acceptedExts.join(", ")}
				</p>
				<p className="text-sm text-muted">
					<span className="text-bold">{t("list.maxSize", { size: MAX_FILE_SIZE_MB })}</span>
				</p>
			</div>

			{uploadSuccess && !uploadError ? (
				<p className={`${styles.message} text-sm`}>{t("upload.success")}</p>
			) : null}
		</div>
	);
}
