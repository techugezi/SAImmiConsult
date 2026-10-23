/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/(client)/client/applications/[id]/page.tsx
SCOPE: Client application details. Data fetch + composition only (no UI primitives redefined here).
STATUS: UNLOCKED
AUDITED:
- Server-only page with noStore() + auth.getUser() (server-verified) and user-owned row enforcement (eq user_id).
- Locale-aware formatting (Intl.DateTimeFormat) and locale-safe redirects via siteConfig routes.
- Requirements are DB-truth from client_application_requirements only; uploaded documents come from client_documents scoped to user + application.
- Document type metadata lookup is limited to required doc type ids and used only for enforcement (format_group).
- Status labels/tones are derived from canonical enums (applications/cases/documents) with i18n keys (no hardcoded UI copy).
- Reuses admin identity-card CSS module intentionally to match spacing/placements exactly (no CSS refactor required).
NOTES:
- No typography/colors in this file; layout is via global primitives + existing module CSS.
CONTENT:
*/

export const dynamic = "force-dynamic";

import "server-only";

import StatusStepWizard, {
  getApplicationCompletedStepKeys,
  getApplicationWizardStepKey,
} from "@/components/progression/StatusStepWizard";

import { unstable_noStore as noStore } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { siteConfig } from "@/config/siteConfig";

import { DisclosurePanel } from "@/components/ui/panel/DisclosurePanel";

import {
  APPLICATION_STATUS,
  getApplicationStatusMeta,
  getCaseStatusMeta,
  getDocumentUiMeta,
  isValidApplicationStatus,
  isValidCaseStatus,
  type ApplicationStatusId,
  type CaseStatusId,
  type DocumentStatusId,
} from "@/config/statuses";

import { PageShell } from "@/components/ui/layout/PageShell";
import { MainColumn } from "@/components/ui/layout/MainColumn";
import DocumentRequirementRowStateful from "@/components/ui/DocumentRequirementRowStateful";

import {
  IdentityCards,
  IdentityCard,
  IdentityLabel,
  IdentityValue,
  IdentityMeta,
  IdentityMono,
  IdentityBadgeRow,
  IdentityStack,
} from "@/components/ui/identity/IdentityCards";

import ContactIcon from "@/components/ui/icons/ContactIcon";

import styles from "@/styles/cases.module.css";
//import localStyles from "./details.module.css";
import localStyles from "@/styles/applicationdetails.module.css";
import adminIdentityStyles from "./details.module.css";

import Timeline from "@/components/ui/timeline/Timeline";
import { normalizeTimelineEvents } from "@/lib/timeline/normalizeTimelineEvents";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type UploadedDocumentDb = {
  id: string;
  document_type_id: string;
  status: DocumentStatusId;
  notes: string | null;
  uploaded_at: string;
  status_updated_at: string | null;
  application_id: string;
  file_name: string | null;
  copy_number: number | null;
};

type RequirementDb = {
  document_type_id: string;
  required: boolean;
};

type DocumentTypeMetaDb = {
  id: string;
  format_group: string | null;
};

type ClientApplicationDb = {
  id: string;
  user_id: string;

  application_type: string;
  application_status: string | null;
  document_status: string | null;

  consultant_note: string | null;
  consultant_note_updated_at: string | null;

  destination: string | null;

  drive_application_folder_id: string | null;

  timeline: any;

  created_at: string;
  updated_at: string | null;
};

type ClientCaseDb = {
  id: string;
  user_id: string;
  status: string | null;
  application_id: string | null;

  timeline: any;

  created_at: string;
  updated_at: string | null;
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function safeDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string") return null;

  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeEnumKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_").replace(/-+/g, "_");
}

