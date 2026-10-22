/*
DOC NAME: ExportCaseDetailsButton.tsx
LOCATION: /src/components/admin/ExportCaseDetailsButton.tsx
SCOPE: Export orchestration (PDF/DOCX generation) wired into global ActionSplitDropdown.
STATUS: UNLOCKED (lock after approved)
*/

"use client";

import React, { useCallback, useMemo, useState } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { Document, Packer, Paragraph, TextRun } from "docx";

import { ActionSplitDropdown, type SplitAction } from "@/components/ui/actions/ActionSplitDropdown";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type RowInput = { label: string; value: string | null | undefined };

type Props = {
	fileBaseName: string;

	/**
	 * IMPORTANT:
	 * - title and rows MUST be localized by the caller (page level via next-intl).
	 * - This component MUST NOT invent labels (no hardcoded headers).
	 */
	title: string;

	rows: Array<{ label: string; value: string }>;

	labels: {
		trigger: string;
		exporting: string;
		menuLabel: string;
		pdf: string;
		docx: string;
	};

	disabled?: boolean;

	className?: string;
	buttonClassName: string;
	secondaryButtonClassName: string;
	dropdownClassName: string;
};

// Normalized items preserve the caller's labels exactly (already localized)
type NormalizedItem =
	| { kind: "header"; label: string }
	| { kind: "row"; label: string; value: string };

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

