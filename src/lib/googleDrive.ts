/* DOC NAME: googleDrive.ts
   LOCATION: /src/lib/googleDrive.ts
   SCOPE: Canonical Drive folder provisioning (root → client parent → application folder).
   STATUS: UNLOCKED (lock after approved)
   AUDIT:
   - Removed hardcoded human-facing English fallback ("Unknown Destination") from folder naming (now uses stable slug fallback).
   - No console logging; no Drive IDs/links are logged.
   - Error messages use code-style strings and avoid embedding sensitive identifiers.
   - Hardened folder-name components (trim + collapse whitespace + strip control chars) to reduce edge-case failures.
   - PROD: Added fail-fast guards for empty folder names/parent IDs and safe date parsing.
*/

import "server-only";

import { drive, DRIVE_ROOT_FOLDER_ID } from "./googleDriveClient";

export type DriveFolderIds = {
	parentFolderId: string;
	applicationFolderId: string;
};

function escapeDriveQueryValue(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function normalizeFolderComponent(value: string): string {
	return value
		.replace(/[\u0000-\u001F\u007F]/g, "") // strip control chars
		.replace(/\s+/g, " ")
		.trim();
}

function normalizeDriveId(value: string): string {
	return normalizeFolderComponent(value);
}

function toIsoDatePart(inputIso: string | null | undefined): string {
	if (!inputIso) return new Date().toISOString().split("T")[0];

	const d = new Date(inputIso);
	if (Number.isNaN(d.getTime())) return new Date().toISOString().split("T")[0];

	return d.toISOString().split("T")[0];
}

async function getFolderIfAccessible(folderId: string): Promise<{ id: string; name?: string } | null> {
	const id = normalizeDriveId(folderId);
	if (!id) return null;

	try {
		const res = await drive.files.get({
			fileId: id,
			fields: "id, name",
			supportsAllDrives: true,
		});

		if (!res.data?.id) return null;
		return { id: res.data.id, name: res.data.name ?? undefined };
	} catch {
		return null;
	}
}

export async function ensureRootAccessible(): Promise<string> {
	const rootId = normalizeDriveId(DRIVE_ROOT_FOLDER_ID || "");
	if (!rootId) {
		throw new Error("DRIVE_NOT_CONFIGURED");
	}

	const ok = await getFolderIfAccessible(rootId);
	if (!ok) {
		throw new Error("DRIVE_ROOT_NOT_ACCESSIBLE");
	}

	return rootId;
}

type FindOrCreateFolderArgs = {
	name: string;
	parentId: string;
};

async function findExistingFolderId(name: string, parentId: string): Promise<string | null> {
	const safeParentId = normalizeDriveId(parentId);
	if (!safeParentId) throw new Error("DRIVE_INVALID_PARENT_ID");

	const safeName = normalizeFolderComponent(name);
	if (!safeName) throw new Error("DRIVE_INVALID_FOLDER_NAME");

	const nameQ = escapeDriveQueryValue(safeName);

	const q =
		`'${safeParentId}' in parents ` +
		`and name = '${nameQ}' ` +
		`and mimeType = 'application/vnd.google-apps.folder' ` +
		`and trashed = false`;

	const listRes = await drive.files.list({
		q,
		fields: "files(id, name, parents)",
		includeItemsFromAllDrives: true,
		supportsAllDrives: true,
		corpora: "allDrives",
		spaces: "drive",
		pageSize: 1,
	});

	const existing = listRes.data.files?.[0];
	return existing?.id ?? null;
}

async function findOrCreateFolder({ name, parentId }: FindOrCreateFolderArgs): Promise<string> {
	const safeParentId = normalizeDriveId(parentId);
	if (!safeParentId) throw new Error("DRIVE_INVALID_PARENT_ID");

	const safeName = normalizeFolderComponent(name);
	if (!safeName) throw new Error("DRIVE_INVALID_FOLDER_NAME");

	// 1) Look for existing folder
	const existingId = await findExistingFolderId(safeName, safeParentId);
	if (existingId) return existingId;

	// 2) Create new folder
	try {
		const createRes = await drive.files.create({
			requestBody: {
				name: safeName,
				mimeType: "application/vnd.google-apps.folder",
				parents: [safeParentId],
			},
			fields: "id",
			supportsAllDrives: true,
		});

		if (createRes.data.id) {
			return createRes.data.id;
		}
	} catch {
		// Intentionally fall through to re-check; avoids logging + mitigates rare races.
	}

	// 3) Re-check (race mitigation): another request may have created it.
	const afterId = await findExistingFolderId(safeName, safeParentId);
	if (afterId) return afterId;

	throw new Error("DRIVE_CREATE_FAILED");
}

function formatVisaTypeLabel(slug: string): string {
	const s = normalizeFolderComponent(slug);
	if (!s) return "unknown_visa_type";
	return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDestinationLabel(dest: string | null | undefined): string {
	const s = normalizeFolderComponent(String(dest ?? ""));
	if (!s) return "unknown_destination";
	return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function ensureClientParentFolderId(args: {
	userId: string;
	clientName: string;
	existingParentFolderId?: string | null;
}): Promise<string> {
	const rootFolderId = await ensureRootAccessible();

	// 1) If DB has an id, trust-but-verify
	if (args.existingParentFolderId) {
		const ok = await getFolderIfAccessible(args.existingParentFolderId);
		if (ok?.id) return ok.id;
	}

	// 2) Find or create by canonical name
	const parentName = normalizeFolderComponent(`${args.clientName} - ${args.userId}`);
	if (!parentName) throw new Error("DRIVE_INVALID_FOLDER_NAME");

	return await findOrCreateFolder({
		name: parentName,
		parentId: rootFolderId,
	});
}

export async function ensureApplicationFolderId(args: {
	parentFolderId: string;
	applicationId: string;
	destination: string | null;
	visaType: string;
	createdAtIso?: string | null;
}): Promise<string> {
	const datePart = toIsoDatePart(args.createdAtIso ?? null);

	const visaLabel = formatVisaTypeLabel(args.visaType);
	const destinationLabel = formatDestinationLabel(args.destination);

	const applicationFolderName = normalizeFolderComponent(
		`${datePart} - ${visaLabel} - ${destinationLabel} - ${args.applicationId}`,
	);

	if (!applicationFolderName) throw new Error("DRIVE_INVALID_FOLDER_NAME");

	return await findOrCreateFolder({
		name: applicationFolderName,
		parentId: args.parentFolderId,
	});
}

export async function createApplicationDriveFolders(args: {
	userId: string;
	applicationId: string;
	clientName: string;
	destination: string | null;
	visaType: string;
	existingParentFolderId?: string | null;
	createdAtIso?: string | null;
}): Promise<DriveFolderIds> {
	const parentFolderId = await ensureClientParentFolderId({
		userId: args.userId,
		clientName: args.clientName,
		existingParentFolderId: args.existingParentFolderId,
	});

	const applicationFolderId = await ensureApplicationFolderId({
		parentFolderId,
		applicationId: args.applicationId,
		destination: args.destination,
		visaType: args.visaType,
		createdAtIso: args.createdAtIso ?? null,
	});

	return { parentFolderId, applicationFolderId };
}
