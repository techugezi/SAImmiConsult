/* DOC NAME: uploadFileToGoogleDrive.ts
   LOCATION: /src/components/server/uploadFileToGoogleDrive.ts
   SCOPE: Upload + versioning: ensures Drive folder linkage then uploads file to application folder.
   STATUS: UNLOCKED (lock after approved)
   AUDIT:
   - NO console logging (prod-safe).
   - Drive links ARE persisted to DB (document logs + document version RPC payload) as required.
   - RPC failures mapped to stable CODEs without leaking DB internals.
*/

"use server";

import "server-only";

import { Buffer } from "node:buffer";
import { Readable } from "node:stream";

import { drive } from "@/lib/googleDriveClient";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { logDocumentEvent } from "@/lib/documentLogs";

import { ensureApplicationDriveFolders } from "@/components/server/ensureApplicationDriveFolders";

type UploadPayload = {
	file: File;
	folderId: string; // legacy fallback; we still accept it but we now provision from DB
	applicationId: string;
	documentTypeId: string;
	clientName: string;
};

type RpcRow = {
	new_document_id: string;
	new_copy_number: number;
	previous_document_id: string | null;
	previous_status: string | null;
	previous_file_name: string | null;
	previous_drive_link: string | null;
};

type LatestDocRow = {
	id: string;
	status: "pending" | "approved" | "resubmit" | "rejected";
	copy_number: number;
};

function buildSafeFileName(args: {
	originalName: string;
	clientName: string;
	documentTypeId: string;
	applicationId: string;
	proposedCopyNumber?: number | null;
}): string {
	const { originalName, clientName, documentTypeId, applicationId, proposedCopyNumber } = args;

	const safeClientName = clientName.replace(/[^\w\s-]+/g, "").trim();
	const normalizedDocType = documentTypeId.toLowerCase();
	const datePart = new Date().toISOString().replace(/[:.]/g, "-");

	const ext = originalName.includes(".")
		? originalName.substring(originalName.lastIndexOf(".") + 1)
		: "";

	const versionPart =
		typeof proposedCopyNumber === "number" && proposedCopyNumber > 0
			? `v${proposedCopyNumber}`
			: "v1";

	const baseName = `${safeClientName} - ${normalizedDocType} - ${applicationId} - ${versionPart} - ${datePart}`;
	const fullName = ext ? `${baseName}.${ext}` : baseName;

	return fullName.length > 255 ? fullName.slice(0, 255) : fullName;
}

function errorWithCode(code: string, message: string): Error {
	return new Error(`${code}: ${message}`);
}

function mapRpcErrorToCode(err: unknown): string {
	const raw = (err as any)?.message?.toString?.() ?? "";
	const msg = raw.toLowerCase();

	if (msg.includes("not authenticated")) return "AUTH_REQUIRED";
	if (msg.includes("not allowed") || msg.includes("forbidden")) return "FORBIDDEN";
	if (msg.includes("invalid document type")) return "INVALID_DOCUMENT_TYPE";
	if (msg.includes("locked") || msg.includes("under review") || msg.includes("approved")) return "DOC_LOCKED";

	return "DB_SAVE_FAILED";
}

async function tryDeleteDriveFile(driveFileId: string): Promise<void> {
	try {
		await drive.files.delete({ fileId: driveFileId, supportsAllDrives: true });
	} catch {
		// Silent cleanup failure (no console logging)
	}
}

