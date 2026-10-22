/*DOC NAME: page.tsx
LOCATION: /src/app/[locale]/(admin)/admin/cases/[id]/page.tsx
SCOPE: Admin Case Detail (Consultation → Plan → Requirements → Activation) with strict guards + clean UI state rules.
STATUS: LOCKED
AUDITED:
- Uses service-role Supabase (bypasses RLS): enforced server-side auth.getUser() + role gate (defense-in-depth) for page + every server action.
- Fixed locale-dropping redirects to preserve /[locale] for next-intl routing.
- Fixed isClosed boolean bug that previously evaluated truthy for all cases (risk: incorrect locking/enabling of protected actions).
*/

export const dynamic = "force-dynamic";

/* -------------------------------------------------------------------------- */
/* Imports                                                                    */
/* -------------------------------------------------------------------------- */

import "server-only";

import StatusStepWizard, {
  getCaseCompletedStepKeys,
  getCaseWizardStepKey,
} from "@/components/progression/StatusStepWizard";

import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { notFound, redirect } from "next/navigation";
import { unstable_noStore as noStore, revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";

import {
  createServerSupabaseClient,
  createAdminSupabaseClient,
} from "@/lib/supabaseServer";

import { createApplicationDriveFolders } from "@/lib/googleDrive";

/* -------------------------------------------------------------------------- */
/* UI Components                                                              */
/* -------------------------------------------------------------------------- */

import ExportCaseDetailsButton from "@/components/admin/ExportCaseDetailsButton";
import GuardedSubmitButton from "@/components/admin/GuardedSubmitButton";
import CaseEditGuard from "@/components/admin/CaseEditGuard";
import ConsultationGuardrails from "@/components/admin/ConsultationGuardrails";

import { PageShell } from "@/components/ui/layout/PageShell";
import { MainColumn } from "@/components/ui/layout/MainColumn";
import { DisclosurePanel } from "@/components/ui/panel/DisclosurePanel";
import Timeline from "@/components/ui/timeline/Timeline";
import { normalizeTimelineEvents } from "@/lib/timeline/normalizeTimelineEvents";

import FormFieldLock from "@/components/ui/FormFieldLock";
import CheckboxGroupFingerprint from "@/components/ui/CheckboxGroupFingerprint";
import ConfirmSubmitButton from "@/components/ui/ConfirmSubmitButton";
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

/* -------------------------------------------------------------------------- */
/* Config                                                                     */
/* -------------------------------------------------------------------------- */

import {
  CASE_STATUS,
  getCaseStatusMeta,
  getApplicationStatusMeta,
  getDocumentUiMeta,
  isValidCaseStatus,
  type CaseStatusId,
  NEUTRAL,
  SUCCESS,
  FINISHED,
} from "@/config/statuses";

import { siteConfig } from "@/config/siteConfig";

import styles from "@/styles/casedetails.module.css";
// import styles from "./details.module.css";

/* -------------------------------------------------------------------------- */
/* Dev Flags                                                                  */
/* -------------------------------------------------------------------------- */

// Dev bypass for activation (explicitly gated, never on by default)
const ENABLE_DEV_ACTIVATION_BYPASS =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_ENABLE_DEV_ACTIVATION_BYPASS === "true";

/* -------------------------------------------------------------------------- */
/* Admin Supabase (Service Role)                                              */
/* -------------------------------------------------------------------------- */

function getAdminSupabase() {
  // Centralized server-only service role client.
  // Prevents accidental key exposure and keeps blast radius contained.
  // NOTE: Previous per-page X-Client-Info header was intentionally removed.
  // If required, add centrally in createAdminSupabaseClient().
  return createAdminSupabaseClient();
}

/* -------------------------------------------------------------------------- */
/* Status Normalization                                                       */
/* -------------------------------------------------------------------------- */
/*
   Single source of truth = /src/config/statuses.ts
   - Normalize any DB / query-provided status to CaseStatusId
   - In dev: throw fast if DB returns an unknown status
   - In prod: fallback to draft_intake
*/

function normalizeCaseStatus(value: unknown): CaseStatusId {
  const s = typeof value === "string" ? value.trim() : "";

  if (isValidCaseStatus(s)) return s as CaseStatusId;

  if (process.env.NODE_ENV !== "production" && s.length > 0) {
    throw new Error(`[AdminCaseDetail] Unknown case status from DB: "${s}"`);
  }

  return CASE_STATUS.DRAFT_INTAKE;
}

const CASE_STATUS_RANK = {
  draft_intake: 0,
  intake_submitted: 1,
  consultation_requested: 2,
  consultation_booked: 3,
  consultation_completed: 4,
  plan_created: 5,
  requirements_added: 6,
  application_activated: 7,
  finished: 8,
  closed: 9,
} as const;

type CaseStatus = CaseStatusId;

function rankOf(status: unknown) {
  const s = normalizeCaseStatus(status);
  return CASE_STATUS_RANK[s as keyof typeof CASE_STATUS_RANK] ?? 0;
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

/* -------------------------------------------------------------------------- */
/* URL Helpers                                                                */
/* -------------------------------------------------------------------------- */

function buildCaseDetailsUrl(opts: {
  locale: string;
  caseId: string;
  params?: Record<string, string | undefined>;
  openPanel?:
    | "consultation"
    | "plan"
    | "requirements"
    | "activation"
    | "intake"
    | "preview"
    | "timeline";
}) {
  const qp = new URLSearchParams();

  if (opts.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      if (typeof v === "string" && v.length > 0) qp.set(k, v);
    }
  }

  if (opts.openPanel) qp.set("open", opts.openPanel);

  const base = `/${opts.locale}${siteConfig.adminCaseDetailsPath(opts.caseId)}`;
  const qs = qp.toString();
  const hash = "#application-wizard";

  return qs.length > 0 ? `${base}?${qs}${hash}` : `${base}${hash}`;
}

/* -------------------------------------------------------------------------- */
/* Utilities                                                                  */
/* -------------------------------------------------------------------------- */

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
  const locale = await getLocale();
  const sessionSupabase = await createServerSupabaseClient();

  const {
    data: { user },
    error,
  } = await sessionSupabase.auth.getUser();

  if (error) logPostgrestError("[AdminCaseDetail] auth.getUser error:", error);

  // Unauthenticated → locale-safe login
  if (!user) redirect(`/${locale}${siteConfig.loginPath}`);

  const { data: roleRow, error: roleError } = await sessionSupabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (roleError) {
    logPostgrestError("[AdminCaseDetail] user_roles read error:", roleError);
    notFound();
  }

  const role = (roleRow?.role ?? "").toString();
  const allowed = role === "admin" || role === "consultant";

  // Unauthorized → fail closed (do not reveal existence)
  if (!allowed) notFound();

  return { actorUserId: user.id, actorRole: role, locale };
}

/* -------------------------------------------------------------------------- */
/* Data                                                                       */
/* -------------------------------------------------------------------------- */

type CaseRow = {
  id: string;
  user_id: string;
  status: string;
  intake_json: any;
  draft_recommendation: any;
  final_application_type: string | null;
  plan_notes: string | null;
  consultant_note: string | null;
  consultant_note_updated_at: string | null;

  consultation_channel: string | null;
  consultation_requested_at: string | null;
  consultation_scheduled_for: string | null;
  consultation_link: string | null;

  application_id: string | null;

  created_at: string;
  updated_at: string;

  client_profiles: ClientProfileRow | ClientProfileRow[] | null;
};

type ApplicationRow = {
  id: string;
  user_id: string;
  application_type: string;
  application_status: string;
  document_status: string;
  destination: string | null;
  consultant_note: string | null;
  consultant_note_updated_at: string | null;
  timeline: any;
  created_at: string | null;
  updated_at: string | null;
};

type DocumentTypeRow = {
  id: string;
  name_key: string;
  priority: number | null;
  required: boolean | null;
};

type RequirementRow = {
  application_id: string;
  document_type_id: string;
  required: boolean;
  document_types: {
    id: string;
    name_key: string;
  } | null;
};

// PostgREST sometimes returns embedded relations as an array (even for FK relations),
// so model the DB-returned shape separately.
type RequirementRowDb = {
  application_id: any;
  document_type_id: any;
  required: any;
  document_types:
    | {
        id: any;
        name_key: any;
      }
    | {
        id: any;
        name_key: any;
      }[]
    | null;
};

type DocumentRow = {
  id: string;
  application_id: string;
  document_type_id: string | null;
  status: string;
  copy_number: number;
  uploaded_at: string | null;
};

function safeIsoToDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function normalizePlannedRequirements(intakeJson: any): string[] {
  const raw = intakeJson?.plan_requirements;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => typeof x === "string")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

/* -------------------------------------------------------------------------- */
/* Contact Types                                                              */
/* -------------------------------------------------------------------------- */

type ClientProfileRow = {
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;

  date_of_birth: string | null;
  citizenship_country: string | null;
  city_country: string | null;
  marital_status: string | null;

  phone_country_code: string | null;
  phone_number: string | null;

  whatsapp_country_code: string | null;
  whatsapp_number: string | null;

  preferred_contact_method: string | null;
  preferred_contact_time: string | null;

  contact_email: string | null;
  telegram_username: string | null;
  whatsapp_e164: string | null;

  family_composition: string | null;

  income_over_2000: string | null;
  income_source: string | null;

  been_to_sa: string | null;
  first_entry_sa: string | null;

  current_location: string | null;
  current_visa_status: string | null;

  visa_refusals: string | null;
  visa_refusals_details: string | null;

  passport_expiry: string | null;

  visit_purpose: string | null;
  immigration_goal: string | null;

  english_level: string | null;
  need_language_school: string | null;
};

type ClientProfile = ClientProfileRow | null;

type ClickToContact = {
  method: "email" | "whatsapp" | "telegram";
  href: string;
  isExternal: boolean;
} | null;

// contact link CTA
function buildClickToContact(profile: ClientProfile): ClickToContact {
  const methodRaw =
    typeof profile?.preferred_contact_method === "string"
      ? profile.preferred_contact_method.trim().toLowerCase()
      : "";

  if (methodRaw === "email") {
    const email =
      typeof profile?.contact_email === "string"
        ? profile.contact_email.trim()
        : "";

    // values are already validated/normalised upstream; keep minimal safety checks
    if (email.length > 3 && email.includes("@")) {
      return { method: "email", href: `mailto:${email}`, isExternal: false };
    }
    return null;
  }

  if (methodRaw === "whatsapp") {
    const raw =
      typeof profile?.whatsapp_e164 === "string"
        ? profile.whatsapp_e164.trim()
        : "";

    const digits = raw.replace(/\D/g, "");
    if (digits.length > 0) {
      return {
        method: "whatsapp",
        href: `https://wa.me/${digits}`,
        isExternal: true,
      };
    }
    return null;
  }

  if (methodRaw === "telegram") {
    const raw =
      typeof profile?.telegram_username === "string"
        ? profile.telegram_username.trim()
        : "";

    const username = raw.replace(/^@/, "").replace(/\s+/g, "");
    if (username.length > 0) {
      return {
        method: "telegram",
        href: `https://t.me/${encodeURIComponent(username)}`,
        isExternal: true,
      };
    }
    return null;
  }

  return null;
}

type ContactMethod = "email" | "whatsapp" | "telegram";

type ContactLink = {
  method: ContactMethod;
  href: string;
  isExternal: boolean;
  isPreferred: boolean;
};