function normalizeApplicationStatus(value: unknown): ApplicationStatusId {
  if (typeof value !== "string") return APPLICATION_STATUS.NOT_STARTED;

  const s = value.trim();
  return isValidApplicationStatus(s)
    ? (s as ApplicationStatusId)
    : APPLICATION_STATUS.NOT_STARTED;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function truncate(value: string, max = 250) {
  const v = value.trim();
  if (v.length <= max) return v;
  return `${v.slice(0, max - 1)}…`;
}

function safeT(
  t: (key: string, values?: Record<string, any>) => string,
  key: string,
): string | null {
  try {
    return t(key);
  } catch {
    return null;
  }
}

function tOr(
  t: (key: string, values?: Record<string, any>) => string,
  key: string,
  fallbackKey: string,
): string {
  const v = safeT(t, key);
  return v ?? t(fallbackKey);
}

async function assertClientOrRedirect(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const locale = await getLocale();
    redirect(`/${locale}${siteConfig.loginPath}`);
  }

  return { userId: user.id };
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function ApplicationDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();

  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const requestedPanel = typeof sp.open === "string" ? sp.open : "";

  const supabase = await createServerSupabaseClient();
  const { userId } = await assertClientOrRedirect(supabase);

  const tDocs = await getTranslations("ClientDocuments");
  const tApps = await getTranslations("ClientApplications");
  const tGlobal = await getTranslations("GlobalForm");
  const locale = await getLocale();
  const tWizard = await getTranslations("ClientStatusStepWizard");

  const fmtShort = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Rewrites bracket-prefixed ISO timestamps inside a note (as written by
  // the admin bulk action, e.g. "[2026-10-23T14:37:12.847Z]") into the
  // current locale. Non-ISO bracket content like "[DHA]" is left alone.
  function formatNoteTimestamps(raw: string): string {
    return raw.replace(
      /\[\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s*\]/g,
      (match, iso: string) => {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return match;
        return `[${fmtShort.format(d)}]`;
      },
    );
  }

  const dateNa = tGlobal("Common.dates.na");
  const arrowLeft = tGlobal("Common.symbols.arrowLeft");
  const arrowRight = tGlobal("Common.symbols.arrowRight");

  /* ------------------------------------------------------------------------ */
  /* Application (owned by user)                                               */
  /* ------------------------------------------------------------------------ */

  const { data: app, error: appError } = await supabase
    .from("client_applications")
    .select(
      [
        "id",
        "user_id",
        "application_type",
        "application_status",
        "document_status",
        "destination",
        "drive_application_folder_id",
        "timeline",
        "consultant_note",
        "consultant_note_updated_at",
        "created_at",
        "updated_at",
      ].join(","),
    )
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (appError || !app) {
    const locale = await getLocale();
    redirect(`/${locale}${siteConfig.clientApplicationsPath}`);
  }

  const application = app as unknown as ClientApplicationDb;

  /* ------------------------------------------------------------------------ */
  /* Linked case (for identity card + Open Case button)                        */
  /* ------------------------------------------------------------------------ */

  const { data: caseRow } = await supabase
    .from("client_cases")
    .select(
      [
        "id",
        "user_id",
        "status",
        "application_id",
        "timeline",
        "created_at",
        "updated_at",
      ].join(","),
    )
    .eq("application_id", id)
    .eq("user_id", userId)
    .maybeSingle();

  const linkedCase = (caseRow ?? null) as unknown as ClientCaseDb | null;

  /* ------------------------------------------------------------------------ */
  /* Client name (upload context)                                              */
  /* ------------------------------------------------------------------------ */

  const { data: clientProfile } = await supabase
    .from("client_profiles")
    .select("first_name, last_name")
    .eq("user_id", userId)
    .maybeSingle();

  const clientName =
    `${safeString(clientProfile?.first_name)} ${safeString(clientProfile?.last_name)}`.trim() ||
    userId;

  /* ------------------------------------------------------------------------ */
  /* Requirements (DB truth — ONLY from client_application_requirements)       */
  /* ------------------------------------------------------------------------ */

  const { data: reqRows, error: reqError } = await supabase
    .from("client_application_requirements")
    .select("document_type_id, required")
    .eq("application_id", id);

  if (reqError) throw new Error(reqError.message);

  const requirementsRaw = (reqRows ?? []) as unknown as RequirementDb[];
  const requirements = requirementsRaw.map((r) => ({
    ...r,
    document_type_id: safeString(r.document_type_id).trim(),
  }));

  const hasRequirements = requirements.length > 0;

  /* ------------------------------------------------------------------------ */
  /* Lookup: document_types.format_group (needed for enforcement)              */
  /* ------------------------------------------------------------------------ */

  const reqDocTypeIds = [
    ...new Set(requirements.map((r) => r.document_type_id).filter(Boolean)),
  ];

  let docTypesById = new Map<string, DocumentTypeMetaDb>();

  if (reqDocTypeIds.length > 0) {
    const { data: dtRows, error: dtError } = await supabase
      .from("document_types")
      .select("id, format_group")
      .in("id", reqDocTypeIds);

    if (dtError) throw new Error(dtError.message);

    const normalized = (dtRows ?? []).map((r) => ({
      id: safeString((r as any).id).trim(),
      format_group: (r as any).format_group ?? null,
    }));

    docTypesById = new Map(normalized.map((r) => [r.id, r]));
  }

  /* ------------------------------------------------------------------------ */
  /* Uploaded documents                                                        */
  /* ------------------------------------------------------------------------ */

  const { data: docRows, error: docError } = await supabase
    .from("client_documents")
    .select(
      [
        "id",
        "document_type_id",
        "status",
        "notes",
        "uploaded_at",
        "status_updated_at",
        "application_id",
        "file_name",
        "copy_number",
      ].join(","),
    )
    .eq("application_id", id)
    .eq("user_id", userId);

  if (docError) throw new Error(docError.message);

  const documents = (docRows ?? []) as unknown as UploadedDocumentDb[];

  const latestByType = new Map<string, UploadedDocumentDb>();
  for (const d of documents) {
    const key = safeString(d.document_type_id).trim();
    const cur = latestByType.get(key);
    if (!cur) {
      latestByType.set(key, d);
      continue;
    }

    const a = safeDate(cur.uploaded_at)?.getTime() ?? 0;
    const b = safeDate(d.uploaded_at)?.getTime() ?? 0;

    if (b !== a) {
      if (b > a) latestByType.set(key, d);
      continue;
    }

    const ac = cur.copy_number ?? 0;
    const bc = d.copy_number ?? 0;

    if (bc >= ac) latestByType.set(key, d);
  }

  /* ------------------------------------------------------------------------ */
  /* Status (needed for step routing below)                                   */
  /* ------------------------------------------------------------------------ */

  const status = normalizeApplicationStatus(application.application_status);
  const docStatusRaw = safeString(application.document_status).trim();

  /* ------------------------------------------------------------------------ */
  /* Document count                                                           */
  /* ------------------------------------------------------------------------ */

  const requiredTypeIds = requirements
    .filter((r) => r.required)
    .map((r) => safeString(r.document_type_id).trim())
    .filter(Boolean);

  const requiredCount = requiredTypeIds.length;

  const uploadedCount = requiredTypeIds.reduce((acc, docTypeId) => {
    return latestByType.get(docTypeId) ? acc + 1 : acc;
  }, 0);

  const approvedCount = requiredTypeIds.reduce((acc, docTypeId) => {
    const d = latestByType.get(docTypeId);
    return d && d.status === "approved" ? acc + 1 : acc;
  }, 0);

  const docsProgress = {
    requiredCount,
    uploadedCount,
    approvedCount,
  };

  // Keep this only for panel copy ("X documents need resubmission").
  const hasRequiredDocResubmission = requiredTypeIds.some((docTypeId) => {
    const doc = latestByType.get(docTypeId);
    return doc?.status === "resubmit" || doc?.status === "rejected";
  });

  const clientStatusIsDocumentStage =
    status === APPLICATION_STATUS.NOT_STARTED ||
    status === APPLICATION_STATUS.WAITING_DOCUMENTS ||
    status === APPLICATION_STATUS.DOCUMENTS_UNDER_REVIEW ||
    status === APPLICATION_STATUS.DOCUMENTS_NOT_APPROVED;

  // Drives the step-1 label and panel copy only. NEVER step routing.
  // Step routing uses `status` (application_status) exclusively — see
  // `forceClientDocumentsStep` below.
  const awaitingClientDocuments =
    clientStatusIsDocumentStage && requiredCount > 0 && uploadedCount === 0;

  const docsSummaryLabel = tGlobal("ApplicationRow.docsSummary", {
    uploaded: docsProgress.uploadedCount,
    required: docsProgress.requiredCount,
    approved: docsProgress.approvedCount,
  });

  /* ------------------------------------------------------------------------ */
  /* Derived (title / status)                                                  */
  /* ------------------------------------------------------------------------ */

  const documentStageStatuses: ApplicationStatusId[] = [
    APPLICATION_STATUS.NOT_STARTED,
    APPLICATION_STATUS.WAITING_DOCUMENTS,
    APPLICATION_STATUS.DOCUMENTS_UNDER_REVIEW,
    APPLICATION_STATUS.DOCUMENTS_NOT_APPROVED,
  ];

  const isDocumentStage = documentStageStatuses.includes(status);

  // Only force step 1 when the application_status is itself a document
  // status. Resubmit history and document_status are NOT consulted here so
  // that once the app advances to visa_journey_started / visa_approved /
  // finished, step 1 is rendered as checked and step 2/3 becomes current.
  const forceClientDocumentsStep = clientStatusIsDocumentStage;

  const defaultClientStep = forceClientDocumentsStep
    ? "documents"
    : getApplicationWizardStepKey(status);

  const requestedClientStep = ["documents", "visa_journey", "outcome"].includes(
    requestedPanel,
  )
    ? requestedPanel
    : "";
  // A document resubmission request always returns the client to Step 1,
  // overriding stale deep links to the visa journey or outcome.
  const activeWizardStep = forceClientDocumentsStep
    ? "documents"
    : requestedPanel === "timeline"
      ? "timeline"
      : requestedClientStep || defaultClientStep;

  const statusMeta = getApplicationStatusMeta(status);

  const statusDescription = safeT(
    tApps,
    `statuses.${statusMeta.descriptionKey}`,
  );

  const typeKey = normalizeEnumKey(application.application_type);
  const typeLabel = tOr(tGlobal, `visaTypes.${typeKey}`, "visaTypes.unknown");

  const destinationKey =
    typeof application.destination === "string" &&
    application.destination.trim().length > 0
      ? normalizeEnumKey(application.destination)
      : "";

  const destinationLabel = destinationKey
    ? tOr(tGlobal, `destinations.${destinationKey}`, "destinations.unknown")
    : "";

  const heroTitle = destinationLabel || typeLabel;
  const heroSubtitle = destinationLabel ? typeLabel : "";

  const applicationFolderId = application.drive_application_folder_id ?? "";

  const appCreatedAt = safeDate(application.created_at);
  const appUpdatedAt = safeDate(application.updated_at);

  const appCreatedLabel = appCreatedAt ? fmtShort.format(appCreatedAt) : dateNa;
  const appUpdatedLabel = appUpdatedAt ? fmtShort.format(appUpdatedAt) : dateNa;

  const caseCreatedAt = safeDate(linkedCase?.created_at);
  const caseUpdatedAt = safeDate(linkedCase?.updated_at);

  const caseCreatedLabel = caseCreatedAt
    ? fmtShort.format(caseCreatedAt)
    : dateNa;
  const caseUpdatedLabel = caseUpdatedAt
    ? fmtShort.format(caseUpdatedAt)
    : dateNa;

  const caseStatusRaw = safeString(linkedCase?.status).trim();

  const caseMeta =
    caseStatusRaw.length > 0 && isValidCaseStatus(caseStatusRaw)
      ? getCaseStatusMeta(caseStatusRaw as CaseStatusId)
      : null;

  const caseStatusTone = caseMeta ? caseMeta.badgeTone : "badge-neutral";

  const caseStatusLabel = caseMeta
    ? tGlobal(`Statuses.cases.${caseMeta.labelKey}` as any)
    : caseStatusRaw.length > 0
      ? caseStatusRaw
      : dateNa;

  const docStatusTone =
    docStatusRaw === "approved"
      ? "badge-success"
      : docStatusRaw === "pending"
        ? "badge-neutral"
        : docStatusRaw === "resubmit" || docStatusRaw === "rejected"
          ? "badge-caution"
          : "badge-neutral";

  const docStatusLabel =
    (docStatusRaw.length > 0
      ? safeT(tGlobal, `Statuses.documents.${docStatusRaw as any}`)
      : null) ?? (docStatusRaw.length > 0 ? docStatusRaw : dateNa);

  const chevronLabel = tGlobal("Common.symbols.chevronDown");

  //const caseStatusTone = inferCaseBadgeTone(caseStatusRaw);
  //const caseStatusLabel =
  //	(caseStatusRaw.length > 0 ? safeT(tGlobal, `Statuses.cases.${caseStatusRaw}`) : null) ??
  //	(caseStatusRaw.length > 0 ? caseStatusRaw : dateNa);

  //const docStatusRaw = safeString(application.document_status).trim();
  //const docStatusTone = docStatusRaw.length > 0 ? inferDocumentBadgeTone(docStatusRaw) : "badge-neutral";
  //const docStatusLabel =
  //	(docStatusRaw.length > 0 ? safeT(tGlobal, `Statuses.documents.${docStatusRaw as any}`) : null) ??
  //	(docStatusRaw.length > 0 ? docStatusRaw : dateNa);

  const contactMetaLabel =
    safeT(tApps, "overview.contactConsultant") ??
    safeT(tApps, "contact.contactConsultant") ??
    safeT(tGlobal, "Common.contact.contactConsultant") ??
    tGlobal("header.clickToContact.label");

  const whatsappLabel =
    safeT(tApps, "contact.methods.whatsapp") ??
    safeT(tApps, "contact.whatsapp") ??
    safeT(tGlobal, "Common.contact.methods.whatsapp") ??
    tGlobal("header.clickToContact.methods.whatsapp");

  const telegramLabel =
    safeT(tApps, "contact.methods.telegram") ??
    safeT(tApps, "contact.telegram") ??
    safeT(tGlobal, "Common.contact.methods.telegram") ??
    tGlobal("header.clickToContact.methods.telegram");

  const openCaseLabel =
    safeT(tApps, "navigation.openCase") ??
    safeT(tGlobal, "Common.actions.openCase") ??
    safeT(tGlobal, "actions.openCase") ??
    dateNa;

  const consultantLinks = [
    {
      key: "whatsapp" as const,
      href: siteConfig.whatsappUrl,
      label: whatsappLabel,
      iconLabel: whatsappLabel,
    },
    {
      key: "telegram" as const,
      href: siteConfig.telegramPhoneUrl,
      label: telegramLabel,
      iconLabel: telegramLabel,
    },
  ].filter((x) => typeof x.href === "string" && x.href.trim().length > 0);

  const applicationFolderIdForUpload = applicationFolderId;

  /* ------------------------------------------------------------------------ */
  /* Timeline (merged: case + application)                                     */
  /* ------------------------------------------------------------------------ */

  const caseEvents = normalizeTimelineEvents(linkedCase?.timeline);
  const appEvents = normalizeTimelineEvents(application?.timeline);

  const timelineEvents = [...caseEvents, ...appEvents].sort(
    (a, b) =>
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );

  /* ------------------------------------------------------------------------ */
  /* Render                                                                    */
  /* ------------------------------------------------------------------------ */

  return (
    <PageShell>
      <header className="hero-shell">
        <div className="hero-inner">
          <div className={localStyles.headerTextStack}>
            <h1 className="hero-title">{heroTitle}</h1>
            {heroSubtitle ? (
              <p className="hero-subtitle">{heroSubtitle}</p>
            ) : null}
            {statusDescription ? (
              <p className="hero-desc">{statusDescription}</p>
            ) : null}
          </div>
        </div>
      </header>

      <MainColumn>
        <div className={styles.formInline}>
          <Link
            href={siteConfig.clientApplicationsPath}
            className="button button-ghost"
          >
            <span aria-hidden="true">{arrowLeft}</span>
            {tGlobal("header.actions.backToApplications")}
          </Link>
        </div>
        {/* Identity cards + actions (match admin/applications/[id]) */}
        <IdentityCards
          ariaLabel={heroTitle}
          actions={
            linkedCase?.id ? (
              <Link
                href={siteConfig.clientCaseDetailsHref(linkedCase.id)}
                className="button button-secondary"
              >
                {openCaseLabel}
                <span className={adminIdentityStyles.arrow} aria-hidden="true">
                  {arrowRight}
                </span>
              </Link>
            ) : null
          }
        >
          {/* Card 1: Client */}
          <IdentityCard>
            <IdentityLabel>
              {safeT(tGlobal, "header.client") ?? tGlobal("header.client")}
            </IdentityLabel>
            <IdentityValue>{clientName}</IdentityValue>

            {consultantLinks.length > 0 ? (
              <IdentityMeta>
                <span className="form-label">{contactMetaLabel}</span>

                <div className={adminIdentityStyles.formInline}>
                  {consultantLinks.map((c) => (
                    <a
                      key={c.key}
                      href={c.href}
                      className="button button-secondary"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ContactIcon method={c.key} />
                      {c.label}
                      <span
                        className={adminIdentityStyles.arrow}
                        aria-hidden="true"
                      >
                        {arrowRight}
                      </span>
                    </a>
                  ))}
                </div>
              </IdentityMeta>
            ) : null}
          </IdentityCard>

          {/* Card 2: Case */}
          <IdentityCard>
            <IdentityLabel>
              {safeT(tGlobal, "header.case") ?? tGlobal("header.case")}
            </IdentityLabel>

            {linkedCase ? (
              <>
                {caseStatusRaw.length > 0 ? (
                  <IdentityBadgeRow>
                    <span
                      className={`badge ${caseStatusTone} ${adminIdentityStyles.badgeTight}`}
                    >
                      <span className={adminIdentityStyles.badgeText}>
                        {caseStatusLabel}
                      </span>
                    </span>
                  </IdentityBadgeRow>
                ) : null}

                <IdentityMeta>
                  {safeT(tGlobal, "header.createdAt") ??
                    tGlobal("header.createdAt")}{" "}
                  {caseCreatedLabel}
                </IdentityMeta>
                <IdentityMeta>
                  {safeT(tGlobal, "header.updatedAt") ??
                    tGlobal("header.updatedAt")}{" "}
                  {caseUpdatedLabel}
                </IdentityMeta>
              </>
            ) : (
              <IdentityMeta>{dateNa}</IdentityMeta>
            )}
          </IdentityCard>

          {/* Card 3: Application */}
          <IdentityCard>
            <IdentityLabel>
              {safeT(tGlobal, "header.application") ??
                tGlobal("header.application")}
            </IdentityLabel>

            <div className={adminIdentityStyles.statusStack}>
              <div className={adminIdentityStyles.statusBlock}>
                <p className="form-label" style={{ margin: 0 }}>
                  {tGlobal("header.visaApplicationStatus")}
                </p>

                <span
                  className={`badge ${statusMeta.badgeTone} ${adminIdentityStyles.badgeTight}`}
                >
                  <span className={adminIdentityStyles.badgeText}>
                    {tGlobal(`Statuses.applications.${statusMeta.labelKey}`)}
                  </span>
                </span>
              </div>
            </div>

            <IdentityMeta>
              {tGlobal("ApplicationRow.docsSummary", {
                uploaded: docsProgress.uploadedCount,
                required: docsProgress.requiredCount,
                approved: docsProgress.approvedCount,
              })}
            </IdentityMeta>

            <IdentityStack split>
              <IdentityMeta>
                {safeT(tGlobal, "header.createdAt") ??
                  tGlobal("header.createdAt")}{" "}
                {appCreatedLabel}
              </IdentityMeta>
              <IdentityMeta>
                {safeT(tGlobal, "header.updatedAt") ??
                  tGlobal("header.updatedAt")}{" "}
                {appUpdatedLabel}
              </IdentityMeta>
            </IdentityStack>
          </IdentityCard>
        </IdentityCards>

        {activeWizardStep !== "timeline" && (
          <StatusStepWizard
            ariaLabel={tApps("journey.title")}
            activeStep={activeWizardStep}
            completedSteps={getApplicationCompletedStepKeys(status)}
            formatEyebrow={(current, total) =>
              tWizard("eyebrow", { current, total })
            }
            formatStepLabel={(number, label) =>
              tWizard("stepLabel", { number, label })
            }
            stepsNavSuffix={tWizard("stepsNavSuffix")}
            steps={[
              {
                key: "documents",
                label: tApps("wizard.steps.documents"),
                href: `?open=documents#application-wizard`,
              },
              {
                key: "visa_journey",
                label: tApps("wizard.steps.submitted"),
                href: `?open=visa_journey#application-wizard`,
              },
              {
                key: "outcome",
                label: tApps("wizard.steps.outcome"),
                href: `?open=outcome#application-wizard`,
              },
            ]}
          >
            {activeWizardStep === "visa_journey" && (
              <DisclosurePanel
                id="panel-journey"
                title={tApps("wizard.journeyTitle")}
                subtitle={tApps("wizard.journeySubtitle")}
                defaultOpen={true}
                chevronLabel={chevronLabel}
              >
                <div className="stack">
                  <div
                    className="surface-soft"
                    style={{ padding: "var(--space-4)" }}
                  >
                    <p className="text-sm" style={{ margin: 0 }}>
                      {tApps(
                        status === APPLICATION_STATUS.VISA_ISSUE_ACTION_NEEDED
                          ? "wizard.issueActionBody"
                          : "wizard.submittedBody",
                      )}
                    </p>
                    <div
                      className={adminIdentityStyles.statusStack}
                      style={{ marginTop: "var(--space-3)" }}
                    >
                      <div className={adminIdentityStyles.statusBlock}>
                        <p
                          className={`form-label ${adminIdentityStyles.statusLabel}`}
                          style={{ margin: 0 }}
                        >
                          {tApps("status.currentStatus")}
                        </p>
                        <span
                          className={`badge ${statusMeta.badgeTone} ${adminIdentityStyles.badgeTight}`}
                        >
                          <span className={adminIdentityStyles.badgeText}>
                            {tGlobal(
                              `Statuses.applications.${statusMeta.labelKey}`,
                            )}
                          </span>
                        </span>
                      </div>
                    </div>
                    {application.consultant_note ? (
                      <div
                        className="stack"
                        style={{ marginTop: "var(--space-3)" }}
                      >
                        <p className="form-label" style={{ margin: 0 }}>
                          {tApps("journey.noteLabel")}
                        </p>
                        <p
                          className="text-sm text-muted"
                          style={{ margin: 0, whiteSpace: "pre-wrap" }}
                        >
                          {application.consultant_note}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </DisclosurePanel>
            )}

            {activeWizardStep === "documents" && (
              <DisclosurePanel
                id="panel-required-documents"
                title={tApps("wizard.documentsTitle")}
                subtitle={tApps("wizard.documentsSubtitle")}
                defaultOpen={true}
                chevronLabel={chevronLabel}
              >
                {hasRequirements ? (
                  <div
                    className={`surface-soft ${localStyles.cardBlock ?? ""}`}
                    style={{
                      padding: "var(--space-4)",
                      marginBottom: "var(--space-3)",
                    }}
                  >
                    <p className="text-sm text-bold" style={{ margin: 0 }}>
                      {docsSummaryLabel}
                    </p>
                    <p
                      className="text-sm text-muted"
                      style={{ margin: "var(--space-2) 0 0" }}
                    >
                      {tApps(
                        status === APPLICATION_STATUS.DOCUMENTS_NOT_APPROVED
                          ? "wizard.documentsNeedsAttention"
                          : status === APPLICATION_STATUS.DOCUMENTS_UNDER_REVIEW
                            ? "wizard.documentsUnderReview"
                            : "wizard.documentsNextAction",
                      )}
                    </p>
                  </div>
                ) : null}
                {!hasRequirements ? (
                  <div className={styles.emptyState}>
                    <p className="text-md text-bold">
                      {tApps("documents.requirementsNotAvailableTitle")}
                    </p>
                    <p className="text-sm text-muted">
                      {tApps("documents.requirementsNotAvailableBody")}
                    </p>
                  </div>
                ) : (
                  <div className={localStyles.requirementsList}>
                    {requirements.map((req) => {
                      const docTypeId = safeString(req.document_type_id).trim();
                      const best = latestByType.get(docTypeId) ?? null;
                      const statusId = best
                        ? best.status
                        : ("missing" as const);
                      const uiMeta = getDocumentUiMeta(statusId as any);
                      const statusTone = uiMeta.badgeTone;
                      const statusLabel =
                        statusId === "missing"
                          ? tApps("documents.status.missing")
                          : tGlobal(`Statuses.documents.${statusId}`);
                      const uploadedAt = safeDate(best?.uploaded_at);
                      const uploadedAtLabel = uploadedAt
                        ? fmtShort.format(uploadedAt)
                        : dateNa;
                      const rawNote =
                        best?.notes &&
                        (statusId === "resubmit" || statusId === "rejected")
                          ? best.notes
                          : null;

                      // Format timestamps BEFORE truncating so an ISO string is never cut in half.
                      const note = rawNote ? truncate(formatNoteTimestamps(rawNote), 250) : null;
                      const isLocked =
                        statusId === "pending" || statusId === "approved";
                      const formatGroup =
                        docTypesById.get(docTypeId)?.format_group ?? null;
                      return (
						<DocumentRequirementRowStateful
						  key={docTypeId}
						  title={tGlobal(`DocumentTypes.${docTypeId}.label`)}
						  description={tGlobal(`DocumentTypes.${docTypeId}.desc`)}
						  required={req.required}
						  requiredLabel={tDocs("list.requiredBadge")}
						  statusLabel={statusLabel}
						  statusTone={statusTone}
						  note={note}
						  uploadedOnLabel={tDocs("list.uploadedOn")}
						  uploadedOnValue={uploadedAtLabel}
						  applicationId={id}
						  documentReq={{
						    id: docTypeId,
						    labelKey: docTypeId,
						    required: req.required,
						    formatGroup,
						  }}
						  uploadedDoc={best as any}
						  clientName={clientName}
						  isLocked={isLocked}
						  applicationFolderId={applicationFolderIdForUpload}
						/>
                      );
                    })}
                  </div>
                )}
              </DisclosurePanel>
            )}

            {activeWizardStep === "outcome" && (
              <DisclosurePanel
                id="panel-outcome"
                title={tApps("wizard.outcomeTitle")}
                subtitle={tApps("wizard.outcomeSubtitle")}
                defaultOpen={true}
                chevronLabel={chevronLabel}
              >
                <div
                  className="surface-soft"
                  style={{ padding: "var(--space-4)" }}
                >
                  <p className="text-md text-bold" style={{ marginTop: 0 }}>
                    {status === APPLICATION_STATUS.VISA_APPROVED ||
                    status === APPLICATION_STATUS.FINISHED
                      ? tApps("wizard.outcomeApproved")
                      : status === APPLICATION_STATUS.CANCELLED
                        ? tApps("wizard.outcomeCancelled")
                        : tApps("wizard.outcomePending")}
                  </p>
                  <p className="text-sm text-muted" style={{ marginBottom: 0 }}>
                    {status === APPLICATION_STATUS.VISA_APPROVED ||
                    status === APPLICATION_STATUS.FINISHED
                      ? tApps("wizard.outcomeApprovedBody")
                      : status === APPLICATION_STATUS.CANCELLED
                        ? tApps("wizard.outcomeCancelledBody")
                        : tApps("wizard.outcomePendingBody")}
                  </p>
                </div>
              </DisclosurePanel>
            )}
          </StatusStepWizard>
        )}

        {/* Timeline */}
        {activeWizardStep === "timeline" && (
          <DisclosurePanel
            id="panel-timeline"
            title={tGlobal("Timeline.title")}
            subtitle={tGlobal("Timeline.subtitle")}
            defaultOpen={timelineEvents.length > 0}
            chevronLabel={chevronLabel}
          >
            <Timeline
              locale={locale}
              dateNaLabel={tGlobal("Common.dates.na")}
              events={timelineEvents}
              translate={tGlobal}
            />
          </DisclosurePanel>
        )}
      </MainColumn>
    </PageShell>
  );
}