export async function uploadFileToGoogleDrive({
	file,
	folderId,
	applicationId,
	documentTypeId,
	clientName,
}: UploadPayload): Promise<string> {
	const supabase = await createServerSupabaseClient();

	// 1) Auth
	const { data: userData, error: userError } = await supabase.auth.getUser();
	if (userError || !userData?.user) {
		throw errorWithCode("AUTH_REQUIRED", "You must be logged in to upload documents.");
	}

	const userId = userData.user.id;

	// 2) Load application (RLS should enforce; still fail fast)
	const { data: application, error: appError } = await supabase
		.from("client_applications")
		.select("id, user_id, drive_application_folder_id")
		.eq("id", applicationId)
		.single();

	if (appError || !application) {
		throw errorWithCode("APP_NOT_FOUND", "Could not load application for document upload.");
	}

	if (application.user_id !== userId) {
		throw errorWithCode("FORBIDDEN", "You are not allowed to upload documents for this application.");
	}

	// 3) Ensure Drive folders exist + are linked in DB (self-healing)
	let effectiveFolderId = (application.drive_application_folder_id ?? "").trim();

	if (!effectiveFolderId) {
		const provisioned = await ensureApplicationDriveFolders({
			applicationId,
			expectedUserId: userId,
			fallbackClientName: clientName,
		});

		effectiveFolderId = provisioned.applicationFolderId;
	}

	// still allow old fallback for safety (should not be needed after v2)
	if (!effectiveFolderId && folderId) {
		effectiveFolderId = folderId.trim();
	}

	if (!effectiveFolderId) {
		throw errorWithCode("DRIVE_FOLDER_MISSING", "Application is not linked to a Drive folder.");
	}

	// 4) Optional pre-check for lock
	const { data: latestDoc, error: latestError } = await supabase
		.from("client_documents")
		.select("id, status, copy_number")
		.eq("user_id", userId)
		.eq("application_id", applicationId)
		.eq("document_type_id", documentTypeId)
		.order("copy_number", { ascending: false })
		.limit(1)
		.maybeSingle();

	if (latestError) {
		throw errorWithCode("DOC_STATE_CHECK_FAILED", "Could not validate document state before upload.");
	}

	const latest = (latestDoc as LatestDocRow | null) ?? null;

	if (latest && (latest.status === "pending" || latest.status === "approved")) {
		throw errorWithCode("DOC_LOCKED", "This document is locked for upload right now.");
	}

	const proposedCopyNumber = latest ? latest.copy_number + 1 : 1;

	// 5) Build Drive file name
	const finalName = buildSafeFileName({
		originalName: file.name,
		clientName,
		documentTypeId,
		applicationId,
		proposedCopyNumber,
	});

	// 6) Convert File -> stream
	const arrayBuffer = await file.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);
	const stream = Readable.from(buffer);

	// 7) Upload to Google Drive
	const driveRes = await drive.files.create({
		requestBody: { name: finalName, parents: [effectiveFolderId] },
		media: { mimeType: file.type, body: stream },
		fields: "id, webViewLink",
		supportsAllDrives: true,
	});

	const driveFileId = driveRes.data.id;

	if (!driveFileId) {
		throw errorWithCode("DRIVE_UPLOAD_FAILED", "File upload to Google Drive failed.");
	}

	const driveLink = driveRes.data.webViewLink ?? `https://drive.google.com/file/d/${driveFileId}/view`;

	// 8) Create DB version row via RPC
	const { data: rpcRows, error: rpcError } = await supabase.rpc("upsert_client_document_version", {
		p_application_id: applicationId,
		p_document_type_id: documentTypeId,
		p_file_name: finalName,
		p_drive_link: driveLink,
	});

	if (rpcError) {
		await tryDeleteDriveFile(driveFileId);

		const code = mapRpcErrorToCode(rpcError);
		throw errorWithCode(code, code);
	}

	const rpcRow = (Array.isArray(rpcRows) ? rpcRows[0] : null) as RpcRow | null;

	if (!rpcRow?.new_document_id) {
		await tryDeleteDriveFile(driveFileId);
		throw errorWithCode("DB_SAVE_FAILED", "Failed to save your document. Please try again.");
	}

	const documentId = rpcRow.new_document_id;

	// 9) Audit log (best-effort, silent)
	try {
		await logDocumentEvent(supabase, {
			documentId,
			actorUserId: userId,
			actorRole: "client",
			eventType: rpcRow.previous_document_id ? "replaced" : "uploaded",
			previousStatus: (rpcRow.previous_status as any) ?? null,
			newStatus: "pending",
			previousFileName: rpcRow.previous_file_name,
			newFileName: finalName,

			// REQUIRED: persist drive links into DB logs
			previousDriveLink: rpcRow.previous_drive_link,
			newDriveLink: driveLink,

			reason: null,
		});
	} catch {
		// Silent
	}

	return driveLink;
}