function buildContactLinks(profile: ClientProfile): ContactLink[] {
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

  // Email
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

  // WhatsApp (E164 digits only -> wa.me/<digits>)
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

  // Telegram (t.me/<username>)
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

  // Preferred first, then stable order for the rest
  links.sort((a, b) => {
    if (a.isPreferred && !b.isPreferred) return -1;
    if (!a.isPreferred && b.isPreferred) return 1;
    return a.method.localeCompare(b.method);
  });

  return links;
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
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
    if (!doc) continue;

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

// ─────────────────────────────────────────────
// Server action: advance the case from intake into the consultation workflow.
// Keep the intake milestones explicit: draft_intake -> intake_submitted -> consultation_requested.
// ─────────────────────────────────────────────
async function advanceCaseFromIntake(formData: FormData) {
  "use server";
  await assertAdminOrConsultantOrNotFound();
  const locale = await getLocale();
  const supabase = getAdminSupabase();
  const caseId = formData.get("caseId");
  if (typeof caseId !== "string" || !caseId.trim())
    throw new Error("Invalid payload.");

  const { data: currentCase, error: fetchError } = await supabase
    .from("client_cases")
    .select("id,status,consultation_requested_at")
    .eq("id", caseId)
    .maybeSingle();
  if (fetchError) {
    logPostgrestError("[advanceCaseFromIntake] fetch case error:", fetchError);
    throw new Error("Failed to load case.");
  }
  if (!currentCase) notFound();

  const currentStatus = normalizeCaseStatus(currentCase.status);

  // Two-step advance on the admin side:
  //   draft_intake        -> intake_submitted        (stage the intake)
  //   intake_submitted    -> consultation_requested  (hand off to consultation;
  //                                                   step 1 becomes ✓ here)
  const nextStatus: CaseStatusId | null =
    currentStatus === "draft_intake"
      ? "intake_submitted"
      : currentStatus === "intake_submitted"
        ? "consultation_requested"
        : null;

  if (!nextStatus) {
    redirect(
      buildCaseDetailsUrl({
        locale,
        caseId,
        params: { error: "invalid_status_transition" },
        openPanel: "consultation",
      }),
    );
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: nextStatus,
    updated_at: now,
  };

  // Stamp consultation_requested_at the first time we transition into
  // consultation_requested, so the audit trail reflects the actual hand-off.
  if (
    nextStatus === "consultation_requested" &&
    !currentCase.consultation_requested_at
  ) {
    patch.consultation_requested_at = now;
  }

  const { error: updateError } = await supabase
    .from("client_cases")
    .update(patch)
    .eq("id", caseId);
  if (updateError) {
    logPostgrestError("[advanceCaseFromIntake] update error:", updateError);
    throw new Error("Failed to advance the case.");
  }

  revalidatePath(`/${locale}${siteConfig.adminCaseDetailsPath(caseId)}`);
  revalidatePath(`/${locale}${siteConfig.adminCasesPath}`);

  // Land on consultation once we've moved past intake; stay on intake
  // for the first stage (intake_submitted), so the admin sees the "Next"
  // button that finishes the hand-off.
  redirect(
    buildCaseDetailsUrl({
      locale,
      caseId,
      params: { saved: "intake_progress", status: nextStatus },
      openPanel:
        nextStatus === "consultation_requested" ? "consultation" : "intake",
    }),
  );
}

// ─────────────────────────────────────────────
// Server action: Save consultation panel
// Contract:
// - editable only up to consultation_completed
// - once at/after consultation_completed: ONLY notes are editable
// - schedule fields only editable when effective status is consultation_booked
// - when setting consultation_completed: auto-open Plan panel
// ─────────────────────────────────────────────

async function updateConsultationPanel(formData: FormData) {
  "use server";

  await assertAdminOrConsultantOrNotFound();
  const locale = await getLocale();

  const supabase = getAdminSupabase();
  const caseId = formData.get("caseId");

  const channelRaw = formData.get("consultation_channel");
  const scheduledRaw = formData.get("consultation_scheduled_for");
  const linkRaw = formData.get("consultation_link");
  const noteRaw = formData.get("consultant_note");
  const nextStatusRaw = formData.get("next_case_status");

  if (typeof caseId !== "string") throw new Error("Invalid payload.");

  const desiredNext =
    typeof nextStatusRaw === "string" && nextStatusRaw.trim().length > 0
      ? nextStatusRaw.trim()
      : "";

  const consultation_channel =
    typeof channelRaw === "string" && channelRaw.trim().length > 0
      ? channelRaw.trim().slice(0, 64)
      : null;

  const consultation_link =
    typeof linkRaw === "string" && linkRaw.trim().length > 0
      ? linkRaw.trim().slice(0, 2000)
      : null;

  const scheduledValue =
    typeof scheduledRaw === "string" && scheduledRaw.trim().length > 0
      ? scheduledRaw.trim()
      : "";

  const scheduledDate =
    scheduledValue.length > 0 ? new Date(scheduledValue) : null;
  const consultation_scheduled_for =
    scheduledDate && !Number.isNaN(scheduledDate.getTime())
      ? scheduledDate.toISOString()
      : null;

  const consultant_note_raw =
    typeof noteRaw === "string" ? noteRaw.trim().slice(0, 4000) : "";
  const consultant_note =
    consultant_note_raw.length > 0 ? consultant_note_raw : null;

  const { data: currentCase, error: fetchError } = await supabase
    .from("client_cases")
    .select(
      "id,status,application_id,consultation_requested_at,consultation_channel,consultation_scheduled_for,consultation_link",
    )
    .eq("id", caseId)
    .maybeSingle();

  if (fetchError) {
    logPostgrestError(
      "[updateConsultationPanel] fetch case error:",
      fetchError,
    );
    throw new Error("Failed to load case.");
  }
  if (!currentCase) notFound();

  const currentStatus = normalizeCaseStatus(currentCase.status);
  const currentRank = rankOf(currentStatus);

  if (currentStatus === "closed") {
    redirect(
      buildCaseDetailsUrl({
        locale,
        caseId,
        params: { error: "case_closed" },
        openPanel: "consultation",
      }),
    );
  }

  const isActivated =
    Boolean(currentCase.application_id) ||
    currentRank >= CASE_STATUS_RANK.application_activated;

  // Notes-only once consultation is completed (or beyond).
  const notesOnly =
    currentRank >= CASE_STATUS_RANK.consultation_completed || isActivated;

  const allowedNext = new Set([
    "consultation_requested",
    "consultation_booked",
    "consultation_completed",
    "closed",
  ]);

  let nextStatus: string | null = null;

  // Status changes only allowed BEFORE consultation_completed and BEFORE activation.
  if (!notesOnly && desiredNext.length > 0) {
    if (!allowedNext.has(desiredNext)) {
      redirect(
        buildCaseDetailsUrl({
          locale,
          caseId,
          params: { error: "invalid_status_transition" },
          openPanel: "consultation",
        }),
      );
    }
    nextStatus = desiredNext;
  }

  const effectiveStatus = nextStatus ?? currentStatus;

  // Scheduling details editable ONLY when status is consultation_booked AND not notesOnly.
  const canEditSchedule =
    !notesOnly && effectiveStatus === "consultation_booked";

  // Server-enforced: booked requires channel + datetime.
  if (!notesOnly && effectiveStatus === "consultation_booked") {
    if (!consultation_channel || !consultation_scheduled_for) {
      redirect(
        buildCaseDetailsUrl({
          locale,
          caseId,
          params: { error: "consultation_booking_requires_channel_and_date" },
          openPanel: "consultation",
        }),
      );
    }
  }

  const patch: any = {
    updated_at: new Date().toISOString(),
  };

  // Notes ALWAYS allowed (unless closed already handled).
  patch.consultant_note = consultant_note;
  if (consultant_note !== null) {
    patch.consultant_note_updated_at = new Date().toISOString();
  }

  // Only write schedule fields if allowed.
  if (canEditSchedule) {
    patch.consultation_channel = consultation_channel;
    patch.consultation_scheduled_for = consultation_scheduled_for;
    patch.consultation_link = consultation_link;
  }

  // Only write status if allowed.
  if (nextStatus) {
    patch.status = nextStatus;

    // When moving into consultation_requested, stamp requested_at once.
    if (
      nextStatus === "consultation_requested" &&
      !currentCase.consultation_requested_at
    ) {
      patch.consultation_requested_at = new Date().toISOString();
    }
  }

  const { error: updateError } = await supabase
    .from("client_cases")
    .update(patch)
    .eq("id", caseId);

  if (updateError) {
    logPostgrestError("[updateConsultationPanel] update error:", updateError);
    throw new Error("Failed to update consultation.");
  }

  revalidatePath(`/${locale}${siteConfig.adminCaseDetailsPath(caseId)}`);
  revalidatePath(`/${locale}${siteConfig.adminCasesPath}`);

  const redirectOpenPanel =
    nextStatus === "consultation_completed" ? "plan" : "consultation";
  const redirectStatus = nextStatus ?? currentStatus;

  redirect(
    buildCaseDetailsUrl({
      locale,
      caseId,
      params: { saved: "consultation", status: redirectStatus },
      openPanel: redirectOpenPanel,
    }),
  );
}

// ─────────────────────────────────────────────
// Server action: Save plan panel
// Contract:
// - disabled before consultation_completed (server-enforced)
// - once activated: ONLY consultant_note is editable
// - status advances to plan_created only from consultation_completed (never downgrades later)
// ─────────────────────────────────────────────

async function updatePlanPanel(formData: FormData) {
  "use server";

  await assertAdminOrConsultantOrNotFound();
  const locale = await getLocale();

  const supabase = getAdminSupabase();
  const caseId = formData.get("caseId");

  const typeRaw = formData.get("final_application_type");
  const notesRaw = formData.get("plan_notes");
  const noteRaw = formData.get("consultant_note");

  if (typeof caseId !== "string") throw new Error("Invalid payload.");

  const { data: currentCase, error: fetchErr } = await supabase
    .from("client_cases")
    .select("id,status,application_id")
    .eq("id", caseId)
    .maybeSingle();

  if (fetchErr) {
    logPostgrestError("[updatePlanPanel] fetch case error:", fetchErr);
    throw new Error("Failed to load case.");
  }
  if (!currentCase) notFound();

  const currentStatus = normalizeCaseStatus(currentCase.status);
  const currentRank = rankOf(currentStatus);

  if (currentStatus === "closed") {
    redirect(
      buildCaseDetailsUrl({
        locale,
        caseId,
        params: { error: "case_closed" },
        openPanel: "plan",
      }),
    );
  }

  // Server-enforce prerequisite
  if (currentRank < CASE_STATUS_RANK.consultation_completed) {
    redirect(
      buildCaseDetailsUrl({
        locale,
        caseId,
        params: { error: "plan_not_ready" },
        openPanel: "consultation",
      }),
    );
  }

  const isActivated =
    Boolean(currentCase.application_id) ||
    currentRank >= CASE_STATUS_RANK.application_activated;

  const final_application_type =
    typeof typeRaw === "string" && typeRaw.trim().length > 0
      ? typeRaw.trim()
      : null;

  const plan_notes =
    typeof notesRaw === "string" && notesRaw.trim().length > 0
      ? notesRaw.trim().slice(0, 10000)
      : null;

  const consultant_note_raw =
    typeof noteRaw === "string" ? noteRaw.trim().slice(0, 4000) : "";
  const consultant_note =
    consultant_note_raw.length > 0 ? consultant_note_raw : null;

  const patch: any = {
    updated_at: new Date().toISOString(),
    consultant_note,
  };

  if (consultant_note !== null) {
    patch.consultant_note_updated_at = new Date().toISOString();
  }

  // Only allow plan fields pre-activation.
  if (!isActivated) {
    patch.final_application_type = final_application_type;
    patch.plan_notes = plan_notes;

    // Advance to plan_created ONLY from consultation_completed (never downgrade later).
    if (currentStatus === "consultation_completed" && final_application_type) {
      patch.status = "plan_created";
    }
  }

  const { error: updateError } = await supabase
    .from("client_cases")
    .update(patch)
    .eq("id", caseId);

  if (updateError) {
    logPostgrestError("[updatePlanPanel] update error:", updateError);
    throw new Error("Failed to update plan.");
  }

  revalidatePath(`/${locale}${siteConfig.adminCaseDetailsPath(caseId)}`);
  revalidatePath(`/${locale}${siteConfig.adminCasesPath}`);

  const nextStatus =
    typeof patch.status === "string" && patch.status.trim().length > 0
      ? patch.status
      : null;

  redirect(
    buildCaseDetailsUrl({
      locale,
      caseId,
      params: {
        saved: "plan",
        status: nextStatus ?? undefined,
        status_kind: nextStatus ? "cases" : undefined,
      },
      openPanel: "requirements",
    }),
  );
}

// ─────────────────────────────────────────────
// Server action: Save requirements
// Contract:
// - disabled before plan_created (server-enforced)
// - status becomes requirements_added ONLY the first time (plan_created → requirements_added)
// - requirements remain editable after activation (RPC sync), but status must NEVER downgrade
// ─────────────────────────────────────────────

async function saveRequirements(formData: FormData) {
  "use server";

  await assertAdminOrConsultantOrNotFound();
  const locale = await getLocale();

  const supabase = getAdminSupabase();
  const caseId = formData.get("caseId");

  if (typeof caseId !== "string") throw new Error("Invalid payload.");

  const selectedIds = formData
    .getAll("doc")
    .filter((x): x is string => typeof x === "string");
  const desired = uniq(
    selectedIds.map((x) => x.trim()).filter((x) => x.length > 0),
  );

  const { data: c, error: cErr } = await supabase
    .from("client_cases")
    .select("id,status,application_id")
    .eq("id", caseId)
    .maybeSingle();

  if (cErr) {
    logPostgrestError("[saveRequirements] load case error:", cErr);
    throw new Error("Failed to load case.");
  }
  if (!c) notFound();

  const status = normalizeCaseStatus(c.status);
  const rank = rankOf(status);

  if (status === "closed") {
    redirect(
      buildCaseDetailsUrl({
        locale,
        caseId,
        params: { error: "case_closed" },
        openPanel: "requirements",
      }),
    );
  }

  // Server-enforce prerequisite
  if (rank < CASE_STATUS_RANK.plan_created) {
    redirect(
      buildCaseDetailsUrl({
        locale,
        caseId,
        params: { error: "requirements_not_ready" },
        openPanel: "plan",
      }),
    );
  }

  // Validate ids exist
  let validDesired: string[] = [];

  if (desired.length > 0) {
    const { data: dtRows, error: dtErr } = await supabase
      .from("document_types")
      .select("id")
      .in("id", desired);

    if (dtErr) {
      logPostgrestError(
        "[saveRequirements] document_types validate error:",
        dtErr,
      );
      throw new Error("Failed to validate document types.");
    }

    const validSet = new Set((dtRows ?? []).map((r: any) => r.id));
    validDesired = desired.filter((id) => validSet.has(id));
  }

  if (validDesired.length === 0) {
    redirect(
      buildCaseDetailsUrl({
        locale,
        caseId,
        params: { error: "requirements_required" },
        openPanel: "requirements",
      }),
    );
  }

  // RPC updates intake_json.plan_requirements ALWAYS and syncs to client_application_requirements if activated.
  const { error: rpcErr } = await supabase.rpc("upsert_case_requirements", {
    p_case_id: caseId,
    p_document_type_ids: validDesired,
  });

  if (rpcErr) {
    logPostgrestError(
      "[saveRequirements] rpc upsert_case_requirements error:",
      rpcErr,
    );
    throw new Error("Failed to save requirements.");
  }

  // Status bump ONLY once: plan_created -> requirements_added
  const isActivated =
    Boolean(c.application_id) || rank >= CASE_STATUS_RANK.application_activated;

  let nextStatus: string | null = null;

  let warningKey: string | null = null;

  if (!isActivated && status === "plan_created") {
    nextStatus = "requirements_added";

    const { error: statusErr } = await supabase
      .from("client_cases")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", caseId);

    if (statusErr) {
      // Requirements were already saved via RPC; don't block progress.
      logPostgrestError("[saveRequirements] status update error:", statusErr);

      // Fallback: keep the prior status so we don't write an invalid enum/check value.
      nextStatus = null;
      warningKey = "requirements_saved_status_not_updated";
    }
  }

  revalidatePath(`/${locale}${siteConfig.adminCaseDetailsPath(caseId)}`);
  revalidatePath(`/${locale}${siteConfig.adminCasesPath}`);

  redirect(
    buildCaseDetailsUrl({
      locale,
      caseId,
      params: {
        saved: "requirements",
        status: nextStatus ?? status,
        warning: warningKey ?? undefined,
      },
      openPanel: "activation",
    }),
  );
}

// ─────────────────────────────────────────────
// Server action: Activate application
// Contract:
// - Creates client_applications row
// - Creates client_application_requirements rows
// - Links client_cases.application_id
// - MUST create Drive folders and write drive_* fields at INSERT time
//   (because prevent_drive_fields_update() blocks updating them later)
// ─────────────────────────────────────────────

async function activateApplication(formData: FormData) {
  "use server";

  await assertAdminOrConsultantOrNotFound();
  const locale = await getLocale();

  const supabase = getAdminSupabase();
  const caseId = formData.get("caseId");
  const devBypass = formData.get("devBypass") === "true";

  if (typeof caseId !== "string") throw new Error("Invalid payload.");

  const { data: c, error: cErr } = await supabase
    .from("client_cases")
    .select(
      "id, user_id, status, final_application_type, intake_json, application_id",
    )
    .eq("id", caseId)
    .maybeSingle();

  if (cErr) {
    logPostgrestError("[activateApplication] load case error:", cErr);
    throw new Error("Failed to load case.");
  }
  if (!c) notFound();

  const caseStatus = normalizeCaseStatus(c.status);

  if (caseStatus === "closed") {
    redirect(
      buildCaseDetailsUrl({
        locale,
        caseId,
        params: { error: "case_closed" },
        openPanel: "activation",
      }),
    );
  }

  // Already activated (idempotent)
  if (c.application_id) {
    redirect(
      buildCaseDetailsUrl({
        locale,
        caseId,
        params: { saved: "activation", status: "application_activated" },
        openPanel: "activation",
      }),
    );
  }

  const status = caseStatus;
  const finalTypeRaw = (c.final_application_type ?? "").toString().trim();

  const planned = normalizePlannedRequirements(c.intake_json);
  const plannedUnique = uniq(planned);

  const allowActivation =
    ((status === "plan_created" ||
      status === "consultation_completed" ||
      status === "requirements_added") &&
      finalTypeRaw.length > 0 &&
      plannedUnique.length > 0) ||
    (ENABLE_DEV_ACTIVATION_BYPASS && devBypass);

  if (!allowActivation) {
    redirect(
      buildCaseDetailsUrl({
        locale,
        caseId,
        params: { error: "activation_preconditions_not_met" },
        openPanel: "activation",
      }),
    );
  }

  // Validate document type ids exist
  const { data: dtRows, error: dtErr } = await supabase
    .from("document_types")
    .select("id")
    .in("id", plannedUnique);

  if (dtErr) {
    logPostgrestError("[activateApplication] validate doc types error:", dtErr);
    throw new Error("Failed to validate document types.");
  }

  const validSet = new Set((dtRows ?? []).map((r: any) => r.id));
  const validPlanned = plannedUnique.filter((id) => validSet.has(id));

  // If not bypassing, enforce at least one valid requirement
  if (!ENABLE_DEV_ACTIVATION_BYPASS || !devBypass) {
    if (validPlanned.length === 0) {
      redirect(
        buildCaseDetailsUrl({
          locale,
          caseId,
          params: { error: "no_valid_requirements_selected" },
          openPanel: "requirements",
        }),
      );
    }
  }

  const destination =
    typeof c.intake_json?.destination === "string"
      ? c.intake_json.destination
      : null;

  // Resolve a stable client display name for Drive filenames/folders
  const { data: profileRow, error: profileErr } = await supabase
    .from("client_profiles")
    .select("first_name, middle_name, last_name, drive_parent_folder_id")
    .eq("user_id", c.user_id)
    .maybeSingle();

  if (profileErr) {
    logPostgrestError(
      "[activateApplication] load client profile error:",
      profileErr,
    );
    // Non-fatal: fallback name below
  }

  const clientName = (() => {
    const parts = [
      profileRow?.first_name,
      profileRow?.middle_name,
      profileRow?.last_name,
    ].filter((x) => typeof x === "string" && x.trim().length > 0) as string[];

    const joined = parts.join(" ").trim();
    return joined.length > 0 ? joined : `Client ${c.user_id}`;
  })();

  // IMPORTANT:
  // We must set drive_* fields at INSERT time (UPDATE is blocked by prevent_drive_fields_update()).
  // So we generate the application id up-front, create Drive folders, then insert.
  const applicationId = randomUUID();

  const visaTypeForDrive = finalTypeRaw.length > 0 ? finalTypeRaw : "unknown";

  let driveParentFolderId: string | null = null;
  let driveApplicationFolderId: string | null = null;

  try {
    const folderRes = await createApplicationDriveFolders({
      userId: c.user_id,
      applicationId,
      clientName,
      destination,
      visaType: visaTypeForDrive,
      existingParentFolderId: profileRow?.drive_parent_folder_id ?? null,
      createdAtIso: new Date().toISOString(),
    });

    driveParentFolderId = folderRes.parentFolderId;
    driveApplicationFolderId = folderRes.applicationFolderId;
  } catch (driveError: any) {
    // eslint-disable-next-line no-console
    console.error("[activateApplication] Drive folder creation failed", {
      caseId,
      userId: c.user_id,
      applicationId,
      message: driveError?.message ?? null,
      code: driveError?.code ?? null,
      status: driveError?.status ?? null,
      details: driveError,
    });

    throw new Error(
      "Failed to create Google Drive folders for this application.",
    );
  }

  // Best-effort: persist parent folder id on profile (so future applications re-use it)
  if (
    driveParentFolderId &&
    driveParentFolderId !== profileRow?.drive_parent_folder_id
  ) {
    const { error: profUpdErr } = await supabase
      .from("client_profiles")
      .update({ drive_parent_folder_id: driveParentFolderId })
      .eq("user_id", c.user_id);

    if (profUpdErr) {
      logPostgrestError(
        "[activateApplication] update profile drive_parent_folder_id error:",
        profUpdErr,
      );
      // Non-fatal
    }
  }

  if (!driveApplicationFolderId) {
    throw new Error("Failed to create Google Drive application folder.");
  }

  const timelineEvent = {
    type: "case_activation",
    occurred_at: new Date().toISOString(),
    case_id: caseId,
  };

  // Create application (include Drive ids at INSERT time)
  const { data: app, error: appErr } = await supabase
    .from("client_applications")
    .insert({
      id: applicationId,
      user_id: c.user_id,
      case_id: caseId,
      application_type: finalTypeRaw.length > 0 ? finalTypeRaw : "unknown",
      destination,
      drive_parent_folder_id: driveParentFolderId,
      drive_application_folder_id: driveApplicationFolderId,
      //timeline: [timelineEvent],
    })
    .select("id")
    .single();

  if (appErr) {
    logPostgrestError(
      "[activateApplication] create application error:",
      appErr,
    );
    throw new Error("Failed to create application.");
  }

  // Create requirements
  if (validPlanned.length > 0) {
    const reqPayload = validPlanned.map((id) => ({
      application_id: applicationId,
      document_type_id: id,
      required: true,
    }));

    const { error: reqInsErr } = await supabase
      .from("client_application_requirements")
      .insert(reqPayload);

    if (reqInsErr) {
      logPostgrestError(
        "[activateApplication] insert requirements error:",
        reqInsErr,
      );
      throw new Error("Failed to create requirements.");
    }
  }

  // Link case -> application + advance status
  const { error: caseUpdateErr } = await supabase
    .from("client_cases")
    .update({
      application_id: applicationId,
      status: "application_activated",
      updated_at: new Date().toISOString(),
    })
    .eq("id", caseId);

  if (caseUpdateErr) {
    logPostgrestError(
      "[activateApplication] update case error:",
      caseUpdateErr,
    );
    throw new Error("Failed to link case to application.");
  }

  redirect(
    buildCaseDetailsUrl({
      locale,
      caseId,
      params: { saved: "activation", status: "application_activated" },
      openPanel: "activation",
    }),
  );
}

// ─────────────────────────────────────────────
// Server action: Override close case (any stage)
// Contract:
// - allowed at ANY stage (including after activation)
// - if already closed: no-op redirect
// - always requires explicit confirmation on the client (via GuardedSubmitButton diff trigger)
// - idempotent: if already closed, just redirect as "saved"
// ─────────────────────────────────────────────

async function closeCaseOverride(formData: FormData) {
  "use server";

  await assertAdminOrConsultantOrNotFound();
  const locale = await getLocale();

  const supabase = getAdminSupabase();
  const caseId = formData.get("caseId");

  if (typeof caseId !== "string") throw new Error("Invalid payload.");

  const { data: currentCase, error: fetchError } = await supabase
    .from("client_cases")
    .select("id,status")
    .eq("id", caseId)
    .maybeSingle();

  if (fetchError) {
    logPostgrestError("[closeCaseOverride] fetch case error:", fetchError);
    throw new Error("Failed to load case.");
  }
  if (!currentCase) notFound();

  const status = normalizeCaseStatus(currentCase.status);

  if (status === "closed") {
    redirect(
      buildCaseDetailsUrl({
        locale,
        caseId,
        params: { saved: "close_case", status: "closed" },
        openPanel: "timeline",
      }),
    );
  }

  const { error: updateError } = await supabase
    .from("client_cases")
    .update({ status: "closed", updated_at: new Date().toISOString() })
    .eq("id", caseId);

  if (updateError) {
    logPostgrestError("[closeCaseOverride] update error:", updateError);
    throw new Error("Failed to close case.");
  }

  revalidatePath(`/${locale}${siteConfig.adminCaseDetailsPath(caseId)}`);
  revalidatePath(`/${locale}${siteConfig.adminCasesPath}`);

  redirect(
    buildCaseDetailsUrl({
      locale,
      caseId,
      params: { saved: "close_case", status: "closed" },
      openPanel: "timeline",
    }),
  );
}

function normalizeEmbeddedOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value.length > 0 ? value[0] : null;
  return value;
}

