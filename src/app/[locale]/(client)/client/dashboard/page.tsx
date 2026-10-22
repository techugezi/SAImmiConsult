/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/(client)/client/dashboard/page.tsx
SCOPE: Client dashboard (status truth + quick actions). Server-only.
STATUS: LOCKED
NOTES:
- No hardcoded English UI strings; all user-facing copy via i18n.
- Status “source of truth”:
  1) Profile incomplete overrides everything.
  2) Otherwise, use the MOST RECENTLY UPDATED between:
     - latest case (any status)
     - latest activated application (via latest case with status=application_activated)
  3) If the most recently updated is a non-activated case → show CASE status.
  4) If the most recently updated is the activated application → show APPLICATION status.
- Journey: the effective status (profile_incomplete | no_case | case.status | application.application_status)
  feeds <JourneyTracker/>, which replaces the old status card (stepper + "what's next" + CTA).
  A locked "Your application" card shows until the application is activated.
- Timeline:
  - If a case is still active → render the case timeline.
  - If the application is active → append the application timeline to the case timeline.
  - Only render the timeline card if the user has an active case or application.
*/

import "server-only";

import type { ComponentProps } from "react";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";

import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { siteConfig } from "@/config/siteConfig";
import { Link } from "@/i18n/navigation";

import { PageShell } from "@/components/ui/layout/PageShell";
import { MainColumn } from "@/components/ui/layout/MainColumn";

import Timeline from "@/components/ui/timeline/Timeline";
import JourneyTracker from "@/components/journey/JourneyTracker";
import { getJourney } from "@/lib/workflow/journey";
import { normalizeTimelineEvents } from "@/lib/timeline/normalizeTimelineEvents";

import {
	CASE_STATUS,
	type ApplicationStatusId,
	getApplicationStatusMeta,
	getCaseStatusMeta,
} from "@/config/statuses";

import { isProfileIncomplete, type ClientProfileLike } from "@/lib/profileCompleteness";

import styles from "./dashboard.module.css";

type ClientProfileRow = ClientProfileLike & {
	first_name: string | null;
	last_name: string | null;
};

type ClientCaseRow = {
	id: string;
	user_id: string;
	status: string;
	application_id: string | null;
	timeline: any;
	created_at: string;
	updated_at: string | null;
};

type ClientApplicationRow = {
	id: string;
	user_id: string;
	application_status: ApplicationStatusId;
	timeline: any;
	created_at: string;
	updated_at: string | null;
};

type Href = ComponentProps<typeof Link>["href"];

type DashboardState =
	| { kind: "profile_incomplete" }
	| { kind: "no_case" }
	| { kind: "case_in_progress"; case: ClientCaseRow }
	| { kind: "has_application"; app: ClientApplicationRow };

function buildDisplayName(
	profile: ClientProfileRow | null,
	email: string | null | undefined,
	fallbackLabel: string,
): string {
	const first = profile?.first_name?.trim();
	const last = profile?.last_name?.trim();

	if (first) return `${first} ${last ?? ""}`.trim();
	if (email) return email.split("@")[0] || fallbackLabel;
	return fallbackLabel;
}

function pickFirstParam(v: string | string[] | undefined): string | undefined {
	if (Array.isArray(v)) return v[0];
	return v;
}

function safeTime(value: string | null | undefined): number {
	if (!value) return 0;
	const d = new Date(value);
	const t = d.getTime();
	return Number.isNaN(t) ? 0 : t;
}

