/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/(admin)/admin/applications/[id]/page.tsx
SCOPE: Admin Application Detail (Journey + Documents bulk status update + Timeline) using global primitives and DB-truth enums.
STATUS: LOCKED
AUDITED:
- Gate: Enforces admin/consultant access via auth.getUser() + user_roles before any service-role reads (assertAdminOrConsultantOrNotFound()).
- RLS: Uses service role (bypasses RLS) ONLY after gate; file remains server-only via import "server-only".
- Input validation: Rejects invalid appId via UUID regex + notFound(); rejects invalid formData applicationId similarly.
- Status safety: UI transitions constrained via getAllowedNextStatuses(); server action blocks terminal-status transitions (FINISHED/CANCELLED).
- Document safety: Bulk document status updates operate on latest doc per type (ordered by copy_number then uploaded_at); skips rows without drive_link; requires note for resubmit.
- Data exposure: Queries select only needed fields (profile contact fields only for rendering contact links; no extra sensitive fields selected).
- Redirects: Locale-aware redirects used throughout via `/${locale}${siteConfig...}` (no i18n keys touched).
NOTES:
- No translation keys were changed.
- Service role key must remain server-only (never NEXT_PUBLIC_*).
*/
export const dynamic = "force-dynamic";

import "server-only";

import StatusStepWizard, {
  getApplicationAdminCompletedStepKeys,
  getApplicationAdminWizardStepKey,
} from "@/components/progression/StatusStepWizard";

import { unstable_noStore as noStore } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import {
  createServerSupabaseClient,
  createAdminSupabaseClient,
} from "@/lib/supabaseServer";
import { siteConfig } from "@/config/siteConfig";

import {
  APPLICATION_STATUS,
  getApplicationStatusMeta,
  getCaseStatusMeta,
  getDocumentUiMeta,
  isValidApplicationStatus,
  NEUTRAL,
  type CaseStatusId,
  type ApplicationStatusId,
} from "@/config/statuses";

import { Link } from "@/i18n/navigation";

import { PageShell } from "@/components/ui/layout/PageShell";
import { MainColumn } from "@/components/ui/layout/MainColumn";
import { DisclosurePanel } from "@/components/ui/panel/DisclosurePanel";
import Timeline from "@/components/ui/timeline/Timeline";
import { normalizeTimelineEvents } from "@/lib/timeline/normalizeTimelineEvents";

import GuardedSubmitButton from "@/components/admin/GuardedSubmitButton";
import ConfirmSubmitButton from "@/components/ui/ConfirmSubmitButton";
import BulkDocStatusConfirmFlag from "@/components/admin/BulkDocStatusConfirmFlag";
import ApplicationStatusGuardrails from "@/components/admin/ApplicationStatusGuardrails";

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

import styles from "@/styles/applicationdetails.module.css";

/* -------------------------------------------------------------------------- */
/* Admin Supabase (service role) — ONLY after admin/consultant gate passes     */
/* -------------------------------------------------------------------------- */

function getAdminSupabase() {
  return createAdminSupabaseClient();
}

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

function safeIsoToDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function logPostgrestError(label: string, err: unknown) {
  const e: any = err;
  // eslint-disable-next-line no-console
  console.error(label, {
    message: e?.message ?? null,
    details: e?.details ?? null,
    hint: e?.hint ?? null,
    code: e?.code ?? null,
  });
}

/* -------------------------------------------------------------------------- */
/* Auth                                                                       */
/* -------------------------------------------------------------------------- */

async function assertAdminOrConsultantOrNotFound() {
  const sessionSupabase = await createServerSupabaseClient();

  const {
    data: { user },
    error,
  } = await sessionSupabase.auth.getUser();

  if (error)
    logPostgrestError("[AdminApplicationDetail] auth.getUser error:", error);

  const locale = await getLocale();
  if (!user) redirect(`/${locale}${siteConfig.loginPath}`);

  const { data: roleRow, error: roleError } = await sessionSupabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError) {
    logPostgrestError(
      "[AdminApplicationDetail] user_roles read error:",
      roleError,
    );
    notFound();
  }

  const role = (roleRow?.role ?? "").toString();
  const allowed = role === "admin" || role === "consultant";
  if (!allowed) notFound();

  return { actorUserId: user.id, actorRole: role };
}

/* -------------------------------------------------------------------------- */
/* UI guards — MUST mirror DB rules                                           */
/* -------------------------------------------------------------------------- */

const DOCUMENT_PHASE_STATUSES = [
  APPLICATION_STATUS.WAITING_DOCUMENTS,
  APPLICATION_STATUS.DOCUMENTS_UNDER_REVIEW,
  APPLICATION_STATUS.DOCUMENTS_NOT_APPROVED,
  APPLICATION_STATUS.DOCUMENTS_APPROVED,
] as const;

function isDocumentPhase(status: string) {
  return DOCUMENT_PHASE_STATUSES.includes(status as any);
}

function isTerminalStatus(status: string) {
  return (
    status === APPLICATION_STATUS.FINISHED ||
    status === APPLICATION_STATUS.CANCELLED ||
    status === APPLICATION_STATUS.VISA_APPROVED
  );
}

