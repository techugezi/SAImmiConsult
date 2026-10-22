/*
DOC NAME: documentFormats.ts
LOCATION: /src/config/documentFormats.ts
SCOPE: Canonical document format enforcement for uploads (single source of truth).
STATUS: LOCKED
*/

export type DocumentFormatGroup = "doc" | "photo" | "scan";

/*
Rules (per spec):
- DOC  = .pdf
- PHOTO = .jpg, .jpeg, .png, .pdf
- SCAN  = .pdf, .jpg, .jpeg, .png
- fill_out_form => DOC (PDF only)
- pdf_only => DOC (PDF only)
- No .heic, .xls, .xlsx, .csv
*/

const GROUP_EXTENSIONS: Record<DocumentFormatGroup, readonly string[]> = {
	doc: [".pdf"],
	photo: [".jpg", ".jpeg", ".png", ".pdf"],
	scan: [".pdf", ".jpg", ".jpeg", ".png"],
} as const;

const GROUP_MIME_TYPES: Record<DocumentFormatGroup, readonly string[]> = {
	doc: ["application/pdf"],
	photo: ["image/jpeg", "image/png"],
	scan: ["application/pdf", "image/jpeg", "image/png"],
} as const;

function normalizeKey(raw: string) {
	return raw
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "_")
		.replace(/-+/g, "_");
}

function getFileExtension(fileName: string): string {
	const parts = fileName.split(".");
	if (parts.length < 2) return "";
	return `.${parts[parts.length - 1].toLowerCase()}`;
}

export function normalizeDocumentFormatGroup(
	raw: DocumentFormatGroup | string | null | undefined,
): DocumentFormatGroup {
	if (!raw) return "scan";

	const k = normalizeKey(String(raw));

	// Canonical
	if (k === "doc" || k === "pdf") return "doc";
	if (k === "photo" || k === "image") return "photo";
	if (k === "scan" || k === "scanned") return "scan";

	// ✅ Your DB enums
	if (k === "pdf_only") return "doc";
	if (k === "fill_out_form" || k === "fillout_form" || k === "filloutform") return "doc";

	// Unknown -> safe default
	return "scan";
}

export function getAcceptedExtensionsForGroup(group: DocumentFormatGroup): string[] {
	return [...GROUP_EXTENSIONS[group]];
}

export function buildAcceptAttr(group: DocumentFormatGroup): string {
	return GROUP_EXTENSIONS[group].join(",");
}

export function isAllowedFileForGroup(file: File, group: DocumentFormatGroup): boolean {
	const ext = getFileExtension(file.name);
	const allowedExts = GROUP_EXTENSIONS[group];
	if (!allowedExts.includes(ext)) return false;

	const mime = (file.type || "").toLowerCase();
	if (!mime) return true;

	const allowedMimes = GROUP_MIME_TYPES[group];
	return allowedMimes.includes(mime);
}
