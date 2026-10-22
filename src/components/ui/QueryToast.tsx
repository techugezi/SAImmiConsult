/*
DOC NAME: QueryToast.tsx
LOCATION: /src/components/ui/QueryToast.tsx
SCOPE: Global query-to-toast mapper (success/error/warn/info); one-time display + query cleanup.
STATUS: UNLOCKED
*/

"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import ToastHost, { ToastPayload, ToastTone } from "@/components/ui/ToastHost";
import { isValidCaseStatus } from "@/config/statuses";

const DEFAULT_CLASSNAMES = {
	host: "toast-host",
	toast: "toast-card",
	top: "toast-top",
	titleRow: "toast-title-row",
	icon: "toast-icon",
	title: "toast-title",
	body: "toast-body",
	close: "toast-close",
	toneSuccess: "toast-tone-success",
	toneError: "toast-tone-error",
	toneWarning: "toast-tone-warning",
	toneInfo: "toast-tone-info",
};

function clampInt(v: string | null, min: number, max: number) {
	if (!v) return null;
	const n = Number.parseInt(v, 10);
	if (!Number.isFinite(n)) return null;
	if (n < min) return min;
	if (n > max) return max;
	return n;
}

function normalizeTone(raw: string | null): ToastTone | null {
	const v = (raw ?? "").trim();
	if (v === "success" || v === "error" || v === "warning" || v === "info") return v;
	return null;
}

export default function QueryToast({
	classNames,
}: {
	classNames?: Partial<typeof DEFAULT_CLASSNAMES>;
}) {
	const sp = useSearchParams();
	const tGlobal = useTranslations("GlobalForm");

	const mergedClassNames = React.useMemo(() => {
		return { ...DEFAULT_CLASSNAMES, ...(classNames ?? {}) };
	}, [classNames]);

	const queryKey = sp.toString();

	const toast: ToastPayload | null = React.useMemo(() => {
		// i18n-only helpers (never emit raw strings)
		const safeT = (key: string, fallbackKey: string) => {
			try {
				return tGlobal(key as any);
			} catch {
				return tGlobal(fallbackKey as any);
			}
		};

		const safeTStatus = (kind: string, status: string) => {
			const base = `Statuses.${kind}.${status}`;
			return safeT(base, "Toast.status.unknown");
		};

		// Explicit generic toast contract:
		// ?toast=success|error|warning|info&toast_code=<enum>&toast_ms=9000
		const explicitTone = normalizeTone(sp.get("toast"));
		const explicitCode = (sp.get("toast_code") ?? "").trim();
		if (explicitTone) {
			const title = safeT(`Toast.titles.${explicitTone}`, "Toast.titles.info");
			const body =
				explicitCode.length > 0
					? safeT(`Toast.codes.${explicitCode}`, "Toast.codes.unknown")
					: safeT("Toast.codes.default", "Toast.codes.unknown");

			const durationMs = clampInt(sp.get("toast_ms"), 12000, 20000) ?? undefined;

			return {
				tone: explicitTone,
				title,
				body,
				sticky: explicitTone === "error",
				durationMs,
				clearQueryKeys: ["toast", "toast_code", "toast_ms"],
			};
		}

		// Priority order: error -> warning -> info -> saved
		const error = (sp.get("error") ?? "").trim();
		if (error.length > 0) {
			return {
				tone: "error",
				title: safeT("Toast.titles.error", "Toast.titles.info"),
				body: safeT(`Toast.errors.${error}`, "Toast.errors.unknown"),
				sticky: true,
				clearQueryKeys: ["error"],
			};
		}

		const warning = (sp.get("warning") ?? "").trim();
		if (warning.length > 0) {
			return {
				tone: "warning",
				title: safeT("Toast.titles.warning", "Toast.titles.info"),
				body: safeT(`Toast.warnings.${warning}`, "Toast.warnings.unknown"),
				sticky: false,
				clearQueryKeys: ["warning"],
			};
		}

		const info = (sp.get("info") ?? "").trim();
		if (info.length > 0) {
			return {
				tone: "info",
				title: safeT("Toast.titles.info", "Toast.titles.info"),
				body: safeT(`Toast.info.${info}`, "Toast.info.unknown"),
				sticky: false,
				clearQueryKeys: ["info"],
			};
		}

		const saved = (sp.get("saved") ?? "").trim();
		if (saved.length > 0) {
			const status = (sp.get("status") ?? "").trim();
			const statusKind = (sp.get("status_kind") ?? "").trim(); // cases | applications | documents

			const title = safeT("Toast.titles.success", "Toast.titles.info");

			const body = (() => {
				if (status.length > 0) {
					if (statusKind === "cases") return safeTStatus("cases", status);
					if (statusKind === "applications") return safeTStatus("applications", status);
					if (statusKind === "documents") return safeTStatus("documents", status);

					// Back-compat: cases status without specifying kind
					if (isValidCaseStatus(status)) return safeTStatus("cases", status);
				}

				return safeT(`Toast.saved.${saved}`, "Toast.saved.unknown");
			})();

			return {
				tone: "success",
				title,
				body,
				sticky: false,
				durationMs: 12000,
				clearQueryKeys: ["saved", "status", "status_kind"],
			};
		}

		return null;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [queryKey, tGlobal]);

	if (!toast) return null;

	return (
		<ToastHost
			toast={toast}
			classNames={mergedClassNames}
			labels={{
				regionAriaLabel: tGlobal("Common.toast.regionLabel"),
				closeButtonAriaLabel: tGlobal("Common.actions.close"),
			}}
		/>
	);
}