function getAllowedNextStatuses(
  current: ApplicationStatusId,
): ApplicationStatusId[] {
  switch (current) {
    case APPLICATION_STATUS.DOCUMENTS_APPROVED:
      return [APPLICATION_STATUS.VISA_JOURNEY_STARTED];

    case APPLICATION_STATUS.VISA_JOURNEY_STARTED:
      return [
        APPLICATION_STATUS.VISA_ISSUE_ACTION_NEEDED,
        APPLICATION_STATUS.VISA_APPROVED,
        APPLICATION_STATUS.CANCELLED,
      ];

    case APPLICATION_STATUS.VISA_ISSUE_ACTION_NEEDED:
      return [
        APPLICATION_STATUS.VISA_JOURNEY_STARTED,
        APPLICATION_STATUS.VISA_APPROVED,
        APPLICATION_STATUS.CANCELLED,
      ];

    case APPLICATION_STATUS.VISA_APPROVED:
      return [];

    default:
      return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Types (DB truth)                                                           */
/* -------------------------------------------------------------------------- */

type ApplicationRow = {
  id: string;
  user_id: string;

  application_type: string;
  application_status: string;

  document_status: string | null;

  destination: string | null;

  consultant_note: string | null;
  consultant_note_updated_at: string | null;

  timeline: any;

  drive_parent_folder_id: string | null;
  drive_application_folder_id: string | null;

  created_at: string | null;
  updated_at: string | null;
};

type CaseLite = {
  id: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
};

type ProfileLite = {
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;

  preferred_contact_method: string | null;
  contact_email: string | null;
  telegram_username: string | null;
  whatsapp_e164: string | null;
};

type RequirementRow = {
  application_id: string;
  document_type_id: string;
  required: boolean;
  document_types:
    | {
        id: string;
        name_key: string | null;
      }
    | {
        id: string;
        name_key: string | null;
      }[]
    | null;
};

type ClientDocumentStatus = "pending" | "approved" | "resubmit" | "rejected";

type DocumentRow = {
  id: string;
  application_id: string;
  document_type_id: string | null;

  file_name: string;
  drive_link: string | null;

  status: ClientDocumentStatus;
  status_updated_at: string;

  uploaded_at: string | null;
  copy_number: number;

  notes: string | null;
};

type ContactMethod = "email" | "whatsapp" | "telegram";

type ContactLink = {
  method: ContactMethod;
  href: string;
  isExternal: boolean;
  isPreferred: boolean;
};

function isValidClientDocumentStatus(v: unknown): v is ClientDocumentStatus {
  return (
    v === "pending" || v === "approved" || v === "resubmit" || v === "rejected"
  );
}

function docTypeKey(dt: { name_key?: string | null; id: string }) {
  const k = (dt.name_key ?? "").trim();
  return k.length > 0 ? k : dt.id;
}

function computeLatestDocsByType(docs: DocumentRow[]) {
  const latestByType = new Map<string, DocumentRow>();

  for (const d of docs) {
    const typeId = d.document_type_id;
    if (!typeId) continue;

    const existing = latestByType.get(typeId);
    if (!existing) {
      latestByType.set(typeId, d);
      continue;
    }

    if (d.copy_number > existing.copy_number) {
      latestByType.set(typeId, d);
      continue;
    }

    const da = safeIsoToDate(d.uploaded_at);
    const db = safeIsoToDate(existing.uploaded_at);
    if (da && db && da.getTime() > db.getTime()) {
      latestByType.set(typeId, d);
    }
  }

  return latestByType;
}

function computeRequiredDocsProgress(
  requiredIds: string[],
  docs: DocumentRow[],
) {
  const latestByType = new Map<string, DocumentRow>();

  for (const d of docs) {
    const typeId = d.document_type_id;
    if (!typeId) continue;

    if (!latestByType.has(typeId)) {
      latestByType.set(typeId, d);
    }
  }

  const requiredCount = requiredIds.length;
  let uploadedCount = 0;
  let approvedCount = 0;
  let pendingCount = 0;
  let needsResubmissionCount = 0;

  for (const id of requiredIds) {
    const doc = latestByType.get(id);
    if (!doc || !doc.drive_link) continue;

    uploadedCount += 1;
    if (doc.status === "approved") approvedCount += 1;
    else if (doc.status === "resubmit" || doc.status === "rejected")
      needsResubmissionCount += 1;
    else pendingCount += 1;
  }

  return {
    requiredCount,
    uploadedCount,
    approvedCount,
    pendingCount,
    needsResubmissionCount,
  };
}

function buildContactLinks(profile: ProfileLite | null): ContactLink[] {
  const preferredRaw =
    typeof profile?.preferred_contact_method === "string"
      ? profile.preferred_contact_method.trim().toLowerCase()
      : "";

  const preferred =
    preferredRaw === "email" ||
    preferredRaw === "whatsapp" ||
    preferredRaw === "telegram"
      ? (preferredRaw as ContactMethod)
      : null;

  const links: ContactLink[] = [];

  {
    const email =
      typeof profile?.contact_email === "string"
        ? profile.contact_email.trim()
        : "";
    if (email.length > 3 && email.includes("@")) {
      links.push({
        method: "email",
        href: `mailto:${email}`,
        isExternal: false,
        isPreferred: preferred === "email",
      });
    }
  }

  {
    const raw =
      typeof profile?.whatsapp_e164 === "string"
        ? profile.whatsapp_e164.trim()
        : "";
    const digits = raw.replace(/\D/g, "");
    if (digits.length > 0) {
      links.push({
        method: "whatsapp",
        href: `https://wa.me/${digits}`,
        isExternal: true,
        isPreferred: preferred === "whatsapp",
      });
    }
  }

  {
    const raw =
      typeof profile?.telegram_username === "string"
        ? profile.telegram_username.trim()
        : "";
    const username = raw.replace(/^@/, "").replace(/\s+/g, "");
    if (username.length > 0) {
      links.push({
        method: "telegram",
        href: `https://t.me/${encodeURIComponent(username)}`,
        isExternal: true,
        isPreferred: preferred === "telegram",
      });
    }
  }

  links.sort((a, b) => {
    if (a.isPreferred && !b.isPreferred) return -1;
    if (!a.isPreferred && b.isPreferred) return 1;
    return a.method.localeCompare(b.method);
  });

  return links;
}

/* -------------------------------------------------------------------------- */
/* Server action: close application (application_status -> cancelled)         */
/* -------------------------------------------------------------------------- */

async function closeApplicationOverride(formData: FormData) {
  "use server";

  await assertAdminOrConsultantOrNotFound();
  const supabase = getAdminSupabase();

  const applicationId = formData.get("applicationId");
  const locale = await getLocale();

  if (typeof applicationId !== "string" || !isUuid(applicationId)) {
    notFound();
  }

  const { data: app, error } = await supabase
    .from("client_applications")
    .select("application_status")
    .eq("id", applicationId)
    .maybeSingle();

  if (error || !app) {
    logPostgrestError(
      "[AdminApplicationDetail] closeApplicationOverride load app error:",
      error,
    );
    notFound();
  }

  const currentStatus = (app.application_status ?? "").toString();

  if (currentStatus === APPLICATION_STATUS.CANCELLED) {
    redirect(
      `/${locale}${siteConfig.adminApplicationsPath}/${applicationId}#application-wizard`,
    );
  }

  if (currentStatus === APPLICATION_STATUS.FINISHED) {
    redirect(
      `/${locale}${siteConfig.adminApplicationsPath}/${applicationId}#application-wizard`,
    );
  }

  const { error: updErr } = await supabase
    .from("client_applications")
    .update({
      application_status: APPLICATION_STATUS.CANCELLED,
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (updErr) {
    logPostgrestError(
      "[AdminApplicationDetail] closeApplicationOverride update error:",
      updErr,
    );
    throw new Error("Failed to close application.");
  }

  redirect(
    `/${locale}${siteConfig.adminApplicationsPath}/${applicationId}#application-wizard`,
  );
}

/* -------------------------------------------------------------------------- */
/* Server action: update Journey (application_status + consultant_note)       */
/* -------------------------------------------------------------------------- */

async function updateJourneyPanel(formData: FormData) {
  "use server";

  await assertAdminOrConsultantOrNotFound();
  const supabase = getAdminSupabase();

  const applicationId = formData.get("applicationId");
  const locale = await getLocale();

  const statusRaw = formData.get("applicationStatus");
  const noteRaw = formData.get("consultantNote");

  if (typeof applicationId !== "string" || !isUuid(applicationId)) {
    notFound();
  }

  const requestedStageRaw = formData.get("stage");
  const requestedStage =
    typeof requestedStageRaw === "string" ? requestedStageRaw.trim() : "";

  const nextNote =
    typeof noteRaw === "string" && noteRaw.trim().length > 0
      ? noteRaw.trim().slice(0, 4000)
      : null;

  const { data: app, error } = await supabase
    .from("client_applications")
    .select("application_status, consultant_note")
    .eq("id", applicationId)
    .maybeSingle();

  if (error || !app) {
    logPostgrestError(
      "[AdminApplicationDetail] updateJourneyPanel load app error:",
      error,
    );
    notFound();
  }

  const currentStatus = (app.application_status ?? "").toString();
  const currentNote = (app.consultant_note ?? "").toString();

  // Empty or omitted status means "notes only", never a status reset.
  const submittedStatus =
    typeof statusRaw === "string" &&
    statusRaw.trim().length > 0 &&
    isValidApplicationStatus(statusRaw.trim())
      ? (statusRaw.trim() as ApplicationStatusId)
      : (currentStatus as ApplicationStatusId);

  // Once the application is marked as started with Home Affairs, Step 2 is
  // notes-only. Outcome/status transitions remain available from Step 3.
  const nextStatus =
    currentStatus === APPLICATION_STATUS.VISA_JOURNEY_STARTED &&
    requestedStage !== "outcome"
      ? (currentStatus as ApplicationStatusId)
      : submittedStatus;

  const isTerminal =
    currentStatus === APPLICATION_STATUS.FINISHED ||
    currentStatus === APPLICATION_STATUS.CANCELLED;
  const wantsChangeStatus = nextStatus !== (currentStatus as any);

  if (isTerminal && wantsChangeStatus) {
    redirect(
      `/${locale}${siteConfig.adminApplicationsPath}/${applicationId}?stage=${encodeURIComponent(requestedStage || "outcome")}#application-wizard`,
    );
  }

  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (wantsChangeStatus) {
    payload.application_status = nextStatus;
  }

  const normalizedCurrentNote =
    currentNote.trim().length > 0 ? currentNote.trim() : null;
  if (normalizedCurrentNote !== nextNote) {
    payload.consultant_note = nextNote;
    payload.consultant_note_updated_at = new Date().toISOString();
  }

  if (Object.keys(payload).length === 1) {
    redirect(
      `/${locale}${siteConfig.adminApplicationsPath}/${applicationId}?stage=${encodeURIComponent(requestedStage || "")}#application-wizard`,
    );
  }

  const { error: updateError } = await supabase
    .from("client_applications")
    .update(payload)
    .eq("id", applicationId);

  if (updateError) {
    logPostgrestError(
      "[AdminApplicationDetail] updateJourneyPanel update error:",
      updateError,
    );
    throw new Error("Failed to update application.");
  }

  redirect(
    `/${locale}${siteConfig.adminApplicationsPath}/${applicationId}#application-wizard`,
  );
}

/* -------------------------------------------------------------------------- */
/* Server action: bulk update client_documents status (+ notes)               */
/* -------------------------------------------------------------------------- */

async function bulkUpdateDocumentStatuses(formData: FormData) {
  "use server";

  await assertAdminOrConsultantOrNotFound();
  const supabase = getAdminSupabase();

  const applicationId = formData.get("applicationId");
  const locale = await getLocale();

  const openRaw = formData.get("open");
  const open = openRaw === "documents" ? "documents" : "";

  const targetRaw = formData.get("target_status");
  const noteRaw = formData.get("note");

  const selected = formData
    .getAll("doc")
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0);

  if (typeof applicationId !== "string" || !isUuid(applicationId)) notFound();

  const target = typeof targetRaw === "string" ? targetRaw.trim() : "";
  if (!isValidClientDocumentStatus(target)) {
    redirect(
      `/${locale}${siteConfig.adminApplicationsPath}/${applicationId}?open=${open}#application-wizard`,
    );
  }

  const note = typeof noteRaw === "string" ? noteRaw.trim().slice(0, 4000) : "";

  if (selected.length === 0) {
    redirect(
      `/${locale}${siteConfig.adminApplicationsPath}/${applicationId}?open=${open}#application-wizard`,
    );
  }

  if (target === "resubmit" && note.length === 0) {
    redirect(
      `/${locale}${siteConfig.adminApplicationsPath}/${applicationId}?open=${open}#application-wizard`,
    );
  }

  const now = new Date().toISOString();
  let resubmissionRequested = false;

  for (const docTypeId of selected) {
    const { data: latest, error: loadErr } = await supabase
      .from("client_documents")
      .select("id,status,notes,copy_number,uploaded_at,drive_link")
      .eq("application_id", applicationId)
      .eq("document_type_id", docTypeId)
      .order("copy_number", { ascending: false })
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (loadErr) {
      logPostgrestError(
        "[AdminApplicationDetail] bulkUpdateDocumentStatuses load doc error:",
        loadErr,
      );
      continue;
    }

    if (!latest?.id) continue;
    if (!latest.drive_link) continue;

    const prevStatus = (latest.status ?? "pending") as ClientDocumentStatus;

    const payload: Record<string, any> = {};

    if (prevStatus !== target) {
      payload.status = target;
      payload.status_updated_at = now;
    }

    if (note.length > 0) {
      const prevNotes =
        typeof latest.notes === "string" ? latest.notes.trim() : "";
      const stamp = now;

      const addition = `[${stamp}]\n${note}`;
      payload.notes =
        prevNotes.length > 0 ? `${prevNotes}\n\n${addition}` : addition;
    }

    if (Object.keys(payload).length === 0) continue;

    const { error: updErr } = await supabase
      .from("client_documents")
      .update(payload)
      .eq("id", latest.id);

    if (updErr) {
      logPostgrestError(
        "[AdminApplicationDetail] bulkUpdateDocumentStatuses update error:",
        updErr,
      );
    } else if (target === "resubmit") {
      resubmissionRequested = true;
    }
  }

  // A resubmission request reopens the client document stage, even if the
  // application had previously progressed into the visa journey.
  if (resubmissionRequested) {
    const { error: appStatusError } = await supabase
      .from("client_applications")
      .update({
        application_status: APPLICATION_STATUS.DOCUMENTS_NOT_APPROVED,
        document_status: "resubmit",
        updated_at: now,
      })
      .eq("id", applicationId);

    if (appStatusError) {
      logPostgrestError(
        "[AdminApplicationDetail] reset application to document review error:",
        appStatusError,
      );
      throw new Error(
        "Documents were marked for resubmission, but the application could not be returned to document review.",
      );
    }
  }

  redirect(
    `/${locale}${siteConfig.adminApplicationsPath}/${applicationId}?saved=documents#application-wizard`,
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminApplicationDetailPage({
  params,
  searchParams,
}: PageProps) {
  noStore();

  const resolvedParams = await params;
  const appId =
    typeof resolvedParams?.id === "string" ? resolvedParams.id.trim() : "";

  if (!appId || !isUuid(appId)) notFound();

  await assertAdminOrConsultantOrNotFound();
  const supabase = getAdminSupabase();

  const uiLocale = await getLocale();
  const tAdmin = await getTranslations("AdminApplications");
  const tGlobal = await getTranslations("GlobalForm");
  const tDocTypes = await getTranslations("DocumentTypes");
  const tCases = await getTranslations("AdminCases");
  const tWizard = await getTranslations("AdminStatusStepWizard");

  const arrowRight = tGlobal("Common.symbols.arrowRight");
  const chevronLabel = tGlobal("Common.symbols.chevronDown");
  const na = tGlobal("Common.dates.na");

  const fmtShort = new Intl.DateTimeFormat(uiLocale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const fmtWithTime = new Intl.DateTimeFormat(uiLocale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  // 1) Application
  const { data: appRow, error: appErr } = await supabase
    .from("client_applications")
    .select(
      `
				id,
				user_id,
				application_type,
				application_status,
				document_status,
				destination,
				consultant_note,
				consultant_note_updated_at,
				timeline,
				drive_parent_folder_id,
				drive_application_folder_id,
				created_at,
				updated_at
			`,
    )
    .eq("id", appId)
    .maybeSingle<ApplicationRow>();

  if (appErr) {
    logPostgrestError(
      "[AdminApplicationDetail] load application error:",
      appErr,
    );
    notFound();
  }
  if (!appRow) notFound();

  const app = appRow;

  /* -------------------------------------------------------------------------- */
  /* UI guards — derived from DB truth                                          */
  /* -------------------------------------------------------------------------- */

  const canEditStatus =
    !isTerminalStatus(app.application_status) &&
    (app.application_status === APPLICATION_STATUS.DOCUMENTS_APPROVED ||
      !isDocumentPhase(app.application_status));

  const canEditNotes =
    app.application_status === APPLICATION_STATUS.CANCELLED
      ? true
      : !isTerminalStatus(app.application_status);

  const documentsLocked = isTerminalStatus(app.application_status);

  const allowedNextStatuses = getAllowedNextStatuses(
    app.application_status as ApplicationStatusId,
  ).filter((s) => {
    if (s === app.application_status) return false;
    if (
      (app.application_status === APPLICATION_STATUS.VISA_JOURNEY_STARTED ||
        app.application_status ===
          APPLICATION_STATUS.VISA_ISSUE_ACTION_NEEDED) &&
      s === APPLICATION_STATUS.VISA_JOURNEY_STARTED
    ) {
      return false;
    }
    return true;
  });

  // 2) Case (linked via application_id)
  const { data: caseRow, error: caseErr } = await supabase
    .from("client_cases")
    .select("id,status,created_at,updated_at")
    .eq("application_id", appId)
    .maybeSingle<CaseLite>();

  if (caseErr)
    logPostgrestError("[AdminApplicationDetail] load case error:", caseErr);
  const linkedCase = caseRow ?? null;

  // 3) Profile
  const { data: profileRow, error: profErr } = await supabase
    .from("client_profiles")
    .select(
      `
				first_name,
				middle_name,
				last_name,
				preferred_contact_method,
				contact_email,
				telegram_username,
				whatsapp_e164
			`,
    )
    .eq("user_id", app.user_id)
    .maybeSingle<ProfileLite>();

  if (profErr)
    logPostgrestError("[AdminApplicationDetail] load profile error:", profErr);
  const profile = profileRow ?? null;

  // 4) Requirements (+ document_types for label/desc keys)
  const { data: reqRows, error: reqErr } = await supabase
    .from("client_application_requirements")
    .select(
      `
				application_id,
				document_type_id,
				required,
				document_types (
					id,
					name_key
				)
			`,
    )
    .eq("application_id", appId)
    .order("required", { ascending: false })
    .order("document_type_id", { ascending: true });

  if (reqErr)
    logPostgrestError(
      "[AdminApplicationDetail] load requirements error:",
      reqErr,
    );

  const requirements: RequirementRow[] = Array.isArray(reqRows)
    ? (reqRows as unknown as RequirementRow[])
    : [];

  // 5) Documents
  const { data: docRows, error: docsErr } = await supabase
    .from("client_documents")
    .select(
      "id,application_id,document_type_id,file_name,drive_link,status,status_updated_at,uploaded_at,copy_number,notes",
    )
    .eq("application_id", appId)
    .order("document_type_id", { ascending: true })
    .order("copy_number", { ascending: false })
    .order("uploaded_at", { ascending: false });

  if (docsErr)
    logPostgrestError(
      "[AdminApplicationDetail] load documents error:",
      docsErr,
    );

  const docs: DocumentRow[] = Array.isArray(docRows)
    ? (docRows as unknown as DocumentRow[])
    : [];

  const latestByType = computeLatestDocsByType(docs);

  const requiredDocTypeIds = requirements
    .filter((r) => Boolean(r.required))
    .map((r) => r.document_type_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  const docsProgress = computeRequiredDocsProgress(requiredDocTypeIds, docs);

  const docsSummaryLabel = tCases("header.docsSummary", {
    uploaded: docsProgress.uploadedCount,
    required: docsProgress.requiredCount,
    approved: docsProgress.approvedCount,
  });

  // Dates
  const createdAt = safeIsoToDate(app.created_at);
  const updatedAt = safeIsoToDate(app.updated_at);

  const caseCreatedAt = safeIsoToDate(linkedCase?.created_at ?? null);
  const caseUpdatedAt = safeIsoToDate(linkedCase?.updated_at ?? null);

  const fullName = (() => {
    const parts = [
      profile?.first_name,
      profile?.middle_name,
      profile?.last_name,
    ].filter((x) => typeof x === "string" && x.trim().length > 0) as string[];

    const joined = parts.join(" ").trim();
    return joined.length > 0
      ? joined
      : tAdmin("list.unknownUserNameFallback", { userId: app.user_id });
  })();

  const contactLinks = buildContactLinks(profile);

  const destinationLabel = (() => {
    const id =
      typeof app.destination === "string" ? app.destination.trim() : "";
    if (!id) return na;
    return tGlobal(`destinations.${id}` as any);
  })();

  const visaTypeLabel = await (async () => {
    const id =
      typeof app.application_type === "string"
        ? app.application_type.trim()
        : "";
    if (!id) return na;

    const { data: vt, error: vtErr } = await supabase
      .from("visa_types")
      .select("name_key")
      .eq("id", id)
      .maybeSingle();

    if (vtErr)
      logPostgrestError(
        "[AdminApplicationDetail] load visa_type label error:",
        vtErr,
      );

    const nameKey =
      typeof (vt as any)?.name_key === "string"
        ? (vt as any).name_key.trim()
        : "";
    if (!nameKey) return na;

    return tGlobal(`visaTypes.${nameKey}` as any);
  })();

  const appMeta = getApplicationStatusMeta(
    app.application_status as ApplicationStatusId,
  );

  const appDocStatus =
    typeof app.document_status === "string" ? app.document_status.trim() : "";
  const docUiMeta = isValidClientDocumentStatus(appDocStatus)
    ? getDocumentUiMeta(appDocStatus)
    : getDocumentUiMeta("pending");

  const caseMeta = linkedCase
    ? getCaseStatusMeta(linkedCase.status as CaseStatusId)
    : null;

  // Open panel from URL
  const openParam = (searchParams ? await searchParams : {})?.open;
  const open = typeof openParam === "string" ? openParam : "";

  type PanelKey = "details" | "documents" | "journey" | "preview" | "timeline";
  const documentStageStatuses: ApplicationStatusId[] = [
    APPLICATION_STATUS.NOT_STARTED,
    APPLICATION_STATUS.WAITING_DOCUMENTS,
    APPLICATION_STATUS.DOCUMENTS_UNDER_REVIEW,
    APPLICATION_STATUS.DOCUMENTS_NOT_APPROVED,
  ];
  const isDocumentStage = documentStageStatuses.includes(appMeta.id);

  // IMPORTANT: step routing is driven by application_status alone. Do NOT
  // derive it from document_status or from resubmit/rejected rows in
  // client_documents — those can go stale (nothing clears document_status on
  // re-approval), and would otherwise drag the wizard back to step 1 even
  // though the app has moved on to visa_journey_started / visa_approved.
  //
  // `awaitingClientDocuments` only controls the *label* of step 1
  // ("Awaiting client documents" vs "Review and validate client documents").
  // It must never decide which step is current.
  const awaitingClientDocuments =
    isDocumentStage &&
    docsProgress.requiredCount > 0 &&
    docsProgress.uploadedCount === 0;

  const statusDrivenPanel: PanelKey = isDocumentStage ? "documents" : "journey";
  const effectiveOpenPanel: PanelKey =
    open === "timeline"
      ? "timeline"
      : isDocumentStage
        ? "documents"
        : open === "documents" || open === "journey"
          ? open
          : statusDrivenPanel;
  const requestedStageRaw = (searchParams ? await searchParams : {})?.stage;
  const requestedStage =
    typeof requestedStageRaw === "string" ? requestedStageRaw : "";
  const allowedAdminStages = ["documents", "visa_journey", "outcome"];

  // Step routing is DB-truth, period. Only jump back to "documents" if the
  // application_status itself says we're in the documents phase.
  const activeAdminStage = isDocumentStage
    ? "documents"
    : allowedAdminStages.includes(requestedStage)
      ? requestedStage
      : getApplicationAdminWizardStepKey(appMeta.id);

  const adminCompletedSteps = getApplicationAdminCompletedStepKeys(appMeta.id);
  const statusLockedOnVisaJourneyStep =
    app.application_status === APPLICATION_STATUS.VISA_JOURNEY_STARTED &&
    activeAdminStage === "visa_journey";
  const statusSelectDisabled = !canEditStatus || statusLockedOnVisaJourneyStep;

  // confirm flag input helper map
  const statusByDocType: Record<string, ClientDocumentStatus> = {};
  for (const [typeId, d] of latestByType.entries()) {
    statusByDocType[typeId] = d.status;
  }

  // Timeline: normalized events
  const timelineEvents = normalizeTimelineEvents(app?.timeline).sort(
    (a, b) =>
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );

  return (
    <PageShell>
      <header className="hero-shell">
        <div className="hero-inner">
          <p className="hero-title">{tAdmin("header.title")}</p>
          <h1 className="hero-subtitle">
            {visaTypeLabel}{" "}
            <span aria-hidden="true">{tGlobal("Common.symbols.dot")}</span>{" "}
            {destinationLabel}
          </h1>
        </div>
      </header>

      <MainColumn>
        <div className={styles.formInline}>
          <Link
            href={siteConfig.adminApplicationsPath}
            className="button button-ghost"
          >
            <span aria-hidden="true">
              {tGlobal("Common.symbols.arrowLeft")}
            </span>
            {tGlobal("header.actions.backToApplications")}
          </Link>
        </div>

        <IdentityCards
          ariaLabel={tAdmin("header.title")}
          actions={
            <>
              <Link
                href={siteConfig.adminClientProfileDetailsHref(app.user_id)}
                className="button button-secondary"
              >
                {tGlobal("header.actions.openProfile")}
                <span className={styles.arrow} aria-hidden="true">
                  {tGlobal("Common.symbols.arrowRight")}
                </span>
              </Link>

              {linkedCase ? (
                <Link
                  href={siteConfig.adminCaseDetailsHref(linkedCase.id)}
                  className="button button-secondary"
                >
                  {tGlobal("header.actions.openCase")}
                  <span className={styles.arrow} aria-hidden="true">
                    {tGlobal("Common.symbols.arrowRight")}
                  </span>
                </Link>
              ) : null}

              {!isTerminalStatus(app.application_status) ? (
                <form
                  id="close-application-form"
                  action={closeApplicationOverride}
                >
                  <input type="hidden" name="applicationId" value={app.id} />

                  <ConfirmSubmitButton
                    formId="close-application-form"
                    className="button button-danger"
                    label={tAdmin("actions.closeApplication")}
                    deletingLabel={tGlobal("Common.actions.saving")}
                    confirmTitle={tGlobal("Confirm.title")}
                    confirmBody={tAdmin("closeApplication.confirmBody")}
                    confirmCancelLabel={tGlobal("Confirm.cancel")}
                    confirmContinueLabel={tGlobal("Confirm.continue")}
                    arrowLabel={arrowRight}
                    confirmContinueClassName="button button-danger"
                  />
                </form>
              ) : null}
            </>
          }
        >
          <IdentityCard>
            <IdentityLabel>{tAdmin("header.client")}</IdentityLabel>
            <IdentityValue>{fullName}</IdentityValue>

            {contactLinks.length > 0 ? (
              <IdentityMeta>
                <span className="form-label">
                  {tAdmin("header.clickToContact.label")}
                </span>

                <div className={styles.formInline}>
                  {contactLinks.map((l) => (
                    <a
                      key={l.method}
                      href={l.href}
                      className="button button-secondary"
                      target={l.isExternal ? "_blank" : undefined}
                      rel={l.isExternal ? "noopener noreferrer" : undefined}
                    >
                      <ContactIcon method={l.method} />
                      {tAdmin(
                        `header.clickToContact.methods.${l.method}` as any,
                      )}
                      <span className={styles.arrow} aria-hidden="true">
                        {tGlobal("Common.symbols.arrowRight")}
                      </span>
                    </a>
                  ))}
                </div>
              </IdentityMeta>
            ) : null}
          </IdentityCard>

          <IdentityCard>
            <IdentityLabel>{tAdmin("header.case")}</IdentityLabel>

            {linkedCase ? (
              <>
                <IdentityMono>{linkedCase.id}</IdentityMono>

                {caseMeta ? (
                  <IdentityBadgeRow>
                    <span
                      className={`badge ${caseMeta.badgeTone} ${styles.badgeTight}`}
                    >
                      <span className={styles.badgeText}>
                        {tGlobal(`Statuses.cases.${caseMeta.labelKey}` as any)}
                      </span>
                    </span>
                  </IdentityBadgeRow>
                ) : null}

                <IdentityMeta>
                  {tGlobal("CaseRow.created")}{" "}
                  {caseCreatedAt ? fmtShort.format(caseCreatedAt) : na}
                </IdentityMeta>
                <IdentityMeta>
                  {tGlobal("CaseRow.updated")}{" "}
                  {caseUpdatedAt ? fmtShort.format(caseUpdatedAt) : na}
                </IdentityMeta>
              </>
            ) : (
              <IdentityMeta>{tAdmin("header.noLinkedCase")}</IdentityMeta>
            )}
          </IdentityCard>

          <IdentityCard>
            <IdentityLabel>{tAdmin("header.application")}</IdentityLabel>
            <IdentityMono>{app.id}</IdentityMono>

            <div className={styles.statusStack}>
              <div className={styles.statusBlock}>
                <p className="form-label" style={{ margin: 0 }}>
                  {tGlobal("header.visaApplicationStatus")}
                </p>

                <span
                  className={`badge ${appMeta?.badgeTone ?? NEUTRAL} ${styles.badgeTight}`}
                >
                  <span className={styles.badgeText}>
                    {tGlobal(
                      `Statuses.applications.${appMeta?.labelKey ?? "waiting_documents"}` as any,
                    )}
                  </span>
                </span>
              </div>

              {docUiMeta ? (
                <IdentityStack>
                  <p className="form-label">
                    {tGlobal("header.documentsStatus")}
                  </p>

                  <span
                    className={`badge ${docUiMeta.badgeTone} ${styles.badgeTight}`}
                  >
                    <span className={styles.badgeText}>
                      {tGlobal(`Statuses.documents.${docUiMeta.id}` as any)}
                    </span>
                  </span>
                </IdentityStack>
              ) : null}
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
                {tGlobal("ApplicationRow.created")}{" "}
                {createdAt ? fmtShort.format(createdAt) : na}
              </IdentityMeta>
              <IdentityMeta>
                {tGlobal("ApplicationRow.updated")}{" "}
                {updatedAt ? fmtShort.format(updatedAt) : na}
              </IdentityMeta>
            </IdentityStack>
          </IdentityCard>
        </IdentityCards>

        <div className="stack">
          {effectiveOpenPanel !== "timeline" && (
            <StatusStepWizard
              ariaLabel={tAdmin("wizard.title")}
              activeStep={activeAdminStage}
              completedSteps={adminCompletedSteps}
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
                  label: awaitingClientDocuments
                    ? tWizard("adminSteps.documents.awaiting")
                    : tWizard("adminSteps.documents.review"),
                  href: `?open=documents&stage=documents#application-wizard`,
                },
                {
                  key: "visa_journey",
                  label: tWizard("adminSteps.visaJourney"),
                  href: `?open=journey&stage=visa_journey#application-wizard`,
                },
                {
                  key: "outcome",
                  label: tWizard("adminSteps.outcome"),
                  href: `?open=journey&stage=outcome#application-wizard`,
                },
              ]}
            >
              {effectiveOpenPanel === "journey" && (
                <DisclosurePanel
                  id="panel-journey"
                  title={tAdmin("journey.title")}
                  subtitle={tAdmin("journey.subtitle")}
                  defaultOpen={true}
                  chevronLabel={chevronLabel}
                >
                  <div
                    className="surface-soft"
                    style={{
                      padding: "var(--space-3)",
                      marginBottom: "var(--space-3)",
                    }}
                  >
                    <p className="text-sm text-muted" style={{ margin: 0 }}>
                      {tAdmin(
                        app.application_status === APPLICATION_STATUS.FINISHED
                          ? "wizard.finished"
                          : activeAdminStage === "outcome"
                            ? app.application_status ===
                              APPLICATION_STATUS.CANCELLED
                              ? "wizard.outcomeDeclined"
                              : "wizard.outcome"
                            : app.application_status ===
                                APPLICATION_STATUS.VISA_ISSUE_ACTION_NEEDED
                              ? "wizard.issueAction"
                              : "wizard.journeyHelp",
                      )}
                    </p>
                  </div>
                  <form
                    id="journey-form"
                    action={updateJourneyPanel}
                    className={styles.form}
                  >
                    <input type="hidden" name="applicationId" value={app.id} />
                    <input
                      type="hidden"
                      name="stage"
                      value={activeAdminStage}
                    />
                    <div className={styles.formGrid}>
                      <div className={styles.field}>
                        <label
                          className="form-label"
                          htmlFor="applicationStatus"
                        >
                          {tAdmin("journey.fieldLabel")}
                        </label>
                        <select
                          id="applicationStatus"
                          name="applicationStatus"
                          className="form-control"
                          disabled={statusSelectDisabled}
                          defaultValue=""
                        >
                          <option value="" disabled>
                            {tAdmin("journey.status.placeholder")}
                          </option>
                          {allowedNextStatuses.map((s) => {
                            const m = getApplicationStatusMeta(s);
                            return (
                              <option key={s} value={s}>
                                {tGlobal(
                                  `Statuses.applications.${m.labelKey}` as any,
                                )}
                              </option>
                            );
                          })}
                        </select>
                        <input
                          type="hidden"
                          name="applicationStatus"
                          value={app.application_status}
                          disabled={!statusSelectDisabled}
                        />
                        <ApplicationStatusGuardrails
                          formId="journey-form"
                          fieldName="applicationStatus"
                          title={tAdmin("journey.guardrailsTitle")}
                          defaultBody={tAdmin("journey.statusUnlock.default")}
                          bodiesByValue={{
                            [APPLICATION_STATUS.VISA_JOURNEY_STARTED]: tAdmin(
                              "journey.statusUnlock.visa_journey_started",
                            ),
                            [APPLICATION_STATUS.VISA_ISSUE_ACTION_NEEDED]:
                              tAdmin(
                                "journey.statusUnlock.visa_issue_action_needed",
                              ),
                            [APPLICATION_STATUS.VISA_APPROVED]: tAdmin(
                              "journey.statusUnlock.visa_approved",
                            ),
                            [APPLICATION_STATUS.FINISHED]: tAdmin(
                              "journey.statusUnlock.finished",
                            ),
                            [APPLICATION_STATUS.CANCELLED]: tAdmin(
                              "journey.statusUnlock.cancelled",
                            ),
                          }}
                          className={styles.guardrails}
                        />
                      </div>
                      <div className={styles.fieldFull}>
                        <label className="form-label" htmlFor="consultantNote">
                          {tAdmin("journey.noteLabel")}
                        </label>
                        <textarea
                          id="consultantNote"
                          name="consultantNote"
                          defaultValue={app.consultant_note ?? ""}
                          placeholder={tAdmin("journey.hints.notePlaceholder")}
                          className="form-control form-control-note"
                          rows={5}
                          disabled={!canEditNotes}
                        />
                      </div>
                    </div>
                    <div className={styles.formActions}>
                      <GuardedSubmitButton
                        formId="journey-form"
                        requiredFieldNames={["applicationStatus"]}
                        unlockOnNonEmptyFieldNames={["consultantNote"]}
                        lockUntilDirty={true}
                        label={tAdmin("journey.cta")}
                        pendingLabel={tGlobal("Common.actions.saving")}
                        arrowLabel={arrowRight}
                        confirmTitle={tGlobal("Confirm.title")}
                        confirmCancelLabel={tGlobal("Confirm.cancel")}
                        confirmContinueLabel={tGlobal("Confirm.continue")}
                        confirmOnDirty={true}
                        confirmMessageOnDirty={tAdmin("journey.confirmSave")}
                      />
                    </div>
                  </form>
                </DisclosurePanel>
              )}

              {effectiveOpenPanel === "documents" && (
                <DisclosurePanel
                  id="panel-documents"
                  title={tAdmin(
                    awaitingClientDocuments
                      ? "wizard.documentsWaitingTitle"
                      : "documents.title",
                  )}
                  subtitle={tAdmin(
                    awaitingClientDocuments
                      ? "wizard.documentsWaitingSubtitle"
                      : "wizard.documentsReviewSubtitle",
                  )}
                  defaultOpen={true}
                  chevronLabel={chevronLabel}
                >
                  <div
                    className={`surface-soft ${styles.cardBlock}`}
                    style={{ marginBottom: "var(--space-3)" }}
                  >
                    <p className="text-sm text-muted" style={{ margin: 0 }}>
                      {tAdmin(
                        awaitingClientDocuments
                          ? "wizard.documentsWaitingHelp"
                          : "wizard.documentsReviewHelp",
                      )}
                    </p>
                    <p
                      className="text-sm text-muted"
                      style={{ margin: "var(--space-2) 0 0" }}
                    >
                      {docsSummaryLabel}
                    </p>
                  </div>
                  {requirements.length === 0 ? (
                    <div className={`surface-soft ${styles.cardBlock}`}>
                      <p className="text-sm text-muted" style={{ margin: 0 }}>
                        {tAdmin("documents.empty")}
                      </p>
                    </div>
                  ) : (
                    <form
                      id="documents-form"
                      action={bulkUpdateDocumentStatuses}
                      className={styles.form}
                    >
                      <input
                        type="hidden"
                        name="applicationId"
                        value={app.id}
                      />
                      <input type="hidden" name="saved" value="documents" />
                      <input
                        type="hidden"
                        name="confirm_override_required"
                        defaultValue="0"
                      />
                      <BulkDocStatusConfirmFlag
                        formId="documents-form"
                        checkboxName="doc"
                        statusSelectName="target_status"
                        statusByDocType={statusByDocType}
                        outputName="confirm_override_required"
                      />
                      <div className={`surface-soft ${styles.bulkBar}`}>
                        <div className={styles.bulkGrid}>
                          <div className={styles.field}>
                            <label
                              className="form-label"
                              htmlFor="target_status"
                            >
                              {tAdmin("documents.columns.status")}
                            </label>
                            <select
                              id="target_status"
                              name="target_status"
                              className="form-control"
                              defaultValue=""
                              disabled={documentsLocked}
                            >
                              <option value="">
                                {tAdmin("documents.bulkStatus.placeholder")}
                              </option>
                              <option value="approved">
                                {tGlobal("Statuses.documents.approved")}
                              </option>
                              <option value="resubmit">
                                {tGlobal("Statuses.documents.resubmit")}
                              </option>
                            </select>
                            <ApplicationStatusGuardrails
                              formId="documents-form"
                              fieldName="target_status"
                              title={tAdmin("documents.bulk.guardrailsTitle")}
                              defaultBody={tAdmin(
                                "documents.bulk.hint.default",
                              )}
                              bodiesByValue={{
                                approved: tAdmin(
                                  "documents.bulk.hint.approved",
                                ),
                                resubmit: tAdmin(
                                  "documents.bulk.hint.resubmit",
                                ),
                              }}
                              className={styles.guardrails}
                            />
                          </div>
                          <div className={styles.fieldFull}>
                            <label className="form-label" htmlFor="note">
                              {tAdmin("documents.noteLabel")}
                            </label>
                            <textarea
                              id="note"
                              name="note"
                              placeholder={tAdmin(
                                "documents.bulk.hint.notePlaceholder",
                              )}
                              className="form-control form-control-note"
                              rows={4}
                              disabled={documentsLocked}
                            />
                          </div>
                        </div>
                        <div className={styles.formActions}>
                          <GuardedSubmitButton
                            formId="documents-form"
                            requiredFieldNames={["doc", "target_status"]}
                            conditionalRequired={{
                              whenFieldName: "target_status",
                              whenValue: "resubmit",
                              requiredFieldNames: ["note"],
                            }}
                            label={tGlobal("Buttons.save")}
                            pendingLabel={tGlobal("Common.actions.saving")}
                            arrowLabel={arrowRight}
                            confirmTitle={tGlobal("Confirm.title")}
                            confirmCancelLabel={tGlobal("Confirm.cancel")}
                            confirmContinueLabel={tGlobal("Confirm.continue")}
                            confirmWhenFieldChanged={{
                              fieldName: "confirm_override_required",
                            }}
                            confirmMessageFieldChanged={tAdmin(
                              "documents.confirmOverwriteStatus",
                            )}
                            confirmOnDirty={true}
                            confirmMessageOnDirty={tAdmin(
                              "documents.confirmSave",
                            )}
                            disabled={documentsLocked}
                          />
                        </div>
                      </div>
                      <div className={styles.checklist}>
                        {requirements.map((r) => {
                          const dt = (() => {
                            const raw = r.document_types;
                            if (Array.isArray(raw))
                              return raw.length > 0 ? raw[0] : null;
                            return raw ?? null;
                          })();
                          const key = dt
                            ? docTypeKey({ id: dt.id, name_key: dt.name_key })
                            : r.document_type_id;
                          const label = tDocTypes(`${key}.label` as any);
                          const desc = tDocTypes(`${key}.desc` as any);
                          const latest =
                            latestByType.get(r.document_type_id) ?? null;
                          const hasUpload = Boolean(latest?.drive_link);
                          const status: ClientDocumentStatus | null = hasUpload
                            ? (latest?.status ?? "pending")
                            : null;
                          const statusMeta = status
                            ? getDocumentUiMeta(status)
                            : null;
                          const uploadedAt = safeIsoToDate(
                            latest?.uploaded_at ?? null,
                          );
                          const statusUpdatedAt = safeIsoToDate(
                            latest?.status_updated_at ?? null,
                          );
                          const checkboxDisabled =
                            !latest || !latest.drive_link || documentsLocked;
                          // Row state tint — driven by the latest document's real status.
                          // - "resubmit" / "rejected" → needs attention (protea pink)
                          // - "approved"              → reviewed / green
                          // - everything else         → neutral (default surface-soft)
                          const rowStateClass =
                            status === "resubmit" || status === "rejected"
                              ? styles.checkRowNeedsAttention
                              : status === "approved"
                                ? styles.checkRowApproved
                                : "";
                          const checkboxId = `doc-${app.id}-${r.document_type_id}`;
                          return (
                               <div
                                key={r.document_type_id}
                                className={[
                                  "surface-soft",
                                  styles.checkRow,
                                  rowStateClass,
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                data-doc-state={
                                  status === "resubmit" || status === "rejected"
                                    ? "needs-attention"
                                    : status === "approved"
                                      ? "approved"
                                      : "neutral"
                                }
                              >
                              <label
                                htmlFor={checkboxId}
                                className={styles.checkRowOverlay}
                                aria-label={`Toggle ${label}`}
                              />
                              <div className={styles.reqLeft}>
                                <input
                                  id={checkboxId}
                                  type="checkbox"
                                  name="doc"
                                  value={r.document_type_id}
                                  className={styles.checkbox}
                                  disabled={checkboxDisabled}
                                />
                                <div className={styles.checkBody}>
                                  <div className={styles.checkText}>
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "var(--space-2)",
                                      }}
                                    >
                                      <p
                                        className="text-md text-bold"
                                        style={{ margin: 0 }}
                                      >
                                        {label}
                                      </p>
                                      {statusMeta ? (
                                        <span
                                          className={`badge ${statusMeta.badgeTone ?? NEUTRAL}`}
                                        >
                                          <span>
                                            {tGlobal(
                                              `Statuses.documents.${status}` as any,
                                            )}
                                          </span>
                                        </span>
                                      ) : null}
                                    </div>
                                    <p
                                      className="text-xs text-muted"
                                      style={{ margin: 0 }}
                                    >
                                      {desc}
                                    </p>
                                    {latest ? (
                                      <div className={styles.fileMeta}>
                                        <p
                                          className="text-sm text-muted"
                                          style={{ margin: 0 }}
                                        >
                                          {tAdmin("documents.columns.fileName")}
                                          : {latest.file_name}
                                        </p>
                                        <p
                                          className="text-sm text-muted"
                                          style={{ margin: 0 }}
                                        >
                                          {tAdmin(
                                            "documents.columns.uploadedAt",
                                          )}
                                          :{" "}
                                          {uploadedAt
                                            ? fmtWithTime.format(uploadedAt)
                                            : na}
                                        </p>
                                        <p
                                          className="text-sm text-muted"
                                          style={{ margin: 0 }}
                                        >
                                          {tAdmin(
                                            "documents.columns.fileVersion",
                                          )}
                                          : {latest.copy_number}
                                        </p>
                                        {statusUpdatedAt ? (
                                          <p
                                            className="text-sm text-muted"
                                            style={{ margin: 0 }}
                                          >
                                            {tAdmin(
                                              "documents.statusUpdatedAt",
                                              {
                                                value:
                                                  fmtWithTime.format(
                                                    statusUpdatedAt,
                                                  ),
                                              },
                                            )}
                                          </p>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <p
                                        className="text-sm text-muted"
                                        style={{ margin: 0 }}
                                      >
                                        {tAdmin("documents.noneUploaded")}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className={styles.reqRight}>
                                {latest?.drive_link && !documentsLocked ? (
                                  <a
                                    href={latest.drive_link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="button button-ghost"
                                  >
                                    {tAdmin("documents.actions.viewInDrive")}
                                    <span
                                      className={styles.arrow}
                                      aria-hidden="true"
                                    >
                                      {arrowRight}
                                    </span>
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </form>
                  )}
                </DisclosurePanel>
              )}
            </StatusStepWizard>
          )}

          {effectiveOpenPanel === "timeline" && (
            <DisclosurePanel
              id="panel-timeline"
              title={tGlobal("Timeline.title")}
              subtitle={tGlobal("Timeline.subtitle")}
              defaultOpen={timelineEvents.length > 0}
              chevronLabel={chevronLabel}
            >
              <Timeline
                locale={uiLocale}
                dateNaLabel={tGlobal("Common.dates.na")}
                events={timelineEvents}
                translate={tGlobal}
              />
            </DisclosurePanel>
          )}
        </div>
      </MainColumn>
    </PageShell>
  );
}
