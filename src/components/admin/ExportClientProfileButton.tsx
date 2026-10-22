/*
DOC NAME: ExportClientProfileButton.tsx
LOCATION: /src/components/admin/ExportClientProfileButton.tsx
SCOPE: Client-side export control (PDF/DOCX generation) using global buttons + ActionSplitDropdown visuals.
STATUS: UNLOCKED
NOTES:
- VISUAL ONLY: uses ActionSplitDropdown (no inline styling).
- No hardcoded user-facing strings; all labels must be passed in (i18n).
*/

"use client";

import * as React from "react";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { Document, Packer, Paragraph, TextRun } from "docx";

import { ActionSplitDropdown } from "@/components/ui/actions/ActionSplitDropdown";

export type ExportClientProfileHeaders = {
	title: string; // already localized (e.g. "Client Profile — {name}")

	userId: string;
	firstName: string;
	middleName: string;
	lastName: string;
};

export type ExportClientProfilePayload = {
	userId: string;

	firstName: string;
	middleName?: string | null;
	lastName: string;

	/**
	 * Localized headers for built-in fields + localized title line.
	 * (Exporter MUST NOT invent labels.)
	 */
	headers: ExportClientProfileHeaders;

	/**
	 * Extra rows (already localized labels).
	 * These are appended after the built-in fields.
	 */
	fields: Array<{ label: string; value: string | null | undefined }>;
};

type ExportClientProfileButtonProps = {
	profile: ExportClientProfilePayload;

	/* Primary trigger label (i18n) */
	label: string;

	/* Menu item labels (i18n) */
	pdfLabel: string;
	wordLabel: string;

	/* Busy label (i18n) */
	exportingLabel: string;

	/* Accessibility labels (i18n) */
	toggleAriaLabel: string;
	menuAriaLabel: string;

	/* Optional: allow caller to enforce global button classes */
	className?: string;

	/* Optional: allow caller to set menu item button styling */
	itemClassName?: string;
};

function sanitizeFilePart(value: string) {
	return (value || "")
		.trim()
		.replace(/\s+/g, "_")
		.replace(/[^a-zA-Z0-9_\-]/g, "");
}

function buildBaseName(p: ExportClientProfilePayload) {
	const first = sanitizeFilePart(p.firstName || "first");
	const last = sanitizeFilePart(p.lastName || "last");
	const id = sanitizeFilePart(p.userId || "id");
	return `client_profile_${first}_${last}_${id}`;
}

function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.rel = "noopener";
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

function normalizeRows(p: ExportClientProfilePayload) {
	// NOTE: exporter must not invent labels; all headers are provided by caller (i18n).
	const rows = [
		{ label: p.headers.userId, value: p.userId },
		{ label: p.headers.firstName, value: p.firstName },
		{ label: p.headers.middleName, value: p.middleName || "" },
		{ label: p.headers.lastName, value: p.lastName },
		...(p.fields || []),
	];

	return rows.filter((r) => (r.value || "").trim().length > 0);
}

function looksLikeTtfOrOtf(bytes: Uint8Array) {
	// TTF: 00 01 00 00  OR  "true"  OR  "typ1"
	// OTF: "OTTO"
	if (bytes.length < 4) return false;

	const b0 = bytes[0];
	const b1 = bytes[1];
	const b2 = bytes[2];
	const b3 = bytes[3];

	const tag = String.fromCharCode(b0, b1, b2, b3);

	const isTtf00 = b0 === 0x00 && b1 === 0x01 && b2 === 0x00 && b3 === 0x00;
	const isOTTO = tag === "OTTO";
	const isTrue = tag === "true";
	const isTyp1 = tag === "typ1";

	return isTtf00 || isOTTO || isTrue || isTyp1;
}

async function fetchFontBytes(path: string) {
	const res = await fetch(path, { cache: "no-store" });
	if (!res.ok) {
		throw new Error(`Failed to load font: ${path} (${res.status})`);
	}
	const buf = await res.arrayBuffer();
	const bytes = new Uint8Array(buf);

	// Guard against accidentally fetching HTML (e.g., middleware, 404 page, auth redirect)
	if (!looksLikeTtfOrOtf(bytes)) {
		const head = new TextDecoder().decode(bytes.slice(0, 120));
		throw new Error(
			`Font bytes for ${path} do not look like TTF/OTF. First bytes:\n${head}`,
		);
	}

	return bytes;
}