function sanitizeFilenamePart(input: string) {
	const s = (input || "")
		.trim()
		.replace(/\s+/g, "_")
		.replace(/[^a-zA-Z0-9._-]/g, "")
		.replace(/_+/g, "_")
		.replace(/^_+|_+$/g, "");
	return s;
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

// ─────────────────────────────────────────────
// Normalization
// ─────────────────────────────────────────────

function isSectionHeaderRow(label: string, value: string) {
	if (value.length !== 0) return false;
	return /[:：]\s*$/.test(label);
}

function normalizeRows(rows: RowInput[]) {
	const out: NormalizedItem[] = [];

	for (const r of rows || []) {
		const label = String(r?.label ?? "").trim();
		const value = String(r?.value ?? "").trim();

		if (!label) continue;

		// Treat "Header:" (with empty value) as a section header (label is already localized)
		if (isSectionHeaderRow(label, value)) {
			out.push({ kind: "header", label });
			continue;
		}

		if (!value) continue;

		out.push({ kind: "row", label, value });
	}

	return out;
}

function normalizeTitle(title: unknown) {
	const t = typeof title === "string" ? title : String(title ?? "");
	return t.trim();
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

// ─────────────────────────────────────────────
// PDF Export (Unicode-safe, Cyrillic-safe)
// ─────────────────────────────────────────────

async function makePdf(rawTitle: unknown, rawRows: RowInput[]) {
	const title = normalizeTitle(rawTitle);
	const items = normalizeRows(rawRows);

	const doc = await PDFDocument.create();

	// REQUIRED for Unicode TTF/OTF embedding (Cyrillic)
	doc.registerFontkit(fontkit);

	// Project-wide fonts (must exist under /public/fonts)
	const regularBytes = await fetchFontBytes("/fonts/NotoSans-Regular.ttf");
	const boldBytes = await fetchFontBytes("/fonts/NotoSans-Bold.ttf");

	// IMPORTANT: disable subsetting to avoid “patchy/scattered” rendering in some viewers
	const font = await doc.embedFont(regularBytes, { subset: false });
	const fontBold = await doc.embedFont(boldBytes, { subset: false });

	const pageMargin = 48;
	const titleSize = 18;
	const headerSize = 13;
	const labelSize = 11;
	const valueSize = 11;
	const lineHeight = 16;

	// Spacing knobs (best-practice: predictable rhythm)
	const sectionTopGap = 12; // space BEFORE a new section header (except the first)
	const sectionBottomGap = 10; // space AFTER a header underline
	const rowBottomGap = 8; // space AFTER each row value block

	let page = doc.addPage();
	let { width, height } = page.getSize();
	let y = height - 56;

	const maxWidth = width - pageMargin * 2;

	function newPageIfNeeded(extraSpace = 0) {
		if (y < pageMargin + extraSpace) {
			page = doc.addPage();
			({ width, height } = page.getSize());
			y = height - 56;
		}
	}

	function drawTextLine(text: string, size: number, bold: boolean) {
		page.drawText(text, {
			x: pageMargin,
			y,
			size,
			font: bold ? fontBold : font,
			color: rgb(0.06, 0.09, 0.16),
		});
		y -= lineHeight;
	}

	function drawDivider() {
		newPageIfNeeded(24);
		page.drawLine({
			start: { x: pageMargin, y },
			end: { x: width - pageMargin, y },
			thickness: 1,
			color: rgb(0.85, 0.86, 0.88),
		});
		y -= 18;
	}

	function drawHeaderUnderline() {
		newPageIfNeeded(18);
		page.drawLine({
			start: { x: pageMargin, y },
			end: { x: width - pageMargin, y },
			thickness: 1,
			color: rgb(0.9, 0.91, 0.93),
		});
		y -= sectionBottomGap;
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

	if (title) {
		drawTextLine(title, titleSize, true);
		y -= 10;
		drawDivider();
	}

	let hasDrawnAnyHeader = false;

	for (const it of items) {
		if (it.kind === "header") {
			// Add a consistent gap BETWEEN sections (not just via “\n” strings)
			if (hasDrawnAnyHeader) {
				newPageIfNeeded(sectionTopGap + 10);
				y -= sectionTopGap;
			}
			hasDrawnAnyHeader = true;

			newPageIfNeeded(44);
			drawTextLine(it.label, headerSize, true);
			drawHeaderUnderline();
			continue;
		}

		newPageIfNeeded(56);
		drawTextLine(`${it.label}:`, labelSize, true);
		drawWrappedValue(it.value);
		y -= rowBottomGap;
	}

	// Some viewers are fussier with object streams; disabling can improve compatibility
	const bytes = await doc.save({ useObjectStreams: false });
	// Ensure BlobPart is backed by ArrayBuffer (not SharedArrayBuffer / ArrayBufferLike)
	const safeBytes = new Uint8Array(bytes);
	return new Blob([safeBytes], { type: "application/pdf" });
}

// ─────────────────────────────────────────────
// DOCX Export
// ─────────────────────────────────────────────

async function makeDocx(rawTitle: unknown, rawRows: RowInput[]) {
	const title = normalizeTitle(rawTitle);
	const items = normalizeRows(rawRows);

	const children: Paragraph[] = [];

	if (title) {
		children.push(
			new Paragraph({
				children: [new TextRun({ text: title, bold: true, size: 32 })],
				spacing: { after: 240 },
			}),
		);
	}

	let hasAddedAnyHeader = false;

	for (const it of items) {
		if (it.kind === "header") {
			// Best-practice spacing via paragraph spacing, not “\n”
			children.push(
				new Paragraph({
					children: [new TextRun({ text: it.label, bold: true, size: 26 })],
					spacing: {
						before: hasAddedAnyHeader ? 260 : 140, // section-to-section gap
						after: 160,
					},
				}),
			);
			hasAddedAnyHeader = true;
			continue;
		}

		children.push(
			new Paragraph({
				children: [
					new TextRun({ text: `${it.label}: `, bold: true }),
					new TextRun({ text: it.value }),
				],
				spacing: { after: 140 },
			}),
		);
	}

	const doc = new Document({
		sections: [{ properties: {}, children }],
	});

	return Packer.toBlob(doc);
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function ExportCaseDetailsButton({
	fileBaseName,
	title,
	rows,
	labels,
	disabled,
	className,
	buttonClassName,
	secondaryButtonClassName,
	dropdownClassName,
}: Props) {
	const [busy, setBusy] = useState<null | "pdf" | "docx">(null);

	const safeBase = useMemo(() => sanitizeFilenamePart(fileBaseName), [fileBaseName]);
	const isBusy = busy !== null;

	const onExportPdf = useCallback(async () => {
		if (disabled || isBusy) return;
		setBusy("pdf");
		try {
			const blob = await makePdf(title, rows as RowInput[]);
			downloadBlob(blob, `${safeBase}.pdf`);
		} finally {
			setBusy(null);
		}
	}, [disabled, isBusy, rows, safeBase, title]);

	const onExportDocx = useCallback(async () => {
		if (disabled || isBusy) return;
		setBusy("docx");
		try {
			const blob = await makeDocx(title, rows as RowInput[]);
			downloadBlob(blob, `${safeBase}.docx`);
		} finally {
			setBusy(null);
		}
	}, [disabled, isBusy, rows, safeBase, title]);

	const actions: SplitAction[] = useMemo(
		() => [
			{ id: "pdf", label: labels.pdf, onClick: onExportPdf },
			{ id: "docx", label: labels.docx, onClick: onExportDocx },
		],
		[labels.docx, labels.pdf, onExportDocx, onExportPdf],
	);

	return (
		<ActionSplitDropdown
			className={className}
			label={labels.trigger}
			pendingLabel={labels.exporting}
			isPending={isBusy}
			disabled={disabled}
			actions={actions}
			menuAriaLabel={labels.menuLabel}
			toggleAriaLabel={labels.menuLabel}
			primaryButtonClassName={buttonClassName}
			menuClassName={dropdownClassName}
			itemButtonClassName={secondaryButtonClassName}
		/>
	);
}