export default async function ClientDashboardPage({
	searchParams,
}: {
	searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
	noStore();

	const t = await getTranslations("ClientDashboard");
	const tJourney = await getTranslations("Journey");
	const tGlobal = await getTranslations("GlobalForm");
	const locale = await getLocale();

	const resolvedSearchParams = searchParams ? await searchParams : undefined;
	const caseSubmittedParam = pickFirstParam(resolvedSearchParams?.case_submitted);
	const showCaseSubmitted = caseSubmittedParam === "1";

	const supabase = await createServerSupabaseClient();

	// Auth (server-verified)
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect(siteConfig.loginPath);

	const userId = user.id;

	// Profile
	const { data: profile } = await supabase
		.from("client_profiles")
		.select(
			"first_name, last_name, citizenship_country, date_of_birth, contact_email, telegram_username, whatsapp_e164, passport_expiry",
		)
		.eq("user_id", userId)
		.maybeSingle<ClientProfileRow>();

	const displayName = buildDisplayName(profile ?? null, user.email, t("common.clientFallback"));
	const profileIncomplete = isProfileIncomplete(profile ?? null);

	// Latest case (by UPDATED)
	const { data: caseRows } = await supabase
		.from("client_cases")
		.select("id, user_id, status, application_id, timeline, created_at, updated_at")
		.eq("user_id", userId)
		.order("updated_at", { ascending: false, nullsFirst: false })
		.order("created_at", { ascending: false })
		.limit(1);

	const latestCase: ClientCaseRow | null =
		caseRows && caseRows.length > 0 ? (caseRows[0] as ClientCaseRow) : null;

	// Latest application (by UPDATED)
	const { data: appRows } = await supabase
		.from("client_applications")
		.select("id, user_id, application_status, timeline, created_at, updated_at")
		.eq("user_id", userId)
		.order("updated_at", { ascending: false, nullsFirst: false })
		.order("created_at", { ascending: false })
		.limit(1);

	const latestApp: ClientApplicationRow | null =
		appRows && appRows.length > 0 ? (appRows[0] as ClientApplicationRow) : null;

	// State machine (Profile → Most-recent truth between Case/Application)
	let state: DashboardState;

	if (profileIncomplete) {
		state = { kind: "profile_incomplete" };
	} else if (!latestCase && !latestApp) {
		state = { kind: "no_case" };
	} else {
		const caseUpdated = latestCase
			? Math.max(safeTime(latestCase.updated_at), safeTime(latestCase.created_at))
			: 0;

		const appUpdated = latestApp
			? Math.max(safeTime(latestApp.updated_at), safeTime(latestApp.created_at))
			: 0;

		const caseIsActivated =
			!!latestCase &&
			(latestCase.status === CASE_STATUS.APPLICATION_ACTIVATED || !!latestCase.application_id);

		if (caseIsActivated && latestApp) {
			state = { kind: "has_application", app: latestApp };
		} else if (latestCase && caseUpdated >= appUpdated) {
			state = { kind: "case_in_progress", case: latestCase };
		} else if (latestCase && !caseIsActivated) {
			state = { kind: "case_in_progress", case: latestCase };
		} else if (latestApp) {
			state = { kind: "has_application", app: latestApp };
		} else {
			state = { kind: "no_case" };
		}
	}

	// Timeline card should only render when the user has an active case or application
	const shouldRenderTimeline = state.kind === "case_in_progress" || state.kind === "has_application";

	// If application is active, we want the timeline of the latest *activated* case (to prepend),
	// then append the application's timeline.
	let activatedCaseForTimeline: ClientCaseRow | null = null;

	if (state.kind === "has_application") {
		const { data: activatedCaseRows } = await supabase
			.from("client_cases")
			.select("id, user_id, status, application_id, timeline, created_at, updated_at")
			.eq("user_id", userId)
			.or(`status.eq.${CASE_STATUS.APPLICATION_ACTIVATED},application_id.not.is.null`)
			.order("updated_at", { ascending: false, nullsFirst: false })
			.order("created_at", { ascending: false })
			.limit(1);

		activatedCaseForTimeline =
			activatedCaseRows && activatedCaseRows.length > 0
				? (activatedCaseRows[0] as ClientCaseRow)
				: null;
	}

	// Build timeline events according to journey:
	// - Active case: case timeline only.
	// - Active application: case timeline + application timeline (appended).
	let timelineEvents: any[] = [];

	if (shouldRenderTimeline) {
		if (state.kind === "case_in_progress") {
			const caseEvents = normalizeTimelineEvents(state.case.timeline);
			timelineEvents = [...caseEvents];
		} else if (state.kind === "has_application") {
			const caseEvents = normalizeTimelineEvents(activatedCaseForTimeline?.timeline ?? null);
			const appEvents = normalizeTimelineEvents(state.app.timeline);

			// Append app timeline to case timeline, then sort newest-first for rendering.
			timelineEvents = [...caseEvents, ...appEvents].sort(
				(a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
			);
		}
	}

	// ---------------------------------------------------------------------
	// Journey wiring: one effective status string drives the tracker.
	// ---------------------------------------------------------------------
	let journeyStatus: string;
	let badgeText = "";
	let badgeClass = "badge";
	let fallbackBody = "";

	if (state.kind === "profile_incomplete") {
		journeyStatus = "profile_incomplete";
		badgeText = t("states.profileIncomplete.badge");
		badgeClass = "badge badge-action";
	} else if (state.kind === "no_case") {
		journeyStatus = "no_case";
		badgeText = t("states.noCase.badge");
		badgeClass = "badge badge-action";
	} else if (state.kind === "case_in_progress") {
		const caseMeta = getCaseStatusMeta(state.case.status);
		journeyStatus = state.case.status;
		badgeText = tGlobal(`Statuses.cases.${caseMeta.labelKey}`);
		badgeClass = `badge ${caseMeta.badgeTone}`;
		fallbackBody = tGlobal(`Statuses.casesDescriptions.${caseMeta.descriptionKey}`);
	} else {
		const appMeta = getApplicationStatusMeta(state.app.application_status);
		journeyStatus = state.app.application_status;
		badgeText = tGlobal(`Statuses.applications.${appMeta.labelKey}`);
		badgeClass = `badge ${appMeta.badgeTone}`;
		fallbackBody = tGlobal(`Statuses.applicationsDescriptions.${appMeta.descriptionKey}`);
	}

	const journey = getJourney(journeyStatus);

	const applicationId =
		state.kind === "has_application"
			? state.app.id
			: state.kind === "case_in_progress"
				? state.case.application_id
				: null;

	// Primary button: only when it is the client's turn.
	let primaryHref: Href | null = null;

	if (journey?.actor === "client") {
		switch (journey.cta) {
			case "profile":
				primaryHref = siteConfig.clientAccountHref;
				break;
			case "newCase":
				primaryHref = siteConfig.clientNewCaseHref;
				break;
			case "case":
				if (state.kind === "case_in_progress") primaryHref = siteConfig.clientCaseDetailsHref(state.case.id);
				break;
			case "application":
				if (applicationId) primaryHref = siteConfig.clientApplicationDetailsHref(applicationId);
				break;
		}
	}

	// Secondary "view details" link when there is no primary button.
	let details: { href: Href; label: string } | null = null;

	if (!primaryHref) {
		if (state.kind === "case_in_progress") {
			details = {
				href: siteConfig.clientCaseDetailsHref(state.case.id),
				label: t("states.caseInProgress.cta"),
			};
		} else if (state.kind === "has_application") {
			details = {
				href: siteConfig.clientApplicationDetailsHref(state.app.id),
				label: t("states.cta.viewApplication"),
			};
		}
	}

	// Locked placeholder until the application exists (answers "where do I upload?").
	const showLockedApplication = state.kind !== "has_application" && journey?.terminal !== "stopped";

	return (
		<PageShell>
			<header className="hero-shell">
				<div className="hero-inner">
					<p className="hero-title">{t("welcome.eyebrow")}</p>
					<h1 className="hero-subtitle">{t("welcome.title", { name: displayName })}</h1>
					<p className="hero-desc">{t("welcome.subtitle")}</p>
				</div>
			</header>

			<MainColumn>
				{showCaseSubmitted ? (
					<article className={styles.card} role="status" aria-live="polite">
						<div className={styles.cardHeader}>
							<h2 className="panel-title">{t("banners.caseSubmitted.title")}</h2>
							<span className="badge badge-neutral">{t("banners.caseSubmitted.badge")}</span>
						</div>

						<p className="text-sm text-muted">{t("banners.caseSubmitted.body")}</p>
					</article>
				) : null}

				<JourneyTracker
					className={styles.card}
					status={journeyStatus}
					badge={{ label: badgeText, className: badgeClass }}
					primaryHref={primaryHref}
					details={details}
					arrow={tGlobal("Common.symbols.arrowRight")}
					fallbackBody={fallbackBody}
				/>

				<div className={styles.cardsGrid}>
					{showLockedApplication ? (
						<article className={styles.card}>
							<div className={styles.lockRow}>
								<span className={styles.lockIcon} aria-hidden="true">
									<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
										<rect x="4.5" y="9" width="11" height="8" rx="2" />
										<path d="M7 9V6.5a3 3 0 0 1 6 0V9" strokeLinecap="round" />
									</svg>
								</span>
								<div>
									<h2 className="panel-title">{tJourney("lockedApplication.title")}</h2>
									<p className={`text-sm text-muted ${styles.lockBody}`}>{tJourney("lockedApplication.body")}</p>
								</div>
							</div>
						</article>
					) : null}

					<article className={styles.card}>
						<h2 className="panel-title">{t("quickActions.title")}</h2>

						<div className={styles.actionsGrid}>
							<a
								href={siteConfig.whatsappUrl}
								target="_blank"
								rel="noreferrer"
								className={`button button-primary ${styles.actionButton}`}
							>
								{t("quickActions.whatsapp")}
							</a>

							<a
								href={siteConfig.telegramPhoneUrl}
								target="_blank"
								rel="noreferrer"
								className={`button button-secondary ${styles.actionButton}`}
							>
								{t("quickActions.telegram")}
							</a>
						</div>
					</article>
				</div>
			</MainColumn>
		</PageShell>
	);
}