export default async function AdminCaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();

  const resolvedParams = await params;

  const caseId =
    typeof resolvedParams?.id === "string" ? resolvedParams.id.trim() : "";

  if (!caseId || caseId === "undefined" || !isUuid(caseId)) {
    notFound();
  }

  const sp = searchParams ? await searchParams : {};

  const locale = await getLocale();
  await assertAdminOrConsultantOrNotFound();

  const supabase = getAdminSupabase();

  const t = await getTranslations("AdminCases");
  const tDocTypes = await getTranslations("DocumentTypes");
  const tGlobal = await getTranslations("GlobalForm");
  const tWizard = await getTranslations("AdminStatusStepWizard");

  const na = tGlobal("Common.dates.na");

  function normalizeId(v: unknown) {
    return typeof v === "string" ? v.trim() : "";
  }

  function tDestinationFromId(v: unknown) {
    const id = normalizeId(v);
    if (!id) return na;
    return tGlobal(`destinations.${id}` as any);
  }

  function getStageHintFromCaseStatus(status: string) {
    if (status === "intake_submitted")
      return tGlobal("preview.case.intakeSubmitted");
    if (status === "consultation_requested")
      return tGlobal("preview.case.consultationRequested");
    if (status === "consultation_booked")
      return tGlobal("preview.case.consultationBooked");
    if (status === "consultation_completed")
      return tGlobal("preview.case.consultationCompleted");
    if (status === "plan_created") return tGlobal("preview.case.planCreated");
    if (status === "requirements_added") return tGlobal("preview.case.default");
    if (status === "application_activated")
      return tGlobal("preview.case.default");
    if (status === "finished") return tGlobal("preview.case.finished");
    if (status === "closed") return tGlobal("preview.case.closed");

    return tGlobal("preview.case.default");
  }

  function getActivationHintFromCase(
    c: CaseRow,
    app: ApplicationRow | null,
    caseStatus: string,
  ) {
    // Closed/finished should short-circuit.
    if (caseStatus === "closed") return tGlobal("preview.case.closed");
    if (caseStatus === "finished") return tGlobal("preview.case.finished");

    // If we have an application, we can show a more accurate app-driven hint (optional).
    if (c.application_id && app) {
      if (app.application_status === "finished")
        return tGlobal("preview.app.finished");
      return tGlobal("preview.app.default");
    }

    // Otherwise keep it case-driven (reuse your existing mapping)
    return getStageHintFromCaseStatus(caseStatus);
  }

  function tVisaTypeFromId(v: unknown) {
    const id = normalizeId(v);
    if (!id) return na;
    return tGlobal(`visaTypes.${id}` as any);
  }

  const arrowLabel = tGlobal("Common.symbols.arrowRight");
  const chevronLabel = tGlobal("Common.symbols.chevronDown");
  const savingLabel = tGlobal("Common.actions.saving");

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

  const { data: caseRow, error: caseErr } = await supabase
    .from("client_cases")
    .select(
      `
		id,
		user_id,
		status,
		intake_json,
		draft_recommendation,
		final_application_type,
		plan_notes,
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
			date_of_birth,
			citizenship_country,
			city_country,
			marital_status,
			phone_country_code,
			phone_number,
			whatsapp_country_code,
			whatsapp_number,
			preferred_contact_method,
			preferred_contact_time,
			contact_email,
			telegram_username,
			whatsapp_e164,
			family_composition,
			income_over_2000,
			income_source,
			been_to_sa,
			first_entry_sa,
			current_location,
			current_visa_status,
			visa_refusals,
			visa_refusals_details,
			passport_expiry,
			visit_purpose,
			immigration_goal,
			english_level,
			need_language_school
		)
		`,
    )
    .eq("id", caseId)
    .maybeSingle();

  if (caseErr) {
    logPostgrestError("[AdminCaseDetail] load case error:", caseErr);
    notFound();
  }
  if (!caseRow) notFound();

  const c = caseRow as CaseRow;

  const profile = (() => {
    const raw = c.client_profiles;

    // PostgREST can return either object (1:1) or array (1:many)
    if (Array.isArray(raw)) return raw.length > 0 ? raw[0] : null;
    return raw ?? null;
  })();

  // Normalize once, use everywhere below
  const caseStatus = normalizeCaseStatus(c.status);

  const intakeDestinationLabel = tDestinationFromId(c.intake_json?.destination);
  const intakeVisaTypeLabel = tVisaTypeFromId(
    c.intake_json?.visaType ?? c.intake_json?.visa_type,
  );

  // ─────────────────────────────────────────────
  // Consultation channel label + CTA gating (admin)
  // ─────────────────────────────────────────────

  const isConsultationBooked = caseStatus === CASE_STATUS.CONSULTATION_BOOKED;

  const consultationLink =
    typeof c.consultation_link === "string" ? c.consultation_link.trim() : "";

  const consultationChannelIdRaw = normalizeConsultationChannel(
    c.consultation_channel,
  );

  const consultationChannelLabel =
    consultationChannelIdRaw.length > 0
      ? tGlobal(
          `consultation_channel.channels.${consultationChannelIdRaw}` as any,
        )
      : na;

  const showConsultationLinkCta =
    isConsultationBooked && consultationLink.length > 0;

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
  };

  const { data: visaTypesRows, error: vtErr } = await supabase
    .from("visa_types")
    .select("id,name_key,parent_id,kind,jurisdiction,sort_order")
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (vtErr)
    logPostgrestError("[AdminCaseDetail] load visa_types error:", vtErr);

  const visaTypes = (visaTypesRows ?? []) as VisaTypeRow[];

  const childrenByParent = new Map<string, VisaTypeRow[]>();
  for (const v of visaTypes) {
    if (!v.parent_id) continue;
    const arr = childrenByParent.get(v.parent_id) ?? [];
    arr.push(v);
    childrenByParent.set(v.parent_id, arr);
  }

  for (const arr of childrenByParent.values()) {
    arr.sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id),
    );
  }

  const topLevel = visaTypes
    .filter((v) => !v.parent_id)
    .sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id),
    );

  // Document types (for requirements editor)
  const { data: documentTypes, error: dtErr } = await supabase
    .from("document_types")
    .select("id, name_key, priority, required")
    .order("priority", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (dtErr)
    logPostgrestError("[AdminCaseDetail] load document_types error:", dtErr);

  const docTypes = (documentTypes ?? []) as DocumentTypeRow[];

  // Load application if activated
  let app: ApplicationRow | null = null;
  let reqs: RequirementRow[] = [];
  let requiredDocIds: string[] = [];
  let docsProgress: ReturnType<typeof computeRequiredDocsProgress> | null =
    null;

  if (c.application_id) {
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
          created_at,
          updated_at
        `,
      )
      .eq("id", c.application_id)
      .maybeSingle();

    if (appErr)
      logPostgrestError("[AdminCaseDetail] load application error:", appErr);
    if (appRow) app = appRow as ApplicationRow;

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
      .eq("application_id", c.application_id)
      .order("document_type_id", { ascending: true });

    if (reqErr)
      logPostgrestError("[AdminCaseDetail] load requirements error:", reqErr);

    const reqsDb = (reqRows ?? []) as RequirementRowDb[];

    reqs = reqsDb.map((r): RequirementRow => {
      const dt = normalizeEmbeddedOne(r.document_types);

      return {
        application_id:
          typeof r.application_id === "string"
            ? r.application_id
            : String(r.application_id ?? ""),
        document_type_id:
          typeof r.document_type_id === "string"
            ? r.document_type_id
            : String(r.document_type_id ?? ""),
        required: Boolean(r.required),
        document_types: dt
          ? {
              id:
                typeof (dt as any).id === "string"
                  ? (dt as any).id
                  : String((dt as any).id ?? ""),
              name_key:
                typeof (dt as any).name_key === "string"
                  ? (dt as any).name_key
                  : String((dt as any).name_key ?? ""),
            }
          : null,
      };
    });

    requiredDocIds = reqs.map((r) => r.document_type_id);

    const { data: docRows, error: docsErr } = await supabase
      .from("client_documents")
      .select(
        "id, application_id, document_type_id, status, copy_number, uploaded_at",
      )
      .eq("application_id", c.application_id)
      .order("document_type_id", { ascending: true })
      .order("copy_number", { ascending: false })
      .order("uploaded_at", { ascending: false });

    if (docsErr)
      logPostgrestError("[AdminCaseDetail] load documents error:", docsErr);
    const docs = (docRows ?? []) as DocumentRow[];

    docsProgress = computeRequiredDocsProgress(requiredDocIds, docs);
  }

  const plannedRequirements = normalizePlannedRequirements(c.intake_json);
  const hasPlannedSelections = plannedRequirements.length > 0;
  const hasPersistedSelections = requiredDocIds.length > 0;
  const hasAnySelections = c.application_id
    ? hasPersistedSelections
    : hasPlannedSelections;

  const plannedIds = new Set(plannedRequirements);
  const persistedIds = new Set(requiredDocIds);

  const fullName = (() => {
    const p = profile;
    if (!p) return tGlobal("header.unknownClient");
    const parts = [p.first_name, p.middle_name, p.last_name].filter(
      (x) => typeof x === "string" && x.trim().length > 0,
    );
    return parts.join(" ").trim() || tGlobal("header.unknownClient");
  })();

  const phone = (() => {
    const p = profile;
    if (!p) return null;
    if (!p.phone_number) return null;
    const cc = p.phone_country_code ? p.phone_country_code.trim() : "";
    return `${cc} ${p.phone_number}`.trim();
  })();

  const whatsapp = (() => {
    const p = profile;
    if (!p) return null;
    if (!p.whatsapp_number) return null;
    const cc = p.whatsapp_country_code ? p.whatsapp_country_code.trim() : "";
    return `${cc} ${p.whatsapp_number}`.trim();
  })();

  const clickToContact = buildClickToContact(profile);

  const clickToContactMethodLabel =
    clickToContact?.method === "email"
      ? t("consultation.clickToContact.methods.email")
      : clickToContact?.method === "whatsapp"
        ? t("consultation.clickToContact.methods.whatsapp")
        : clickToContact?.method === "telegram"
          ? t("consultation.clickToContact.methods.telegram")
          : "";

  const contactLinks = buildContactLinks(profile);

  function methodLabel(method: ContactMethod) {
    return t(`consultation.clickToContact.methods.${method}` as any);
  }

  const createdAt = safeIsoToDate(c.created_at);
  const updatedAt = safeIsoToDate(c.updated_at);

  const caseMeta = getCaseStatusMeta(caseStatus);
  const appMeta = app ? getApplicationStatusMeta(app.application_status) : null;
  const docUiMeta = app ? getDocumentUiMeta(app.document_status as any) : null;

  const openParam = typeof sp.open === "string" ? sp.open : "";

  type PanelKey =
    | "intake"
    | "consultation"
    | "plan"
    | "requirements"
    | "activation"
    | "timeline";

  // ─────────────────────────────────────────────
  // Single-source UI gating
  // ─────────────────────────────────────────────
  const rank = rankOf(caseStatus);
  const isClosed =
    caseStatus === CASE_STATUS.CLOSED || caseStatus === CASE_STATUS.FINISHED;

  const isActivated =
    Boolean(c.application_id) || rank >= CASE_STATUS_RANK.application_activated;

  const consultationEnabled =
    !isClosed && rank >= CASE_STATUS_RANK.intake_submitted;
  const planEnabled =
    !isClosed && rank >= CASE_STATUS_RANK.consultation_completed;
  const requirementsEnabled =
    !isClosed && rank >= CASE_STATUS_RANK.plan_created;

  const requirementsSelected = c.application_id
    ? requiredDocIds.length > 0
    : plannedRequirements.length > 0;

  const reachedConsultationCompleted =
    rank >= CASE_STATUS_RANK.consultation_completed;
  const reachedPlanCreated = rank >= CASE_STATUS_RANK.plan_created;
  const reachedRequirementsSelected = requirementsSelected;

  const activationEnabled =
    !isClosed &&
    !c.application_id &&
    rank >= CASE_STATUS_RANK.plan_created &&
    typeof c.final_application_type === "string" &&
    c.final_application_type.trim().length > 0 &&
    reachedRequirementsSelected;

  const defaultOpenPanel: PanelKey = (() => {
    if (isClosed) return "timeline";
    if (caseStatus === "draft_intake" || caseStatus === "intake_submitted")
      return "intake";
    if (
      caseStatus === "consultation_requested" ||
      caseStatus === "consultation_booked"
    )
      return "consultation";
    if (caseStatus === "consultation_completed") return "plan";

    if (caseStatus === "plan_created") {
      const hasFinalType =
        typeof c.final_application_type === "string" &&
        c.final_application_type.trim().length > 0;
      if (hasFinalType && requirementsSelected) return "activation";
      return "requirements";
    }

    if (caseStatus === "requirements_added") return "activation";
    if (caseStatus === "application_activated" || Boolean(c.application_id))
      return "activation";

    return "consultation";
  })();

  // Workflow panels are status/readiness-driven. The timeline remains an explicit
  // secondary view so existing history links continue to work.
  const allowedOpenPanels: PanelKey[] = [
    "intake",
    "consultation",
    "plan",
    "requirements",
    "activation",
    "timeline",
  ];
  const effectiveOpenPanel: PanelKey = allowedOpenPanels.includes(
    openParam as PanelKey,
  )
    ? (openParam as PanelKey)
    : defaultOpenPanel;
  const wizardActiveStep =
    effectiveOpenPanel === "timeline"
      ? getCaseWizardStepKey(caseStatus)
      : effectiveOpenPanel;

  function toDatetimeLocalValue(iso: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  // Export rows (factsheet)
  const exportRows = [
    { label: tGlobal("Sections.caseDetails"), value: "" },

    { label: tGlobal("Export.Case.id"), value: c.id },
    { label: tGlobal("Export.Case.userId"), value: c.user_id },
    {
      label: tGlobal("Export.Case.status"),
      value: tGlobal(`Statuses.cases.${caseStatus}`),
    },
    {
      label: tGlobal("Export.Case.createdAt"),
      value: createdAt ? fmtWithTime.format(createdAt) : "",
    },
    {
      label: tGlobal("Export.Case.updatedAt"),
      value: updatedAt ? fmtWithTime.format(updatedAt) : "",
    },

    {
      label: tGlobal("Export.Intake.destination"),
      value: intakeDestinationLabel,
    },
    { label: tGlobal("Export.Intake.visaType"), value: intakeVisaTypeLabel },
    {
      label: tGlobal("Export.Intake.timeframe"),
      value:
        typeof c.intake_json?.timeframe === "string"
          ? c.intake_json.timeframe
          : "",
    },
    {
      label: tGlobal("Export.Intake.extraNotes"),
      value:
        typeof c.intake_json?.extraNotes === "string"
          ? c.intake_json.extraNotes
          : "",
    },

    {
      label: tGlobal("Export.Consultation.channel"),
      value: c.consultation_channel ?? "",
    },
    {
      label: tGlobal("Export.Consultation.requestedAt"),
      value: c.consultation_requested_at
        ? fmtWithTime.format(new Date(c.consultation_requested_at))
        : "",
    },
    {
      label: tGlobal("Export.Consultation.scheduledFor"),
      value: c.consultation_scheduled_for
        ? fmtWithTime.format(new Date(c.consultation_scheduled_for))
        : "",
    },
    {
      label: tGlobal("Export.Consultation.link"),
      value: c.consultation_link ?? "",
    },

    {
      label: tGlobal("Export.Plan.finalApplicationType"),
      value: (() => {
        const idRaw =
          typeof c.final_application_type === "string"
            ? c.final_application_type.trim()
            : "";
        if (!idRaw) return "";
        const row = visaTypes.find((v) => v.id === idRaw) ?? null;
        if (!row) return "";
        return tGlobal(`visaTypes.${row.name_key}`);
      })(),
    },
    { label: tGlobal("Export.Plan.planNotes"), value: c.plan_notes ?? "" },
    {
      label: tGlobal("Export.Plan.consultantNote"),
      value: c.consultant_note ?? "",
    },

    { label: tGlobal("Sections.profileDetails"), value: "" },

    { label: tGlobal("Export.Profile.userId"), value: c.user_id },
    {
      label: tGlobal("Export.Profile.firstName"),
      value: profile?.first_name ?? "",
    },
    {
      label: tGlobal("Export.Profile.middleName"),
      value: profile?.middle_name ?? "",
    },
    {
      label: tGlobal("Export.Profile.lastName"),
      value: profile?.last_name ?? "",
    },

    {
      label: tGlobal("Export.Profile.citizenshipCountry"),
      value: profile?.citizenship_country ?? "",
    },
    {
      label: tGlobal("Export.Profile.dateOfBirth"),
      value: profile?.date_of_birth ?? "",
    },

    {
      label: tGlobal("Export.Profile.currentLocation"),
      value: profile?.current_location ?? "",
    },
    {
      label: tGlobal("Export.Profile.currentVisaStatus"),
      value: profile?.current_visa_status ?? "",
    },
    {
      label: tGlobal("Export.Profile.passportExpiry"),
      value: profile?.passport_expiry ?? "",
    },

    {
      label: tGlobal("Export.Profile.phoneCountryCode"),
      value: profile?.phone_country_code ?? "",
    },
    {
      label: tGlobal("Export.Profile.phoneNumber"),
      value: profile?.phone_number ?? "",
    },

    {
      label: tGlobal("Export.Profile.whatsappCountryCode"),
      value: profile?.whatsapp_country_code ?? "",
    },
    {
      label: tGlobal("Export.Profile.whatsappNumber"),
      value: profile?.whatsapp_number ?? "",
    },

    {
      label: tGlobal("Export.Profile.visitPurpose"),
      value: profile?.visit_purpose ?? "",
    },
    {
      label: tGlobal("Export.Profile.beenToSa"),
      value: profile?.been_to_sa ?? "",
    },
    {
      label: tGlobal("Export.Profile.firstEntrySa"),
      value: profile?.first_entry_sa ?? "",
    },
    {
      label: tGlobal("Export.Profile.visaRefusals"),
      value: profile?.visa_refusals ?? "",
    },

    {
      label: tGlobal("Export.Profile.englishLevel"),
      value: profile?.english_level ?? "",
    },
    {
      label: tGlobal("Export.Profile.needLanguageSchool"),
      value: profile?.need_language_school ?? "",
    },

    {
      label: tGlobal("Export.Profile.incomeOver2000"),
      value: profile?.income_over_2000 ?? "",
    },
    {
      label: tGlobal("Export.Profile.incomeSource"),
      value: profile?.income_source ?? "",
    },
    {
      label: tGlobal("Export.Profile.familyComposition"),
      value: profile?.family_composition ?? "",
    },
  ];

  function docTypeKey(dt: { name_key?: string | null; id: string }) {
    const k = (dt.name_key ?? "").trim();
    return k.length > 0 ? k : dt.id;
  }

  // Timeline normalized events
  const caseEvents = normalizeTimelineEvents((c as any).timeline);
  const appEvents = normalizeTimelineEvents(app?.timeline);

  const timelineEvents = [...caseEvents, ...appEvents].sort(
    (a, b) =>
      new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );

  // Locks (explicit)
  const consultationStatusLocked =
    isActivated || rank >= CASE_STATUS_RANK.consultation_completed;
  const planLockWhen =
    !isClosed && (isActivated || rank > CASE_STATUS_RANK.plan_created);
  const requirementsLockWhen =
    !isClosed && (isActivated || rank > CASE_STATUS_RANK.requirements_added);

  return (
    <PageShell>
      <header className="hero-shell">
        <div className="hero-inner">
          <p className="hero-title">{t("hero.title")}</p>
          <h1 className="hero-subtitle">{t("hero.subtitle")}</h1>
        </div>
      </header>

      <MainColumn>
        <div className={styles.formInline}>
          <Link
            href={siteConfig.adminCasesHref}
            className="button button-ghost"
          >
            <span aria-hidden="true">
              {tGlobal("Common.symbols.arrowLeft")}
            </span>
            {tGlobal("header.actions.backToCases")}
          </Link>
        </div>
        {/* ─────────────────────── Identity cards ─────────────────────── */}
        <IdentityCards
          ariaLabel={t("header.title")}
          actions={
            <>
              <Link
                href={siteConfig.adminClientProfileDetailsHref(c.user_id)}
                className="button button-secondary"
              >
                {tGlobal("header.actions.openProfile")}
                <span className={styles.arrow} aria-hidden="true">
                  {arrowLabel}
                </span>
              </Link>

              {c.application_id ? (
                <Link
                  href={siteConfig.adminApplicationDetailsHref(
                    c.application_id,
                  )}
                  className="button button-secondary"
                >
                  {tGlobal("header.actions.openApplication")}
                  <span className={styles.arrow} aria-hidden="true">
                    {arrowLabel}
                  </span>
                </Link>
              ) : null}

              {/* Close case override (danger) */}
              {!isClosed && !c.application_id ? (
                <>
                  <form
                    id="close-case-form"
                    action={closeCaseOverride}
                    className={styles.formInline}
                  >
                    <input type="hidden" name="caseId" value={c.id} />
                    <input type="hidden" name="locale" value={locale} />
                  </form>

                  <ConfirmSubmitButton
                    formId="close-case-form"
                    className="button button-danger"
                    label={t("actions.closeCase")}
                    pendingLabel={tGlobal("Common.actions.saving")}
                    arrowLabel={arrowLabel}
                    arrowClassName={styles.arrow}
                    confirmTitle={tGlobal("Confirm.title")}
                    confirmBody={t("closeCase.confirmBody")}
                    confirmCancelLabel={tGlobal("Confirm.cancel")}
                    confirmContinueLabel={tGlobal("Confirm.continue")}
                    confirmCancelClassName="button button-secondary"
                    confirmContinueClassName="button button-danger"
                  />
                </>
              ) : null}
            </>
          }
        >
          <IdentityCard>
            <IdentityLabel>{t("header.client")}</IdentityLabel>
            <IdentityValue>{fullName}</IdentityValue>
            {contactLinks.length > 0 ? (
              <IdentityMeta>
                <span className="form-label">
                  {t("header.clickToContactLabel")}
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
                      {t("consultation.clickToContact.action", {
                        method: methodLabel(l.method),
                      })}
                      <span className={styles.arrow} aria-hidden="true">
                        {arrowLabel}
                      </span>
                    </a>
                  ))}
                </div>
              </IdentityMeta>
            ) : null}
          </IdentityCard>

          <IdentityCard>
            <IdentityLabel>{t("header.case")}</IdentityLabel>
            <IdentityMono>{c.id}</IdentityMono>

            <IdentityBadgeRow>
              <span className={`badge ${caseMeta.badgeTone}`}>
                <span>{tGlobal(`Statuses.cases.${caseMeta.labelKey}`)}</span>
              </span>
            </IdentityBadgeRow>

            {showConsultationLinkCta ? (
              <div className={styles.formInline}>
                <a
                  className="button button-secondary"
                  href={consultationLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {tGlobal("consultation_channel.channelCta" as any, {
                    value: c.consultation_channel
                      ? tGlobal(
                          `consultation_channel.channels.${c.consultation_channel}` as any,
                        )
                      : na,
                  })}
                  <span className={styles.arrow} aria-hidden="true">
                    {arrowLabel}
                  </span>
                </a>
              </div>
            ) : null}

            <IdentityMeta>
              {tGlobal("CaseRow.created")}{" "}
              {createdAt ? fmtShort.format(createdAt) : na}
            </IdentityMeta>
            <IdentityMeta>
              {tGlobal("CaseRow.updated")}{" "}
              {updatedAt ? fmtShort.format(updatedAt) : na}
            </IdentityMeta>
          </IdentityCard>

          <IdentityCard>
            <IdentityLabel>{t("header.application")}</IdentityLabel>

            {c.application_id && app ? (
              <>
                <IdentityMono>{app.id}</IdentityMono>

                <IdentityBadgeRow>
                  {appMeta ? (
                    <div>
                      <span className="form-label">
                        {t("header.applicationBadgeLabels.applicationStatus")}
                      </span>
                      <span className={`badge ${appMeta.badgeTone}`}>
                        <span>
                          {tGlobal(`Statuses.applications.${appMeta.labelKey}`)}
                        </span>
                      </span>
                    </div>
                  ) : null}

                  {docUiMeta ? (
                    <div>
                      <span className="form-label">
                        {t("header.applicationBadgeLabels.documentStatus")}
                      </span>
                      <span className={`badge ${docUiMeta.badgeTone}`}>
                        <span>
                          {tGlobal(`Statuses.documents.${docUiMeta.id}`)}
                        </span>
                      </span>
                    </div>
                  ) : null}
                </IdentityBadgeRow>

                {docsProgress ? (
                  <IdentityMeta>
                    {tGlobal("ApplicationRow.docsSummary", {
                      uploaded: docsProgress.uploadedCount,
                      required: docsProgress.requiredCount,
                      approved: docsProgress.approvedCount,
                    })}
                  </IdentityMeta>
                ) : null}
              </>
            ) : (
              <>
                <IdentityMeta>{t("header.noApplicationYet")}</IdentityMeta>
                <IdentityMeta>{t("header.activationHint")}</IdentityMeta>
              </>
            )}
          </IdentityCard>
        </IdentityCards>

        {/* ─────────────────────── Intake summary ─────────────────────── */}
        {(effectiveOpenPanel !== "timeline" ||
          caseStatus === CASE_STATUS.CLOSED ||
          caseStatus === CASE_STATUS.FINISHED) && (
          <StatusStepWizard
            ariaLabel={t("header.title")}
            activeStep={wizardActiveStep}
            completedSteps={getCaseCompletedStepKeys(caseStatus)}
            formatEyebrow={(current, total) =>
              tWizard("eyebrow", { current, total })
            }
            formatStepLabel={(number, label) =>
              tWizard("stepLabel", { number, label })
            }
            stepsNavSuffix={tWizard("stepsNavSuffix")}
            steps={
              caseStatus === CASE_STATUS.CLOSED ||
              caseStatus === CASE_STATUS.FINISHED
                ? [
                    {
                      key: caseStatus,
                      label: tGlobal(`Statuses.cases.${caseStatus}`),
                    },
                  ]
                : [
                    {
                      key: "intake",
                      label: t("intake.title"),
                      href: "?open=intake#application-wizard",
                    },
                    {
                      key: "consultation",
                      label: t("consultation.title"),
                      href: "?open=consultation#application-wizard",
                    },
                    {
                      key: "plan",
                      label: t("plan.title"),
                      href: "?open=plan#application-wizard",
                    },
                    {
                      key: "requirements",
                      label: t("requirements.title"),
                      href: "?open=requirements#application-wizard",
                    },
                    {
                      key: "activation",
                      label: t("activation.title"),
                      href: "?open=activation#application-wizard",
                    },
                  ]
            }
          >
            {effectiveOpenPanel === "intake" && (
              <DisclosurePanel
                id="panel-intake"
                title={t("intake.title")}
                subtitle={t("intake.subtitle")}
                defaultOpen={effectiveOpenPanel === "intake"}
                chevronLabel={chevronLabel}
              >
                <div className={styles.twoCol}>
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
                          {typeof c.intake_json?.timeframe === "string"
                            ? c.intake_json.timeframe
                            : na}
                        </p>
                      </div>

                      <div>
                        <p className="form-label" style={{ margin: 0 }}>
                          {t("intake.fields.extraNotes")}
                        </p>
                        <p className="text-md text-bold" style={{ margin: 0 }}>
                          {typeof c.intake_json?.extraNotes === "string"
                            ? c.intake_json.extraNotes
                            : na}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={`surface-soft ${styles.cardBlock}`}>
                    <p className="form-label" style={{ margin: 0 }}>
                      {t("intake.draftRecommendation")}
                    </p>
                    <p className="text-sm text-muted" style={{ margin: 0 }}>
                      {t("intake.subtitle")}
                    </p>

                    <div className={styles.formInline}>
                      <ExportCaseDetailsButton
                        fileBaseName={`case_details_${c.id}`}
                        title={t("intake.title")}
                        rows={exportRows}
                        labels={{
                          trigger: tGlobal("Export.Actions.downloadFactsheet"),
                          exporting: tGlobal("Export.Actions.exporting"),
                          menuLabel: tGlobal("Export.Actions.exportFormat"),
                          pdf: tGlobal("Export.Actions.pdf"),
                          docx: tGlobal("Export.Actions.docx"),
                        }}
                        buttonClassName="button button-primary"
                        secondaryButtonClassName="button button-secondary"
                        dropdownClassName={styles.exportDropdown}
                      />
                    </div>
                  </div>
                </div>
                {(caseStatus === CASE_STATUS.DRAFT_INTAKE ||
                  caseStatus === CASE_STATUS.INTAKE_SUBMITTED) && (
                  <form
                    action={advanceCaseFromIntake}
                    className={styles.formInline}
                  >
                    <input type="hidden" name="caseId" value={c.id} />
                    <input type="hidden" name="locale" value={locale} />
                    <button type="submit" className="button button-primary">
                      {tGlobal("Confirm.continue")}
                      <span className={styles.arrow} aria-hidden="true">
                        {arrowLabel}
                      </span>
                    </button>
                  </form>
                )}
              </DisclosurePanel>
            )}

            {/* ─────────────────────── Consultation ─────────────────────── */}
            {effectiveOpenPanel === "consultation" && (
              <DisclosurePanel
                id="panel-consultation"
                title={t("consultation.title")}
                subtitle={t("consultation.subtitle")}
                disabled={!consultationEnabled}
                defaultOpen={effectiveOpenPanel === "consultation"}
                chevronLabel={chevronLabel}
              >
                {/* ─────────────────────── Click to contact (always visible) ─────────────────────── */}
                <div className={styles.panelStack}>
                  <div className={`surface-soft ${styles.cardBlock}`}>
                    <p className={`form-label ${styles.noMargin}`}>
                      {t("consultation.clickToContact.title")}
                    </p>

                    {contactLinks.length > 0 ? (
                      <>
                        <div className={styles.formInline}>
                          {contactLinks.map((l) => (
                            <a
                              key={l.method}
                              href={l.href}
                              className="button button-secondary"
                              target={l.isExternal ? "_blank" : undefined}
                              rel={
                                l.isExternal ? "noopener noreferrer" : undefined
                              }
                            >
                              <ContactIcon method={l.method} />
                              {t("consultation.clickToContact.action", {
                                method: methodLabel(l.method),
                              })}
                              <span className={styles.arrow} aria-hidden="true">
                                {arrowLabel}
                              </span>
                            </a>
                          ))}
                        </div>

                        <p className={`text-sm text-muted ${styles.noMargin}`}>
                          {t("consultation.clickToContact.providedByClient")}
                        </p>
                      </>
                    ) : (
                      <p className={`text-sm text-muted ${styles.noMargin}`}>
                        {t("consultation.clickToContact.unavailable")}
                      </p>
                    )}
                  </div>

                  {!consultationEnabled ? (
                    <div className={`surface-soft ${styles.cardBlock}`}>
                      <p className={`text-md text-bold ${styles.noMargin}`}>
                        {tGlobal("Statuses.cases.draft_intake")}
                      </p>
                      <p className={`text-sm text-muted ${styles.noMargin}`}>
                        {getStageHintFromCaseStatus(caseStatus)}
                      </p>
                    </div>
                  ) : (
                    (() => {
                      // ── UI locking rules (Consultation only)
                      // - Once consultation is completed or beyond: status + schedule are locked; notes remain editable.
                      // - Once plan is created: consultation progress is locked; notes remain editable.

                      // Local guard so this panel NEVER depends on outer scope variables
                      const lockConsultationProgress =
                        rank >= CASE_STATUS_RANK.plan_created;

                      const consultationStatusLockedLocal =
                        isClosed ||
                        Boolean(c.application_id) ||
                        lockConsultationProgress ||
                        rank >= CASE_STATUS_RANK.consultation_completed;

                      // IMPORTANT:
                      // Do NOT auto-default to "consultation_requested" when the case is still e.g. intake_submitted.
                      // We want the placeholder selected so the user must consciously choose a status (and Save becomes dirty).
                      const consultationStatusValue = (() => {
                        // When progress is locked (plan_created+ / completed+ / activated / closed),
                        // the case status is no longer one of the consultation statuses.
                        // We still want the dropdown to show a meaningful "final consultation milestone".
                        if (consultationStatusLockedLocal) {
                          // When the case is terminal, show the closest terminal option in this dropdown.
                          // "finished" is terminal but not a consultation status; represent it as "consultation_completed".
                          return "consultation_completed";
                        }

                        // When not locked, only show a real consultation status, otherwise force the placeholder.
                        if (
                          caseStatus === "consultation_requested" ||
                          caseStatus === "consultation_booked" ||
                          caseStatus === "consultation_completed"
                        ) {
                          return caseStatus;
                        }

                        return "";
                      })();

                      // Guardrails should still show something sensible even when placeholder is selected.
                      const guardrailsDefault = consultationStatusValue;

                      return (
                        <form
                          id="consultation-form"
                          action={updateConsultationPanel}
                          className={styles.form}
                        >
                          <input type="hidden" name="caseId" value={c.id} />
                          <input type="hidden" name="locale" value={locale} />

                          {/* Lock schedule fields based on the STATUS DROPDOWN value */}
                          <FormFieldLock
                            formId="consultation-form"
                            controllerName="next_case_status"
                            disableWhenValues={[
                              "", // placeholder selected
                              "consultation_requested",
                              //"consultation_booked",
                              "consultation_completed",
                            ]}
                            targetNames={[
                              "consultation_channel",
                              "consultation_scheduled_for",
                              "consultation_link",
                            ]}
                          />

                          <CaseEditGuard
                            caseId={c.id}
                            isActivated={Boolean(c.application_id)}
                            isClosed={isClosed}
                            lockedTitle={t("consultation.locked.title")}
                            lockedBody={t("consultation.locked.body")}
                            unlockLabel={t("actions.unlock")}
                            arrowLabel={arrowLabel}
                            noticeClassName={`surface-soft ${styles.formLockNotice}`}
                            noticeActionsClassName={styles.formLockActions}
                            arrowClassName={styles.arrow}
                            fieldsetLockedClassName={styles.formLocked}
                          >
                            <div className={styles.consultationSections}>
                              <div
                                className={`surface-soft ${styles.cardBlock}`}
                              >
                                <div
                                  className={styles.consultationSectionHeader}
                                >
                                  <p
                                    className={`form-label ${styles.noMargin}`}
                                  >
                                    {t("consultation.sections.progressTitle")}
                                  </p>
                                  <p
                                    className={`text-sm text-muted ${styles.noMargin}`}
                                  >
                                    {t("consultation.sections.progressHelp")}
                                  </p>
                                </div>

                                <div className={styles.consultationSectionGrid}>
                                  <label className={styles.field}>
                                    <span className="form-label">
                                      {t("consultation.fields.transition")}
                                    </span>

                                    <select
                                      className="form-control"
                                      name="next_case_status"
                                      defaultValue={consultationStatusValue}
                                      disabled={consultationStatusLockedLocal}
                                    >
                                      <option value="">
                                        {t(
                                          "consultation.transitions.selectStatus",
                                        )}
                                      </option>

                                      <option value="consultation_requested">
                                        {tGlobal(
                                          "Statuses.cases.consultation_requested",
                                        )}
                                      </option>
                                      <option value="consultation_booked">
                                        {tGlobal(
                                          "Statuses.cases.consultation_booked",
                                        )}
                                      </option>
                                      <option value="consultation_completed">
                                        {tGlobal(
                                          "Statuses.cases.consultation_completed",
                                        )}
                                      </option>
                                    </select>
                                  </label>
                                </div>

                                <ConsultationGuardrails
                                  formId="consultation-form"
                                  fieldName="next_case_status"
                                  defaultValue={guardrailsDefault}
                                  ariaLabel={t("consultation.guardrails.title")}
                                  titleLabel={t(
                                    "consultation.guardrails.title",
                                  )}
                                  requested={{
                                    title: t(
                                      "consultation.guardrails.requestedTitle",
                                    ),
                                    body: t(
                                      "consultation.guardrails.requestedBody",
                                    ),
                                  }}
                                  booked={{
                                    title: t(
                                      "consultation.guardrails.bookedTitle",
                                    ),
                                    items: [
                                      t(
                                        "consultation.guardrails.bookedItemChannel",
                                      ),
                                      t(
                                        "consultation.guardrails.bookedItemDatetime",
                                      ),
                                    ],
                                  }}
                                  completed={{
                                    title: t(
                                      "consultation.guardrails.completedTitle",
                                    ),
                                    body: t(
                                      "consultation.guardrails.completedBody",
                                    ),
                                  }}
                                  className={styles.guardrails}
                                  listClassName={`${styles.guardrailsList} text-sm text-muted`}
                                />
                              </div>

                              <div
                                className={`surface-soft ${styles.cardBlock}`}
                              >
                                <div
                                  className={styles.consultationSectionHeader}
                                >
                                  <p
                                    className={`form-label ${styles.noMargin}`}
                                  >
                                    {t("consultation.sections.scheduleTitle")}
                                  </p>
                                  <p
                                    className={`text-sm text-muted ${styles.noMargin}`}
                                  >
                                    {t("consultation.sections.scheduleHelp")}
                                  </p>
                                </div>

                                <div className={styles.consultationSectionGrid}>
                                  <label className={styles.field}>
                                    <span className="form-label">
                                      {t("consultation.fields.channel")}
                                    </span>

                                    <select
                                      className="form-control"
                                      name="consultation_channel"
                                      data-guard-primary="consultation_channel"
                                      defaultValue={(
                                        c.consultation_channel ?? ""
                                      ).toString()}
                                      disabled={
                                        Boolean(c.application_id) ||
                                        lockConsultationProgress
                                      }
                                    >
                                      <option value="zoom">
                                        {tGlobal(
                                          "consultation_channel.channels.zoom",
                                        )}
                                      </option>
                                      <option value="google_meet">
                                        {tGlobal(
                                          "consultation_channel.channels.google_meet",
                                        )}
                                      </option>
                                      <option value="phone">
                                        {tGlobal(
                                          "consultation_channel.channels.phone",
                                        )}
                                      </option>
                                      <option value="whatsapp">
                                        {tGlobal(
                                          "consultation_channel.channels.whatsapp",
                                        )}
                                      </option>
                                      <option value="telegram">
                                        {tGlobal(
                                          "consultation_channel.channels.telegram",
                                        )}
                                      </option>
                                      <option value="email">
                                        {tGlobal(
                                          "consultation_channel.channels.email",
                                        )}
                                      </option>
                                    </select>

                                    <p
                                      className={`text-sm text-muted ${styles.noMargin}`}
                                    >
                                      {consultationChannelIdRaw.length > 0
                                        ? t("consultation.currentValue", {
                                            value: consultationChannelLabel,
                                          })
                                        : tGlobal("Common.dates.na")}
                                    </p>

                                    <input
                                      type="hidden"
                                      name="consultation_channel"
                                      data-guard-mirror="consultation_channel"
                                      defaultValue={(
                                        c.consultation_channel ?? ""
                                      ).toString()}
                                      disabled
                                    />
                                  </label>

                                  <label className={styles.field}>
                                    <span className="form-label">
                                      {t("consultation.fields.scheduledFor")}
                                    </span>

                                    <input
                                      className="form-control"
                                      type="datetime-local"
                                      name="consultation_scheduled_for"
                                      data-guard-primary="consultation_scheduled_for"
                                      defaultValue={toDatetimeLocalValue(
                                        c.consultation_scheduled_for,
                                      )}
                                      disabled={
                                        Boolean(c.application_id) ||
                                        lockConsultationProgress
                                      }
                                    />

                                    <input
                                      type="hidden"
                                      name="consultation_scheduled_for"
                                      data-guard-mirror="consultation_scheduled_for"
                                      defaultValue={toDatetimeLocalValue(
                                        c.consultation_scheduled_for,
                                      )}
                                      disabled
                                    />

                                    <p
                                      className={`text-sm text-muted ${styles.noMargin}`}
                                    >
                                      {c.consultation_scheduled_for
                                        ? t("consultation.currentValue", {
                                            value: fmtWithTime.format(
                                              new Date(
                                                c.consultation_scheduled_for,
                                              ),
                                            ),
                                          })
                                        : t("consultation.noneScheduled")}
                                    </p>
                                  </label>

                                  <label className={styles.fieldFull}>
                                    <span className="form-label">
                                      {t("consultation.fields.link")}
                                    </span>

                                    <input
                                      className="form-control"
                                      name="consultation_link"
                                      data-guard-primary="consultation_link"
                                      defaultValue={c.consultation_link ?? ""}
                                      placeholder={t(
                                        "consultation.placeholders.link",
                                      )}
                                      disabled={
                                        Boolean(c.application_id) ||
                                        lockConsultationProgress
                                      }
                                    />

                                    <input
                                      type="hidden"
                                      name="consultation_link"
                                      data-guard-mirror="consultation_link"
                                      defaultValue={c.consultation_link ?? ""}
                                      disabled
                                    />

                                    {showConsultationLinkCta ? (
                                      <div className={styles.formInline}>
                                        <a
                                          className="button button-secondary"
                                          href={consultationLink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          {tGlobal(
                                            "consultation_channel.channelCta" as any,
                                            {
                                              value: c.consultation_channel
                                                ? tGlobal(
                                                    `consultation_channel.channels.${c.consultation_channel}` as any,
                                                  )
                                                : na,
                                            },
                                          )}
                                          <span
                                            className={styles.arrow}
                                            aria-hidden="true"
                                          >
                                            {arrowLabel}
                                          </span>
                                        </a>
                                      </div>
                                    ) : null}
                                  </label>
                                </div>
                              </div>

                              {/* NOTES: should remain editable (only Schedule locks visually) */}
                              <div
                                className={`surface-soft ${styles.cardBlock}`}
                              >
                                <div
                                  className={styles.consultationSectionHeader}
                                >
                                  <p
                                    className={`form-label ${styles.noMargin}`}
                                  >
                                    {t("consultation.sections.notesTitle")}
                                  </p>
                                  <p
                                    className={`text-sm text-muted ${styles.noMargin}`}
                                  >
                                    {t("consultation.sections.notesHelp")}
                                  </p>
                                </div>

                                <label className={styles.fieldFull}>
                                  <span className="form-label">
                                    {t("consultation.fields.note")}
                                  </span>

                                  <textarea
                                    className={`form-control form-control-note ${styles.noteTextarea}`}
                                    name="consultant_note"
                                    defaultValue={c.consultant_note ?? ""}
                                    placeholder={t(
                                      "consultation.placeholders.noteExample",
                                    )}
                                    rows={5}
                                  />
                                </label>
                              </div>
                            </div>

                            <div className={styles.formActions}>
                              <GuardedSubmitButton
                                key={`consultation-${c.updated_at}`}
                                formId="consultation-form"
                                requiredFieldNames={[]}
                                conditionalRequired={{
                                  whenFieldName: "next_case_status",
                                  whenValue: "consultation_booked",
                                  requiredFieldNames: [
                                    "consultation_channel",
                                    "consultation_scheduled_for",
                                  ],
                                }}
                                lockUntilDirty
                                className="button button-primary"
                                label={t("actions.saveConsultation")}
                                pendingLabel={savingLabel}
                                arrowLabel={arrowLabel}
                                arrowClassName={styles.arrow}
                                disabled={isClosed}
                                isActivated={Boolean(c.application_id)}
                                isCaseClosed={isClosed}
                                confirmTitle={tGlobal("Confirm.title")}
                                confirmCancelLabel={tGlobal("Confirm.cancel")}
                                confirmContinueLabel={tGlobal(
                                  "Confirm.continue",
                                )}
                                confirmOnActivatedDirty
                                confirmMessageActivatedDirty={tGlobal(
                                  "Confirm.activeCaseEdit",
                                )}
                                confirmWhenFieldChanged={{
                                  fieldName: "next_case_status",
                                  requireNonEmpty: true,
                                }}
                                confirmMessageFieldChanged={t(
                                  "consultation.confirmStatusUpdate",
                                )}
                                confirmWhenFieldsChanged={{
                                  fieldNames: [
                                    "consultation_channel",
                                    "consultation_scheduled_for",
                                    "consultation_link",
                                  ],
                                  requireNonEmpty: false,
                                  onlyWhenFieldUnchanged: "next_case_status",
                                }}
                                confirmMessageOnFieldsChanged={t(
                                  "consultation.confirmScheduleUpdate",
                                )}
                              />
                            </div>
                          </CaseEditGuard>
                        </form>
                      );
                    })()
                  )}
                </div>
              </DisclosurePanel>
            )}

            {/* ─────────────────────── Plan ─────────────────────── */}
            {effectiveOpenPanel === "plan" && (
              <DisclosurePanel
                id="panel-plan"
                title={t("plan.title")}
                subtitle={t("plan.subtitle")}
                disabled={!planEnabled}
                defaultOpen={effectiveOpenPanel === "plan"}
                chevronLabel={chevronLabel}
              >
                {!planEnabled ? (
                  <div className={`surface-soft ${styles.cardBlock}`}>
                    <p className="text-md text-bold" style={{ margin: 0 }}>
                      {t("plan.title")}
                    </p>
                    <p className="text-sm text-muted" style={{ margin: 0 }}>
                      {getStageHintFromCaseStatus(caseStatus)}
                    </p>
                  </div>
                ) : (
                  <form
                    id="plan-form"
                    action={updatePlanPanel}
                    className={styles.form}
                  >
                    <input type="hidden" name="caseId" value={c.id} />
                    <input type="hidden" name="locale" value={locale} />

                    {(() => {
                      const isActivatedLocal =
                        Boolean(c.application_id) ||
                        rank >= CASE_STATUS_RANK.application_activated;

                      const hasExistingFinalType =
                        typeof c.final_application_type === "string" &&
                        c.final_application_type.trim().length > 0;

                      // Lock everything after activation except client-facing note.
                      // Also lock plan editing after plan is created unless explicitly unlocked.
                      // (planLockWhen should be computed above; we keep it consistent here.)
                      const effectiveLockWhen =
                        planLockWhen || isActivatedLocal;

                      // Confirm only when plan already exists (plan_created+) and final type is being changed.
                      const confirmFinalTypeChange =
                        !isActivatedLocal &&
                        rank >= CASE_STATUS_RANK.plan_created &&
                        hasExistingFinalType;

                      // Only allow selecting visa type after consultation is completed.
                      const finalTypeLockedUntilConsultationCompleted =
                        rank < CASE_STATUS_RANK.consultation_completed;

                      return (
                        <CaseEditGuard
                          caseId={c.id}
                          isActivated={Boolean(c.application_id)}
                          isClosed={isClosed}
                          lockWhen={effectiveLockWhen}
                          storageKeyPrefix="admin_plan_unlock"
                          lockedTitle={t("plan.locked.title")}
                          lockedBody={t("plan.locked.body")}
                          unlockLabel={t("actions.unlock")}
                          arrowLabel={arrowLabel}
                          noticeClassName={`surface-soft ${styles.formLockNotice}`}
                          noticeActionsClassName={styles.formLockActions}
                          arrowClassName={styles.arrow}
                          fieldsetLockedClassName={styles.formLocked}
                        >
                          <div className={styles.formGrid}>
                            <label className={styles.fieldFull}>
                              <span className="form-label">
                                {t("plan.fields.finalApplicationType")}
                              </span>

                              <select
                                className="form-control"
                                name="final_application_type"
                                data-guard-primary="final_application_type"
                                defaultValue={c.final_application_type ?? ""}
                                disabled={
                                  isActivatedLocal ||
                                  finalTypeLockedUntilConsultationCompleted
                                }
                              >
                                {/* Placeholder: forces a conscious choice, but cannot be selected once dropdown opens */}
                                <option value="" disabled>
                                  {t("plan.fields.finalApplicationTypeNone")}
                                </option>

                                {topLevel.map((v) => {
                                  const kids = childrenByParent.get(v.id) ?? [];
                                  const label = tGlobal(
                                    `visaTypes.${v.name_key}`,
                                  );

                                  if (v.kind === "group" || kids.length > 0) {
                                    return (
                                      <optgroup key={v.id} label={label}>
                                        {v.kind !== "group" ? (
                                          <option value={v.id}>{label}</option>
                                        ) : null}

                                        {kids.map((k) => (
                                          <option key={k.id} value={k.id}>
                                            {tGlobal(
                                              `visaTypes.${k.name_key}` as any,
                                            )}
                                          </option>
                                        ))}
                                      </optgroup>
                                    );
                                  }

                                  return (
                                    <option key={v.id} value={v.id}>
                                      {label}
                                    </option>
                                  );
                                })}
                              </select>

                              {/* Mirror baseline so GuardedSubmitButton can diff the value on SAVE */}
                              <input
                                type="hidden"
                                name="final_application_type"
                                data-guard-mirror="final_application_type"
                                defaultValue={c.final_application_type ?? ""}
                                disabled
                              />

                              <p
                                className="text-sm text-muted"
                                style={{ margin: 0 }}
                              >
                                {t("plan.fields.finalApplicationTypeHint")}
                              </p>
                            </label>

                            <label className={styles.fieldFull}>
                              <span className="form-label">
                                {t("plan.fields.planNotes")}
                              </span>
                              <textarea
                                className={`form-control form-control-note ${styles.noteTextarea}`}
                                name="plan_notes"
                                defaultValue={c.plan_notes ?? ""}
                                placeholder={t("plan.placeholders.planNotes")}
                                rows={6}
                                disabled={isActivatedLocal}
                              />
                              {/* Ensure server receives a stable value when disabled */}
                              {isActivatedLocal ? (
                                <input
                                  type="hidden"
                                  name="plan_notes"
                                  value={c.plan_notes ?? ""}
                                />
                              ) : null}
                            </label>

                            {/* Client-facing note: ALWAYS editable after unlock (even when activated) */}
                            <label className={styles.fieldFull}>
                              <span className="form-label">
                                {t("plan.fields.consultantNote")}
                              </span>
                              <textarea
                                className={`form-control form-control-note ${styles.noteTextarea}`}
                                name="consultant_note"
                                defaultValue={c.consultant_note ?? ""}
                                placeholder={t(
                                  "plan.placeholders.consultantNote",
                                )}
                                rows={3}
                              />
                            </label>
                          </div>

                          <div className={styles.formActions}>
                            <GuardedSubmitButton
                              formId="plan-form"
                              requiredFieldNames={[]}
                              lockUntilDirty
                              className="button button-primary"
                              label={t("actions.savePlan")}
                              pendingLabel={savingLabel}
                              arrowClassName={styles.arrow}
                              arrowLabel={arrowLabel}
                              isActivated={Boolean(c.application_id)}
                              isCaseClosed={isClosed}
                              confirmTitle={tGlobal("Confirm.title")}
                              confirmCancelLabel={tGlobal("Confirm.cancel")}
                              confirmContinueLabel={tGlobal("Confirm.continue")}
                              confirmOnActivatedDirty
                              confirmMessageActivatedDirty={tGlobal(
                                "Confirm.activeCaseEdit",
                              )}
                              confirmWhenFieldChanged={
                                confirmFinalTypeChange
                                  ? {
                                      fieldName: "final_application_type",
                                      requireNonEmpty: true,
                                    }
                                  : undefined
                              }
                              confirmMessageFieldChanged={t(
                                "plan.confirmFinalApplicationTypeChange",
                              )}
                            />
                          </div>
                        </CaseEditGuard>
                      );
                    })()}
                  </form>
                )}
              </DisclosurePanel>
            )}

            {/* ─────────────────────── Requirements ─────────────────────── */}
            {effectiveOpenPanel === "requirements" && (
              <DisclosurePanel
                id="panel-requirements"
                title={t("requirements.title")}
                subtitle={
                  c.application_id
                    ? t("requirements.subtitlePost")
                    : t("requirements.subtitlePre")
                }
                disabled={!requirementsEnabled}
                defaultOpen={effectiveOpenPanel === "requirements"}
                chevronLabel={chevronLabel}
              >
                {!requirementsEnabled ? (
                  <div className={`surface-soft ${styles.cardBlock}`}>
                    <p className="text-md text-bold" style={{ margin: 0 }}>
                      {t("requirements.title")}
                    </p>
                    <p className="text-sm text-muted" style={{ margin: 0 }}>
                      {getStageHintFromCaseStatus(caseStatus)}
                    </p>
                  </div>
                ) : (
                  <form
                    id="requirements-form"
                    action={saveRequirements}
                    className={styles.form}
                  >
                    <input type="hidden" name="caseId" value={c.id} />
                    <input type="hidden" name="locale" value={locale} />

                    {(() => {
                      // IMPORTANT:
                      // When there are NO persisted/planned selections yet, the UI still auto-checks "required" docs.
                      // The fingerprint baseline MUST match what is checked by default, otherwise GuardedSubmitButton
                      // will think the user has to "change something" before the form can be saved.
                      const defaultRequiredIds = docTypes
                        .filter((dt) => Boolean(dt.required))
                        .map((dt) => dt.id);

                      const baselineIds = hasAnySelections
                        ? c.application_id
                          ? Array.from(persistedIds)
                          : Array.from(plannedIds)
                        : defaultRequiredIds;

                      const baselineFingerprint = baselineIds
                        .slice()
                        .sort()
                        .join("|");

                      return (
                        <>
                          <input
                            type="hidden"
                            name="requirements_fingerprint"
                            defaultValue={baselineFingerprint}
                          />

                          <CheckboxGroupFingerprint
                            formId="requirements-form"
                            checkboxName="doc"
                            outputName="requirements_fingerprint"
                          />
                        </>
                      );
                    })()}

                    <CaseEditGuard
                      caseId={c.id}
                      isActivated={Boolean(c.application_id)}
                      isClosed={isClosed}
                      lockWhen={requirementsLockWhen}
                      storageKeyPrefix="admin_requirements_unlock"
                      lockedTitle={t("requirements.locked.title")}
                      lockedBody={t("requirements.locked.body")}
                      unlockLabel={t("actions.unlock")}
                      arrowLabel={arrowLabel}
                      noticeClassName={`surface-soft ${styles.formLockNotice}`}
                      noticeActionsClassName={styles.formLockActions}
                      arrowClassName={styles.arrow}
                      fieldsetLockedClassName={styles.formLocked}
                    >
                      <div className={styles.checklist}>
                        {docTypes.map((dt) => {
                          const checked = hasAnySelections
                            ? c.application_id
                              ? persistedIds.has(dt.id)
                              : plannedIds.has(dt.id)
                            : Boolean(dt.required);

                          const key = docTypeKey(dt);
                          const label = tDocTypes(`${key}.label`);
                          const desc = tDocTypes(`${key}.desc`);

                          return (
                            <label
                              key={dt.id}
                              className={`surface-soft ${styles.checkRow}`}
                            >
                              <input
                                type="checkbox"
                                name="doc"
                                value={dt.id}
                                defaultChecked={checked}
                                className={styles.checkbox}
                                disabled={isClosed}
                              />

                              <span className={styles.checkText}>
                                <span className="text-md text-bold">
                                  {label}
                                </span>
                                <span className="text-sm text-muted">
                                  {desc}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>

                      <div className={styles.formActions}>
                        <GuardedSubmitButton
                          key={`requirements-${c.updated_at}`}
                          formId="requirements-form"
                          requiredFieldNames={["doc"]}
                          // ONLY lock on pristine *after* we already have saved selections.
                          // First-time save (with default required ticks) must be allowed.
                          lockUntilDirty={requirementsSelected}
                          className="button button-primary"
                          label={t("actions.saveRequirements")}
                          pendingLabel={savingLabel}
                          arrowClassName={styles.arrow}
                          arrowLabel={arrowLabel}
                          disabled={isClosed}
                          isActivated={Boolean(c.application_id)}
                          isCaseClosed={isClosed}
                          confirmOnActivatedDirty
                          confirmMessageActivatedDirty={tGlobal(
                            "Confirm.activeCaseEdit",
                          )}
                          // Confirm when changing requirements after they were initially set.
                          confirmWhenFieldChanged={
                            requirementsSelected
                              ? {
                                  fieldName: "requirements_fingerprint",
                                  requireNonEmpty: true,
                                }
                              : undefined
                          }
                          confirmMessageFieldChanged={t(
                            "requirements.confirmChange",
                          )}
                          confirmTitle={tGlobal("Confirm.title")}
                          confirmCancelLabel={tGlobal("Confirm.cancel")}
                          confirmContinueLabel={tGlobal("Confirm.continue")}
                        />
                      </div>
                    </CaseEditGuard>
                  </form>
                )}
              </DisclosurePanel>
            )}

            {/* ─────────────────────── Application Activation ─────────────────────── */}
            {effectiveOpenPanel === "activation" && (
              <DisclosurePanel
                id="panel-activation"
                title={t("activation.title")}
                subtitle={t("activation.subtitle")}
                disabled={!activationEnabled}
                defaultOpen={effectiveOpenPanel === "activation"}
                chevronLabel={chevronLabel}
              >
                {c.application_id ? (
                  <div className={`surface-soft ${styles.cardBlock}`}>
                    <p className="text-md text-bold" style={{ margin: 0 }}>
                      {caseStatus === "finished"
                        ? tGlobal("preview.case.finished")
                        : caseStatus === "closed"
                          ? tGlobal("preview.case.closed")
                          : t("activation.alreadyActiveTitle")}
                    </p>
                    <p className="text-sm text-muted" style={{ margin: 0 }}>
                      {getActivationHintFromCase(c, app, caseStatus)}
                    </p>

                    <Link
                      href={siteConfig.adminApplicationDetailsHref(
                        c.application_id,
                      )}
                      className="button button-primary"
                    >
                      {t("activation.openApplication")}
                      <span className={styles.arrow} aria-hidden="true">
                        {arrowLabel}
                      </span>
                    </Link>
                  </div>
                ) : (
                  <div className={`surface-soft ${styles.cardBlock}`}>
                    <p className="text-sm text-muted" style={{ margin: 0 }}>
                      {getActivationHintFromCase(c, app, caseStatus)}
                    </p>

                    <ul className={styles.preconditions}>
                      <li>
                        <span
                          className={`badge ${reachedConsultationCompleted ? SUCCESS : NEUTRAL}`}
                        >
                          <span>
                            {t(
                              "activation.preconditions.consultationCompleted",
                            )}
                          </span>
                        </span>
                      </li>

                      <li>
                        <span
                          className={`badge ${reachedPlanCreated ? SUCCESS : NEUTRAL}`}
                        >
                          <span>
                            {t("activation.preconditions.planCreated")}
                          </span>
                        </span>
                      </li>

                      <li>
                        <span
                          className={`badge ${reachedRequirementsSelected ? SUCCESS : NEUTRAL}`}
                        >
                          <span>
                            {t("activation.preconditions.requirementsSelected")}
                          </span>
                        </span>
                      </li>
                    </ul>

                    <form
                      id="activation-form"
                      action={activateApplication}
                      className={styles.formInline}
                    >
                      <input type="hidden" name="caseId" value={c.id} />
                      <input type="hidden" name="locale" value={locale} />
                    </form>

                    <ConfirmSubmitButton
                      formId="activation-form"
                      className="button button-primary"
                      label={t("activation.activate")}
                      pendingLabel={savingLabel}
                      arrowLabel={arrowLabel}
                      arrowClassName={styles.arrow}
                      disabled={!activationEnabled}
                      confirmTitle={tGlobal("Confirm.title")}
                      confirmBody={t("activation.confirmBody")}
                      confirmCancelLabel={tGlobal("Confirm.cancel")}
                      confirmContinueLabel={tGlobal("Confirm.continue")}
                      confirmCancelClassName="button button-secondary"
                      confirmContinueClassName="button button-primary"
                    />

                    {ENABLE_DEV_ACTIVATION_BYPASS ? (
                      <>
                        <form
                          id="activation-form-dev"
                          action={activateApplication}
                          className={styles.formInline}
                        >
                          <input type="hidden" name="caseId" value={c.id} />
                          <input type="hidden" name="locale" value={locale} />
                          <input type="hidden" name="devBypass" value="true" />
                        </form>

                        <button
                          type="submit"
                          form="activation-form-dev"
                          className="button button-secondary"
                        >
                          {t("activation.activateDevBypass")}
                          <span className={styles.arrow} aria-hidden="true">
                            {arrowLabel}
                          </span>
                        </button>
                      </>
                    ) : null}
                  </div>
                )}
              </DisclosurePanel>
            )}
          </StatusStepWizard>
        )}

        {/* ─────────────────────── Timeline ─────────────────────── */}
        {effectiveOpenPanel === "timeline" && (
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
