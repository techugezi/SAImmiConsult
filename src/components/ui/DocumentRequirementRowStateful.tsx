"use client";

import { useCallback, useEffect, useState } from "react";

import DocumentRequirementRow, {
	type DocumentRequirementUploadState,
} from "@/components/ui/DocumentRequirementRow";
import DocumentUploadForm from "@/components/ui/DocumentUploadForm";

type DocumentReqProp = {
	id: string;
	labelKey: string;
	required: boolean;
	formatGroup: string | null;
};

type UploadedDocProp = {
	id: string;
	status: string;
	notes: string | null;
	uploaded_at: string | null;
	file_name?: string | null;
	copy_number?: number | null;
} | null;

export default function DocumentRequirementRowStateful({
	title,
	description,
	required,
	requiredLabel,
	statusLabel,
	statusTone,
	note,
	uploadedOnLabel,
	uploadedOnValue,
	applicationId,
	documentReq,
	uploadedDoc,
	clientName,
	isLocked,
	applicationFolderId,
}: {
	title: string;
	description: string;
	required: boolean;
	requiredLabel?: string;
	statusLabel: string;
	statusTone?: string;
	note: string | null;
	uploadedOnLabel: string;
	uploadedOnValue: string;
	applicationId: string;
	documentReq: DocumentReqProp;
	uploadedDoc: UploadedDocProp;
	clientName: string;
	isLocked: boolean;
	applicationFolderId: string;
}) {
	const isPersisted = Boolean(
		uploadedDoc?.status && uploadedDoc.status !== "missing",
	);

	// Reviewer flagged this file — client must act. Wins over upload state.
	const needsAttention =
		uploadedDoc?.status === "resubmit" ||
		uploadedDoc?.status === "rejected";

	const [uploadState, setUploadState] =
		useState<DocumentRequirementUploadState>(
			isPersisted ? "uploaded" : "idle",
		);

	useEffect(() => {
		if (uploadedDoc?.status && uploadedDoc.status !== "missing") {
			setUploadState("uploaded");
		}
	}, [uploadedDoc?.status, uploadedDoc?.id]);

	const handleFileSelected = useCallback((hasFile: boolean) => {
		setUploadState((prev) => {
			if (prev === "uploaded") return prev;
			return hasFile ? "selected" : "idle";
		});
	}, []);

	return (
		<DocumentRequirementRow
			title={title}
			description={description}
			required={required}
			requiredLabel={requiredLabel}
			statusLabel={statusLabel}
			statusTone={statusTone}
			note={note}
			uploadedOnLabel={uploadedOnLabel}
			uploadedOnValue={uploadedOnValue}
			uploadState={uploadState}
			showUploadedCheck={uploadState === "uploaded"}
			needsAttention={needsAttention}
			action={
				<DocumentUploadForm
					applicationId={applicationId}
					documentReq={documentReq}
					uploadedDoc={uploadedDoc as any}
					clientName={clientName}
					isLocked={isLocked}
					applicationFolderId={applicationFolderId}
					onFileSelectedChange={handleFileSelected}
				/>
			}
		/>
	);
}