async function buildPdf(profile: ExportClientProfilePayload) {
	const rows = normalizeRows(profile);

	const doc = await PDFDocument.create();

	// REQUIRED for Unicode TTF/OTF embedding (Cyrillic)
	doc.registerFontkit(fontkit);

	// Exact public paths
	const regularBytes = await fetchFontBytes("/fonts/NotoSans-Regular.ttf");
	const boldBytes = await fetchFontBytes("/fonts/NotoSans-Bold.ttf");

	// IMPORTANT: disable subsetting to avoid “patchy/scattered” rendering in some viewers
	const font = await doc.embedFont(regularBytes, { subset: false });
	const fontBold = await doc.embedFont(boldBytes, { subset: false });

	const pageMargin = 48;
	const titleSize = 18;
	const labelSize = 10;
	const valueSize = 11;
	const lineHeight = 16;

	let page = doc.addPage();
	let { width, height } = page.getSize();
	let y = height - pageMargin;

	const maxWidth = width - pageMargin * 2;

	function newPageIfNeeded(extraSpace = 0) {
		if (y < pageMargin + extraSpace) {
			page = doc.addPage();
			({ width, height } = page.getSize());
			y = height - pageMargin;
		}
	}

	function drawLine(text: string, size: number, bold: boolean) {
		page.drawText(text, {
			x: pageMargin,
			y,
			size,
			font: bold ? fontBold : font,
		});
		y -= lineHeight;
	}

	function drawWrappedValue(value: string) {
		const words = value.split(/\s+/).filter(Boolean);

		let line = "";
		for (const w of words) {
			const test = line ? `${line} ${w}` : w;
			const testWidth = font.widthOfTextAtSize(test, valueSize);

			if (testWidth > maxWidth && line) {
				newPageIfNeeded(24);
				page.drawText(line, { x: pageMargin, y, size: valueSize, font });
				y -= lineHeight;
				line = w;
			} else {
				line = test;
			}
		}

		if (line) {
			newPageIfNeeded(24);
			page.drawText(line, { x: pageMargin, y, size: valueSize, font });
			y -= lineHeight;
		}
	}

	// Localized title provided by caller
	drawLine(profile.headers.title, titleSize, true);
	y -= 10;

	for (const row of rows) {
		newPageIfNeeded(56);
		drawLine(`${row.label}:`, labelSize, true);
		drawWrappedValue(row.value || "");
		y -= 8;
	}

	const bytes = await doc.save({ useObjectStreams: false });

	// Ensure BlobPart is backed by ArrayBuffer (not SharedArrayBuffer / ArrayBufferLike)
	const safeBytes = new Uint8Array(bytes);
	return new Blob([safeBytes], { type: "application/pdf" });
}

async function buildDocx(profile: ExportClientProfilePayload) {
	const rows = normalizeRows(profile);

	// Localized title provided by caller
	const title = profile.headers.title;

	const children: Paragraph[] = [
		new Paragraph({
			children: [new TextRun({ text: title, bold: true, size: 32 })], // 16pt
		}),
		new Paragraph({ text: "" }),
	];

	for (const row of rows) {
		children.push(
			new Paragraph({
				children: [
					new TextRun({ text: `${row.label}: `, bold: true }),
					new TextRun({ text: row.value || "" }),
				],
			}),
		);
	}

	const doc = new Document({ sections: [{ children }] });
	const bytes = await Packer.toBuffer(doc);

	// Force a real ArrayBuffer (BlobPart expects ArrayBuffer, not SharedArrayBuffer unions).
	const ab = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(ab).set(bytes);

	return new Blob([ab], {
		type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	});
}

export default function ExportClientProfileButton({
	profile,
	label,
	pdfLabel,
	wordLabel,
	exportingLabel,
	toggleAriaLabel,
	menuAriaLabel,
	className,
	itemClassName,
}: ExportClientProfileButtonProps) {
	const baseName = React.useMemo(() => buildBaseName(profile), [profile]);
	const [busy, setBusy] = React.useState<null | "pdf" | "docx">(null);
	const isBusy = busy !== null;

	const onExportPdf = React.useCallback(async () => {
		if (isBusy) return;
		setBusy("pdf");
		try {
			const blob = await buildPdf(profile);
			downloadBlob(blob, `${baseName}.pdf`);
		} finally {
			setBusy(null);
		}
	}, [baseName, isBusy, profile]);

	const onExportDocx = React.useCallback(async () => {
		if (isBusy) return;
		setBusy("docx");
		try {
			const blob = await buildDocx(profile);
			downloadBlob(blob, `${baseName}.docx`);
		} finally {
			setBusy(null);
		}
	}, [baseName, isBusy, profile]);

	return (
		<ActionSplitDropdown
			label={label}
			pendingLabel={exportingLabel}
			isPending={isBusy}
			disabled={isBusy}
			toggleAriaLabel={toggleAriaLabel}
			menuAriaLabel={menuAriaLabel}
			primaryButtonClassName={className ?? "button button-primary"}
			itemButtonClassName={itemClassName ?? "button button-secondary"}
			actions={[
				{ id: "pdf", label: pdfLabel, onClick: onExportPdf },
				{ id: "docx", label: wordLabel, onClick: onExportDocx },
			]}
		/>
	);
}
