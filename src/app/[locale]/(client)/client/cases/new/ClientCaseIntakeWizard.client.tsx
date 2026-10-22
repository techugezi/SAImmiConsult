/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/(client)/client/cases/new/page.tsx
SCOPE: Client new case wizard (client-side). Uses global primitives + global form roles.
STATUS: LOCKED
AUDIT NOTES (PROD PRIMING):
- Removed prod-nuisance logging: eliminated console.error/console.warn output paths and the verbose PostgREST logger.
- Ensured locale-aware redirect after create (uses Link/router from i18n layer; target remains within locale segment).
- Tightened i18n safety: visa type label rendering uses safeT() to avoid crashes from missing keys (no fallbacks added).
- Prevents setState-after-unmount during async visa type load (cancel flag retained).
- Keeps the allowed_countries destination filtering + ancestor inclusion logic as-is (DB-driven, deterministic).
APPLIES TO: /src/app/[locale]/(client)/client/cases/new/page.tsx
NOTES:
- No hardcoded English UI strings; all user-facing text via i18n.
- Redirects to /client/cases after successful submit (with confirmation message).
- Guards against double submit (UI + ref).
*/

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";

import { siteConfig } from "@/config/siteConfig";

import styles from "./wizard.module.css";

import { DESTINATIONS, type Destination } from "@/config/visaQuestionConfig";

import { createNewCase } from "@/components/server/createNewCase";
import { getVisaTypesForClientWizard } from "@/components/server/getVisaTypesForClientWizard";
import { PageShell } from "@/components/ui/layout/PageShell";
import { MainColumn } from "@/components/ui/layout/MainColumn";

type WizardFormData = {
	destination: Destination | "";
	visaType: string;
	timeframe: string;
	extraNotes: string;
};

function safeT(t: (key: string, values?: Record<string, any>) => string, key: string): string | null {
	try {
		return t(key);
	} catch {
		return null;
	}
}

