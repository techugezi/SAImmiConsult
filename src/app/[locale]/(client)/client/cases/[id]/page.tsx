/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/(client)/client/cases/[id]/page.tsx
SCOPE: Client Case Detail (read-only) — matches Admin Case Detail layout as closely as possible using shared primitives.
STATUS: LOCKED
AUDIT NOTES (PROD PRIMING):
- Fixed hero typography order to match global hero contract: hero-title then hero-subtitle.
- Removed unused helper/types introduced during audit (contact-link builder) to avoid dead code.
- Preserved client-facing consultant CTAs: WhatsApp + Telegram use siteConfig consultant links (MUST stay).
- Removed placeholder docs summary line (0/0/0) to avoid misleading prod UI until real counts are wired.
APPLIES TO: /src/app/[locale]/(client)/client/cases/[id]/page.tsx
NOTES:
- No hardcoded English UI strings; all user-facing text via i18n (EN/RU only).
- Mirrors admin/cases/[id] layout: hero → IdentityCards → panels (DisclosurePanel).
- Client can view consultant_note (client_cases.consultant_note) and consultation details.
*/

export const dynamic = "force-dynamic";

import "server-only";

import { getLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { Link, getPathname } from "@/i18n/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { siteConfig } from "@/config/siteConfig";

import { PageShell } from "@/components/ui/layout/PageShell";
import { MainColumn } from "@/components/ui/layout/MainColumn";
import { DisclosurePanel } from "@/components/ui/panel/DisclosurePanel";
import StatusStepWizard from "@/components/progression/StatusStepWizard";
import ContactIcon from "@/components/ui/icons/ContactIcon";

import {
	IdentityCards,
	IdentityCard,
	IdentityBadgeRow,
	IdentityLabel,
	IdentityValue,
	IdentityMeta,
	IdentityMono,
} from "@/components/ui/identity/IdentityCards";

import {
	CASE_STATUS,
	getCaseStatusMeta,
	getApplicationStatusMeta,
	getDocumentUiMeta,
	isValidCaseStatus,
	type CaseStatusId,
} from "@/config/statuses";

import styles from "@/styles/casedetails.module.css";

import Timeline from "@/components/ui/timeline/Timeline";
import { normalizeTimelineEvents } from "@/lib/timeline/normalizeTimelineEvents";

/* ──────────────────────────────────────────────────────────────
   Helpers (mirrors admin patterns; client = read-only)
   ────────────────────────────────────────────────────────────── */

function isUuid(value: string) {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function safeIsoToDate(iso: string | null | undefined) {
	if (!iso) return null;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return null;
	return d;
}

function normalizeCaseStatus(value: unknown): CaseStatusId {
	const s = typeof value === "string" ? value.trim() : "";

	if (isValidCaseStatus(s)) return s as CaseStatusId;

	// Client view should not silently “invent” statuses. Use a safe default.
	return CASE_STATUS.DRAFT_INTAKE;
}

function normalizeLocale(raw: unknown) {
	const s = typeof raw === "string" ? raw.trim() : "";
	if (/^[a-z]{2}(-[A-Z]{2})?$/.test(s)) return s;
	return "en";
}

function normalizeId(v: unknown) {
	return typeof v === "string" ? v.trim() : "";
}

/* -------------------------------------------------------------------------- */
/* Consultation Channel Normalisation                                         */
/* -------------------------------------------------------------------------- */

function hasNonEmptyString(v: unknown): v is string {
	return typeof v === "string" && v.trim().length > 0;
}

function normalizeConsultationChannel(v: unknown) {
	return typeof v === "string" ? v.trim() : "";
}

function normalizeEmbeddedOne<T>(value: T | T[] | null | undefined): T | null {
	if (!value) return null;
	if (Array.isArray(value)) return value.length > 0 ? value[0] : null;
	return value;
}

type CaseRow = {
	id: string;
	user_id: string;
	status: string;

	intake_json: any;
	draft_recommendation: any;

	timeline: any;

	consultant_note: string | null;
	consultant_note_updated_at: string | null;

	consultation_channel: string | null;
	consultation_requested_at: string | null;
	consultation_scheduled_for: string | null;
	consultation_link: string | null;

	application_id: string | null;

	created_at: string;
	updated_at: string;

	client_profiles:
	| {
			first_name: string | null;
			middle_name: string | null;
			last_name: string | null;

			contact_email: string | null;
			telegram_username: string | null;
			whatsapp_e164: string | null;

			preferred_contact_method: string | null;
	  }
	| {
			first_name: string | null;
			middle_name: string | null;
			last_name: string | null;

			contact_email: string | null;
			telegram_username: string | null;
			whatsapp_e164: string | null;

			preferred_contact_method: string | null;
	  }[]
	| null;
};

type ApplicationRow = {
	id: string;
	user_id: string;
	application_type: string;
	application_status: string;
	document_status: string;
	destination: string | null;
	timeline: any;
	created_at: string | null;
	updated_at: string | null;
};

export default async function ClientCaseDetailPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
	noStore();

	const resolvedParams = await params;
	const caseId = typeof resolvedParams?.id === "string" ? resolvedParams.id.trim() : "";

	if (!caseId || caseId === "undefined" || !isUuid(caseId)) notFound();

	const sp = searchParams ? await searchParams : {};
	const locale = normalizeLocale(await getLocale());

	const t = await getTranslations("ClientCases");
	const tGlobal = await getTranslations("GlobalForm");
	const tWizard = await getTranslations("ClientStatusStepWizard");

	const na = tGlobal("Common.dates.na");
	const arrowLabel = tGlobal("Common.symbols.arrowRight");
	const chevronLabel = tGlobal("Common.symbols.chevronDown");

	// Auth (client)
	const sessionSupabase = await createServerSupabaseClient();
	const {
		data: { user },
	} = await sessionSupabase.auth.getUser();

	// Unauthenticated → locale-safe login
	if (!user) redirect(`/${locale}${siteConfig.loginPath}`);

	// Load case (must belong to current user)
	const { data: caseRow, error: caseErr } = await sessionSupabase
		.from("client_cases")
		.select(
			`
			id,
			user_id,
			status,
			intake_json,
			draft_recommendation,
			timeline,
			consultant_note,
			consultant_note_updated_at,
			consultation_channel,
			consultation_requested_at,
			consultation_scheduled_for,
			consultation_link,
			application_id,
			created_at,
			updated_at,
			client_profiles (
				first_name,
				middle_name,
				last_name,
				contact_email,
				telegram_username,
				whatsapp_e164,
				preferred_contact_method
			)
	`,
		)
		.eq("id", caseId)
		.eq("user_id", user.id)
		.maybeSingle();

	if (caseErr) notFound();
	if (!caseRow) notFound();

	const c = caseRow as CaseRow;
	
	const profile = normalizeEmbeddedOne(c.client_profiles);

	// Application (optional)
	let app: ApplicationRow | null = null;

	if (c.application_id) {
		const { data: appRow } = await sessionSupabase
			.from("client_applications")
			.select(
				`
		id,
		user_id,
		application_type,
		application_status,
		document_status,
		destination,
		timeline,
		created_at,
		updated_at
	`,
			)
			.eq("id", c.application_id)
			.eq("user_id", user.id)
			.maybeSingle();

		if (appRow) app = appRow as ApplicationRow;
	}

	const fmtShort = new Intl.DateTimeFormat(locale, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});

	const fmtWithTime = new Intl.DateTimeFormat(locale, {
		year: "numeric",
		month: "short",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});

	const createdAt = safeIsoToDate(c.created_at);
	const updatedAt = safeIsoToDate(c.updated_at);

	const appCreatedAt = safeIsoToDate(app?.created_at ?? null);
	const appUpdatedAt = safeIsoToDate(app?.updated_at ?? null);

	const caseStatus = normalizeCaseStatus(c.status);
	const caseMeta = getCaseStatusMeta(caseStatus);

	const isConsultationBooked = caseStatus === CASE_STATUS.CONSULTATION_BOOKED;

	const consultationLink =
		typeof c.consultation_link === "string" ? c.consultation_link.trim() : "";
		
	const consultationChannelIdRaw = normalizeConsultationChannel(c.consultation_channel);

	const showConsultationLinkCta = isConsultationBooked && consultationLink.length > 0;

	const appMeta = app ? getApplicationStatusMeta(app.application_status) : null;
	const docUiMeta = app ? getDocumentUiMeta(app.document_status as any) : null;

	const openParam = typeof sp.open === "string" ? sp.open : "";
	type PanelKey = "intake" | "consultation" | "application" | "timeline";

	// The client journey intentionally hides consultant-only work (profile building,
	// plan drafting, and requirements management). These are grouped into the
	// consultation-to-activation period without exposing internal admin stages.
	const defaultOpenPanel: PanelKey = (() => {
		if (c.application_id || caseStatus === CASE_STATUS.APPLICATION_ACTIVATED) return "application";
	
		// The client should land on the intake summary for both draft_intake
		// AND intake_submitted. Once submitted, step 1 renders with a ✓ (see
		// clientCompletedSteps below) but the panel still opens on intake so
		// the client sees the confirmation of what they submitted.
		if (
			caseStatus === CASE_STATUS.DRAFT_INTAKE ||
			caseStatus === CASE_STATUS.INTAKE_SUBMITTED
		) {
			return "intake";
		}
	
		return "consultation";
	})();

	const wizardKeys = ["intake", "consultation", "activation"] as const;
	const selectedWizardStep = caseStatus === CASE_STATUS.CLOSED || caseStatus === CASE_STATUS.FINISHED
		? caseStatus
		: wizardKeys.includes(openParam as (typeof wizardKeys)[number]) ? openParam : defaultOpenPanel === "application" ? "activation" : defaultOpenPanel;

	const effectiveOpenPanel: PanelKey = selectedWizardStep === "intake" ? "intake"
		: selectedWizardStep === "consultation" ? "consultation"
		: selectedWizardStep === "timeline" ? "timeline"
		: "application";

	const clientCompletedSteps: string[] = [];
	if (caseStatus !== CASE_STATUS.DRAFT_INTAKE) clientCompletedSteps.push("intake");
	if (
		["consultation_completed", "plan_created", "requirements_added", "application_activated", "finished"].includes(caseStatus) ||
		Boolean(c.application_id)
	) clientCompletedSteps.push("consultation");
	if (c.application_id || caseStatus === CASE_STATUS.APPLICATION_ACTIVATED) clientCompletedSteps.push("activation");

	const fullName = (() => {
		const p = profile;
		if (!p) return tGlobal("header.unknownClient");
		const parts = [p.first_name, p.middle_name, p.last_name].filter(
			(x) => typeof x === "string" && x.trim().length > 0,
		);
		return parts.join(" ").trim() || tGlobal("header.unknownClient");
	})();

	function tDestinationFromId(v: unknown) {
		const id = normalizeId(v);
		if (!id) return na;
		return tGlobal(`destinations.${id}` as any);
	}

	function tVisaTypeFromId(v: unknown) {
		const id = normalizeId(v);
		if (!id) return na;
		return tGlobal(`visaTypes.${id}` as any);
	}

	const intakeDestinationLabel = tDestinationFromId(c.intake_json?.destination);
	const intakeVisaTypeLabel = tVisaTypeFromId(c.intake_json?.visaType ?? c.intake_json?.visa_type);

	const clientApplicationDetailsHref = (appId: string) => siteConfig.clientApplicationDetailsHref(appId);

	// Timeline normalized events
	const caseEvents = normalizeTimelineEvents((c as any)?.timeline);
	const appEvents = normalizeTimelineEvents((app as any)?.timeline);

	const timelineEvents = [...caseEvents, ...appEvents].sort(
		(a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
	);

	return (
		<PageShell>
			<header className="hero-shell">
				<div className="hero-inner">
					<h1 className="hero-title">{t("hero.title")}</h1>
					<p className="hero-subtitle">{t("hero.subtitle")}</p>
				</div>
			</header>

			<MainColumn>
				<div className={styles.formInline}>
					<Link href={siteConfig.clientCasesPath} className="button button-ghost">
						<span aria-hidden="true">{tGlobal("Common.symbols.arrowLeft")}</span>
						{tGlobal("header.actions.backToCases")}
					</Link>
				</div>

				{/* ─────────────────────── Identity cards (replaces Overview panel) ─────────────────────── */}
				<IdentityCards
					ariaLabel={t("header.title")}
					actions={
						<>
							{/* OPEN APPLICATION button (when activated) — right side actions rail */}
							{c.application_id ? (
								<Link
									href={clientApplicationDetailsHref(c.application_id)}
									className="button button-secondary"
								>
									{tGlobal("header.actions.openApplication")}
									<span className={styles.arrow} aria-hidden="true">
										{arrowLabel}
									</span>
								</Link>
							) : null}
						</>
					}
				>
					<IdentityCard>
						<IdentityLabel>{t("header.client")}</IdentityLabel>
						<IdentityValue>{fullName}</IdentityValue>

						<IdentityMeta>
							<span className="form-label">{t("header.clickToContactLabel")}</span>

							<div className={styles.formInline}>
								<a
									href={siteConfig.whatsappUrl}
									className="button button-secondary"
									target="_blank"
									rel="noopener noreferrer"
								>
									<ContactIcon method="whatsapp" />
									{t("consultation.clickToContact.action" as any, {
										method: t("consultation.clickToContact.methods.whatsapp" as any),
									})}
									<span className={styles.arrow} aria-hidden="true">
										{arrowLabel}
									</span>
								</a>

								<a
									href={siteConfig.telegramPhoneUrl}
									className="button button-secondary"
									target="_blank"
									rel="noopener noreferrer"
								>
									<ContactIcon method="telegram" />
									{t("consultation.clickToContact.action" as any, {
										method: t("consultation.clickToContact.methods.telegram" as any),
									})}
									<span className={styles.arrow} aria-hidden="true">
										{arrowLabel}
									</span>
								</a>
							</div>
						</IdentityMeta>
					</IdentityCard>

					<IdentityCard>
						<IdentityLabel>{t("header.case")}</IdentityLabel>

						<IdentityBadgeRow>
							<span className={`badge ${caseMeta.badgeTone}`}>
								<span>{tGlobal(`Statuses.cases.${caseMeta.labelKey}`)}</span>
							</span>
						</IdentityBadgeRow>

						{showConsultationLinkCta ? (
							<div className={styles.formInline}>
								<a className="button button-secondary" href={consultationLink} target="_blank" rel="noopener noreferrer">
									{tGlobal("consultation_channel.channelCta" as any, {
										value: consultationChannelIdRaw
											? tGlobal(`consultation_channel.channels.${consultationChannelIdRaw}` as any)
											: na,
									})}
									<span className={styles.arrow} aria-hidden="true">
										{arrowLabel}
									</span>
								</a>
							</div>
						) : null}

						<IdentityMeta>
							{tGlobal("CaseRow.created")} {createdAt ? fmtShort.format(createdAt) : na}
						</IdentityMeta>
						<IdentityMeta>
							{tGlobal("CaseRow.updated")} {updatedAt ? fmtShort.format(updatedAt) : na}
						</IdentityMeta>
					</IdentityCard>

					<IdentityCard>
						<IdentityLabel>{t("header.application")}</IdentityLabel>

						{c.application_id && app ? (
							<>
								<IdentityBadgeRow>
									{appMeta ? (
										<div>
											<span className="form-label">{t("header.applicationBadgeLabels.applicationStatus")}</span>
											<span className={`badge ${appMeta.badgeTone}`}>
												<span>{tGlobal(`Statuses.applications.${appMeta.labelKey}`)}</span>
											</span>
										</div>
									) : null}

								</IdentityBadgeRow>

								<IdentityMeta>
									{tGlobal("CaseRow.created")} {appCreatedAt ? fmtShort.format(appCreatedAt) : na}
								</IdentityMeta>
								<IdentityMeta>
									{tGlobal("CaseRow.updated")} {appUpdatedAt ? fmtShort.format(appUpdatedAt) : na}
								</IdentityMeta>
							</>
						) : (
							<>
								<IdentityMeta>{t("header.noApplicationYet")}</IdentityMeta>
								<IdentityMeta>{t("header.activationHint")}</IdentityMeta>
							</>
						)}
					</IdentityCard>
				</IdentityCards>

				<StatusStepWizard
					ariaLabel={t("header.title")}
					activeStep={selectedWizardStep}
					completedSteps={clientCompletedSteps}
					formatEyebrow={(current, total) =>
						tWizard("eyebrow", { current, total })
					}
					formatStepLabel={(number, label) =>
						tWizard("stepLabel", { number, label })
					}
					stepsNavSuffix={tWizard("stepsNavSuffix")}
					steps={caseStatus === CASE_STATUS.CLOSED || caseStatus === CASE_STATUS.FINISHED ? [
						{ key: caseStatus, label: tGlobal(`Statuses.cases.${caseStatus}`) },
					] : [
						{ key: "intake", label: t("intake.title"), href: "?open=intake#application-wizard" },
						{ key: "consultation", label: t("consultation.title"), href: "?open=consultation#application-wizard" },
						{ key: "activation", label: t("activation.title"), href: "?open=activation#application-wizard" },
					]}
				>

				{/* ─────────────────────── Intake ─────────────────────── */}
				{effectiveOpenPanel === "intake" && <DisclosurePanel
					id="panel-intake"
					title={t("intake.title")}
					subtitle={t("intake.subtitle")}
					defaultOpen={effectiveOpenPanel === "intake"}
					chevronLabel={chevronLabel}
				>
					<div className={`surface-soft ${styles.cardBlock}`}>
						<p className="form-label" style={{ margin: 0 }}>
							{t("intake.keyFacts")}
						</p>

						<div className={styles.kvGrid}>
							<div>
								<p className="form-label" style={{ margin: 0 }}>
									{t("intake.fields.destination")}
								</p>
								<p className="text-md text-bold" style={{ margin: 0 }}>
									{intakeDestinationLabel}
								</p>
							</div>

							<div>
								<p className="form-label" style={{ margin: 0 }}>
									{t("intake.fields.visaType")}
								</p>
								<p className="text-md text-bold" style={{ margin: 0 }}>
									{intakeVisaTypeLabel}
								</p>
							</div>

							<div>
								<p className="form-label" style={{ margin: 0 }}>
									{t("intake.fields.timeframe")}
								</p>
								<p className="text-md text-bold" style={{ margin: 0 }}>
									{typeof c.intake_json?.timeframe === "string" ? c.intake_json.timeframe : na}
								</p>
							</div>

							<div>
								<p className="form-label" style={{ margin: 0 }}>
									{t("intake.fields.extraNotes")}
								</p>
								<p className="text-md text-bold" style={{ margin: 0 }}>
									{typeof c.intake_json?.extraNotes === "string" ? c.intake_json.extraNotes : na}
								</p>
							</div>
						</div>
					</div>
				</DisclosurePanel>}

				{/* ─────────────────────── Consultation (read-only + CTAs + consultant_note) ─────────────────────── */}
				{effectiveOpenPanel === "consultation" && <DisclosurePanel
					id="panel-consultation"
					title={t("consultation.title")}
					subtitle={t("consultation.subtitle")}
					defaultOpen={effectiveOpenPanel === "consultation"}
					chevronLabel={chevronLabel}
				>
					<div className={styles.panelStack}>
						{/* Consultant contact CTA buttons (siteConfig.ts) */}
						<div className={`surface-soft ${styles.cardBlock}`}>
							<p className={`form-label ${styles.noMargin}`}>{t("preview.nextStepTitle")}</p>
							<p className={`text-sm text-muted ${styles.noMargin}`}>{t("consultation.subtitle")}</p>

							<div className={styles.formInline}>
								<a className="button button-secondary" href={siteConfig.whatsappUrl} target="_blank" rel="noopener noreferrer">
									<ContactIcon method="whatsapp" />
									{t("consultation.clickToContact.action" as any, {
										method: t("consultation.clickToContact.methods.whatsapp" as any),
									})}
									<span className={styles.arrow} aria-hidden="true">
										{arrowLabel}
									</span>
								</a>

								<a
									className="button button-secondary"
									href={siteConfig.telegramPhoneUrl}
									target="_blank"
									rel="noopener noreferrer"
								>
									<ContactIcon method="telegram" />
									{t("consultation.clickToContact.action" as any, {
										method: t("consultation.clickToContact.methods.telegram" as any),
									})}
									<span className={styles.arrow} aria-hidden="true">
										{arrowLabel}
									</span>
								</a>
							</div>
						</div>

						{/* Consultation details */}
						<div className={styles.twoCol}>
							<div className={`surface-soft ${styles.cardBlock}`}>
								<p className="form-label" style={{ margin: 0 }}>
									{t("consultation.sections.scheduleTitle")}
								</p>

								<div className={styles.kvGrid}>
									<div>
										<p className="form-label" style={{ margin: 0 }}>
											{t("consultation.fields.channel")}
										</p>
										<p className="text-md text-bold" style={{ margin: 0 }}>
											{consultationChannelIdRaw
												? tGlobal(`consultation_channel.channels.${consultationChannelIdRaw}` as any)
												: na}
										</p>
									</div>

									<div>
										<p className="form-label" style={{ margin: 0 }}>
											{t("consultation.fields.scheduledFor")}
										</p>
										<p className="text-md text-bold" style={{ margin: 0 }}>
											{c.consultation_scheduled_for ? fmtWithTime.format(new Date(c.consultation_scheduled_for)) : na}
										</p>
									</div>

									<div>
										<p className="form-label" style={{ margin: 0 }}>
											{tGlobal("Export.Consultation.requestedAt")}
										</p>
										<p className="text-md text-bold" style={{ margin: 0 }}>
											{c.consultation_requested_at ? fmtWithTime.format(new Date(c.consultation_requested_at)) : na}
										</p>
									</div>

									<div>
										<p className="form-label" style={{ margin: 0 }}>
											{t("consultation.fields.link")}
										</p>

										{hasNonEmptyString(c.consultation_link) ? (
											<a
												className="button button-secondary"
												href={consultationLink}
												target="_blank"
												rel="noopener noreferrer"
											>
												{tGlobal("consultation_channel.channelCta" as any, {
													value: consultationChannelIdRaw
														? tGlobal(`consultation_channel.channels.${consultationChannelIdRaw}` as any)
														: na,
												})}
												<span className={styles.arrow} aria-hidden="true">
													{arrowLabel}
												</span>
											</a>
										) : (
											<p className="text-md text-bold" style={{ margin: 0 }}>
												{na}
											</p>
										)}
									</div>
								</div>
							</div>

							{/* Client-facing consultant note */}
							<div className={`surface-soft ${styles.cardBlock}`}>
								<p className="form-label" style={{ margin: 0 }}>
									{t("plan.fields.consultantNote")}
								</p>
								<p className="text-sm text-muted" style={{ margin: 0 }}>
									{t("consultation.sections.notesHelp")}
								</p>

								<p className="text-md" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
									{c.consultant_note?.trim() ? c.consultant_note : na}
								</p>

								<p className="text-sm text-muted" style={{ margin: 0 }}>
									{c.consultant_note_updated_at ? fmtWithTime.format(new Date(c.consultant_note_updated_at)) : na}
								</p>
							</div>
						</div>
					</div>
				</DisclosurePanel>}

				{/* ─────────────────────── Application ─────────────────────── */}
				{effectiveOpenPanel === "application" && <DisclosurePanel
					id="panel-application"
					title={t("header.application")}
					subtitle={t("activation.subtitle")}
					defaultOpen={effectiveOpenPanel === "application"}
					chevronLabel={chevronLabel}
				>
					{c.application_id && app ? (
						<div className={styles.panelStack}>

							<div className={`surface-soft ${styles.cardBlock}`}>
								<p className="form-label" style={{ margin: 0 }}>
									{t("preview.nextStepTitle")}
								</p>

								<p className="text-md text-bold" style={{ margin: 0 }}>
									{(() => {
										if (app.application_status === "waiting_documents") return tGlobal("preview.app.waitingDocuments");
										if (app.application_status === "documents_under_review") return tGlobal("preview.app.underReview");
										if (app.application_status === "documents_not_approved") return tGlobal("preview.app.notApproved");
										if (app.application_status === "documents_approved") return tGlobal("preview.app.approved");
										return tGlobal("preview.app.default");
									})()}
								</p>

								<p className="text-sm text-muted" style={{ margin: 0 }}>
									{t("activation.activeApplicationBody")}
								</p>

								<Link href={clientApplicationDetailsHref(app.id)} className="button button-primary">
									{tGlobal("header.actions.openApplication")}
									<span className={styles.arrow} aria-hidden="true">
										{arrowLabel}
									</span>
								</Link>

							</div>

						</div>
					) : (
						<div className={`surface-soft ${styles.cardBlock}`}>
							<p className="text-md text-bold" style={{ margin: 0 }}>
								{t("header.noApplicationYet")}
							</p>
							<p className="text-sm text-muted" style={{ margin: 0 }}>
								{t("header.activationHint")}
							</p>
						</div>
					)}
				</DisclosurePanel>}

				</StatusStepWizard>

				{/* ─────────────────────── Timeline ─────────────────────── */}
				<DisclosurePanel
					id="panel-timeline"
					title={tGlobal("Timeline.title")}
					subtitle={tGlobal("Timeline.subtitle")}
					defaultOpen={timelineEvents.length > 0}
					chevronLabel={chevronLabel}
				>
					<Timeline locale={locale} dateNaLabel={tGlobal("Common.dates.na")} events={timelineEvents} translate={tGlobal} />
				</DisclosurePanel>
			</MainColumn>
		</PageShell>
	);
}