export default function ClientCaseIntakeWizardPage() {
	const t = useTranslations("ClientCaseIntakeWizard");
	const tGlobal = useTranslations("GlobalForm");

	const router = useRouter();

	const [step, setStep] = useState(1);
	const [loading, setLoading] = useState(false);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [didCreate, setDidCreate] = useState(false);

	const [formData, setFormData] = useState<WizardFormData>({
		destination: "",
		visaType: "",
		timeframe: "",
		extraNotes: "",
	});

	const submittedRef = useRef(false);
	const redirectTimerRef = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			if (redirectTimerRef.current) {
				window.clearTimeout(redirectTimerRef.current);
			}
		};
	}, []);

	const arrowRight = tGlobal("Common.symbols.arrowRight");
	const arrowLeft = tGlobal("Common.symbols.arrowLeft");

	// ─────────────────────────────────────────────
	// Visa types (final application type dropdown)
	// ─────────────────────────────────────────────
	type VisaTypeRow = {
		id: string;
		name_key: string;
		parent_id: string | null;
		kind: "group" | "type" | "subcategory";
		jurisdiction: string;
		sort_order: number;
		allowed_countries?: string[];
	};

	const [visaTypesRows, setVisaTypesRows] = useState<VisaTypeRow[]>([]);

	useEffect(() => {
		let cancelled = false;

		(async () => {
			try {
				const rows = await getVisaTypesForClientWizard();
				if (!cancelled) setVisaTypesRows(((rows ?? []) as VisaTypeRow[]) ?? []);
			} catch {
				if (!cancelled) setVisaTypesRows([]);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	const filteredVisaTypesRows = useMemo(() => {
		const all = (visaTypesRows ?? []) as VisaTypeRow[];

		const dest = String(formData.destination || "").trim();
		if (!dest) return all;

		const byId = new Map<string, VisaTypeRow>();
		for (const r of all) byId.set(r.id, r);

		const included = new Set<string>();

		function includeWithAncestors(id: string) {
			let cur = byId.get(id);
			while (cur) {
				if (included.has(cur.id)) break;
				included.add(cur.id);

				if (!cur.parent_id) break;
				cur = byId.get(cur.parent_id);
			}
		}

		for (const r of all) {
			const allowed = (r.allowed_countries ?? []).map((x) => String(x).trim());
			if (allowed.includes(dest)) {
				includeWithAncestors(r.id);
			}
		}

		return all.filter((r) => included.has(r.id));
	}, [visaTypesRows, formData.destination]);

	const { childrenByParent, topLevel } = useMemo(() => {
		const visaTypes = (filteredVisaTypesRows ?? []) as VisaTypeRow[];

		const childrenByParent = new Map<string, VisaTypeRow[]>();
		for (const v of visaTypes) {
			if (!v.parent_id) continue;
			const arr = childrenByParent.get(v.parent_id) ?? [];
			arr.push(v);
			childrenByParent.set(v.parent_id, arr);
		}

		for (const arr of childrenByParent.values()) {
			arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id));
		}

		const topLevel = visaTypes
			.filter((v) => !v.parent_id)
			.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id));

		return { childrenByParent, topLevel };
	}, [filteredVisaTypesRows]);

	useEffect(() => {
		if (!formData.visaType) return;
		const exists = filteredVisaTypesRows.some((r) => r.id === formData.visaType);
		if (exists) return;

		setFormData((prev) => ({ ...prev, visaType: "" }));
	}, [filteredVisaTypesRows, formData.visaType]);

	const isStep1Valid = Boolean(formData.destination);
	const isStep2Valid = Boolean(formData.visaType);

	const isBusy = loading || didCreate;

	const handleNext = () => {
		if (isBusy) return;
		setStep((prev) => Math.min(3, prev + 1));
	};

	const handleBack = () => {
		if (isBusy) return;
		setStep((prev) => Math.max(1, prev - 1));
	};

	const handleSubmit = async () => {
		if (loading || submittedRef.current || didCreate) return;

		if (!formData.destination || !formData.visaType) {
			setErrorMsg(t("errors.missingRequired"));
			return;
		}

		submittedRef.current = true;
		setLoading(true);
		setDidCreate(false);
		setErrorMsg(null);

		try {
			await createNewCase({
				destination: formData.destination,
				visaType: formData.visaType,
				timeframe: formData.timeframe,
				extraNotes: formData.extraNotes,
			});

			setDidCreate(true);

			// Locale-aware (Link/router from i18n layer). Keep path under /[locale]/...
			const target = {
				pathname: siteConfig.clientCasesPath,
				query: { created: "1" },
			} as const;
			
			redirectTimerRef.current = window.setTimeout(() => {
				router.replace(target);
			}, 3000);
		} catch (err) {
			submittedRef.current = false;

			const msg = err instanceof Error && typeof err.message === "string" ? err.message : "";
			const key = msg.startsWith("errors.") ? msg : "errors.submitFailed";
			setErrorMsg(t(key));
		} finally {
			setLoading(false);
		}
	};

	const destinationLabel = formData.destination ? tGlobal(`destinations.${String(formData.destination)}`) : "";

	// IMPORTANT: in this wizard, formData.visaType is an ID (not an i18n key).
	// We only render the final label in Step 3 from the selected row’s name_key.
	const selectedVisaRow = useMemo(() => {
		if (!formData.visaType) return null;
		return (filteredVisaTypesRows ?? []).find((r) => r.id === formData.visaType) ?? null;
	}, [filteredVisaTypesRows, formData.visaType]);

	const visaTypeLabel =
		selectedVisaRow?.name_key ? safeT(tGlobal, `visaTypes.${selectedVisaRow.name_key}`) ?? "" : "";

	return (
		<PageShell>
			<header className="hero-shell">
				<div className="hero-inner">
					<h1 className="hero-title">{t("eyebrow")}</h1>
					<p className="hero-subtitle">{t("title")}</p>
					<p className="hero-desc">{t("subtitle")}</p>
				</div>
			</header>

			<MainColumn>
				<div className={styles.formInline}>
					<Link href={siteConfig.clientCasesPath} className="button button-ghost">
						<span aria-hidden="true">{arrowLeft}</span>
						{tGlobal("header.actions.backToCases")}
					</Link>
				</div>

				<section className={`surface-soft ${styles.card}`}>
					<div className={styles.stepper} aria-label={t("a11y.progressLabel")}>
						<div className={styles.stepperHead}>
							<span
								className={`form-label ${step === 1 ? "text-black" : ""}`}
								aria-current={step === 1 ? "step" : undefined}
							>
								{t("steps.1")}
							</span>

							<span
								className={`form-label ${step === 2 ? "text-black" : ""}`}
								aria-current={step === 2 ? "step" : undefined}
							>
								{t("steps.2")}
							</span>

							<span
								className={`form-label ${step === 3 ? "text-black" : ""}`}
								aria-current={step === 3 ? "step" : undefined}
							>
								{t("steps.3")}
							</span>
						</div>

						<div className={`wizard-progress ${styles.stepperProgress}`}>
							<div className={`wizard-progressSegment ${step >= 1 ? "isFilled" : ""}`} />
							<div className={`wizard-progressSegment ${step >= 2 ? "isFilled" : ""}`} />
							<div className={`wizard-progressSegment ${step >= 3 ? "isFilled" : ""}`} />
						</div>
					</div>

					{errorMsg && (
						<div className="alert badge-caution" role="alert">
							{errorMsg}
						</div>
					)}

					{didCreate && (
						<div className="alert badge-success" role="status">
							{t("messages.createdRedirecting")}
						</div>
					)}

					{step === 1 && (
						<div className={styles.form}>
							<div className={styles.block}>
								<label className="form-label" htmlFor="destination">
									{t("step1.question")}
								</label>

								<select
									id="destination"
									className="form-control"
									value={formData.destination}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											destination: e.target.value as Destination,
											visaType: "",
										}))
									}
									disabled={isBusy}
								>
									<option value="">{t("step1.placeholder")}</option>

									{DESTINATIONS.map((dest) => (
										<option key={dest.value} value={dest.value}>
											{tGlobal(`destinations.${dest.value}`)}
										</option>
									))}
								</select>
							</div>

							<div className={styles.actions}>
								<div className={styles.actionsLeft} />
								<div className={styles.actionsRight}>
									<button
										type="button"
										onClick={handleNext}
										disabled={!isStep1Valid || isBusy}
										className="button button-primary"
									>
										<span>{t("actions.next")}</span>
										<span aria-hidden="true">{arrowRight}</span>
									</button>
								</div>
							</div>
						</div>
					)}

					{step === 2 && (
						<div className={styles.form}>
							<div className={styles.block}>
								<label className="form-label" htmlFor="visaType">
									{t("step2.question")}
								</label>

								<select
									id="visaType"
									className="form-control"
									value={formData.visaType}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											visaType: e.target.value,
										}))
									}
									disabled={isBusy}
								>
									<option value="">{t("step2.placeholder")}</option>

									{topLevel.map((v) => {
										const kids = childrenByParent.get(v.id) ?? [];
										const groupLabel = safeT(tGlobal, `visaTypes.${v.name_key}`) ?? "";

										if (v.kind === "group" || kids.length > 0) {
											return (
												<optgroup key={v.id} label={groupLabel}>
													{v.kind !== "group" ? (
														<option value={v.id}>{groupLabel}</option>
													) : null}

													{kids.map((k) => {
														const childLabel = safeT(tGlobal, `visaTypes.${k.name_key}`) ?? "";
														return (
															<option key={k.id} value={k.id}>
																{childLabel}
															</option>
														);
													})}
												</optgroup>
											);
										}

										return (
											<option key={v.id} value={v.id}>
												{groupLabel}
											</option>
										);
									})}
								</select>
							</div>

							<div className={styles.actions}>
								<div className={styles.actionsLeft}>
									<button
										type="button"
										onClick={handleBack}
										className="button button-secondary"
										disabled={isBusy}
									>
										{t("actions.back")}
									</button>
								</div>

								<div className={styles.actionsRight}>
									<button
										type="button"
										onClick={handleNext}
										disabled={!isStep2Valid || isBusy}
										className="button button-primary"
									>
										<span>{t("actions.next")}</span>
										<span aria-hidden="true">{arrowRight}</span>
									</button>
								</div>
							</div>
						</div>
					)}

					{step === 3 && (
						<div className={styles.form}>
							<div className={styles.grid2}>
								<div className={styles.block}>
									<p className="form-label">{t("step3.destination")}</p>
									<p className="text-md text-strong">{destinationLabel}</p>
								</div>

								<div className={styles.block}>
									<p className="form-label">{t("step3.visaType")}</p>
									<p className="text-md text-strong">{visaTypeLabel}</p>
								</div>
							</div>

							<div className={styles.grid2}>
								<div className={`${styles.block} ${styles.full}`}>
									<label className="form-label" htmlFor="timeframe">
										{t("step3.timeframe.label")}
									</label>
									<input
										id="timeframe"
										className="form-control"
										value={formData.timeframe}
										onChange={(e) => setFormData((prev) => ({ ...prev, timeframe: e.target.value }))}
										placeholder={t("step3.timeframe.placeholder")}
										disabled={isBusy}
									/>
								</div>

								<div className={`${styles.block} ${styles.full}`}>
									<label className="form-label" htmlFor="extraNotes">
										{t("step3.notes.label")}
									</label>
									<textarea
										id="extraNotes"
										className="form-control form-control-note"
										rows={4}
										value={formData.extraNotes}
										onChange={(e) => setFormData((prev) => ({ ...prev, extraNotes: e.target.value }))}
										placeholder={t("step3.notes.placeholder")}
										disabled={isBusy}
									/>
								</div>
							</div>

							<div className={styles.actions}>
								<div className={styles.actionsLeft}>
									<button
										type="button"
										onClick={handleBack}
										className="button button-secondary"
										disabled={isBusy}
									>
										{t("actions.back")}
									</button>
								</div>

								<div className={styles.actionsRight}>
									<button type="button" onClick={handleSubmit} disabled={isBusy} className="button button-primary">
										{loading ? t("actions.submitting") : t("step3.cta")}
									</button>
								</div>
							</div>

							<p className="hero-desc">{t("step3.disclaimer")}</p>
						</div>
					)}
				</section>
			</MainColumn>
		</PageShell>
	);
}
