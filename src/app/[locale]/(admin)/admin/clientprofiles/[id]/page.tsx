/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/(admin)/admin/clientprofiles/[id]/page.tsx
SCOPE: Admin Client Profile Details — composition only (global typography + global buttons; module CSS layout only).
STATUS: UNLOCKED
AUDITED:
- Gate: Enforces admin/consultant access via auth.getUser() + user_roles before any profile data is read.
- RLS: Uses createServerSupabaseClient() (RLS-respecting) for reads; no service-role usage in this file.
- Data exposure: Currently selects "*" from client_profiles (works, but broader than necessary). Consider narrowing fields in a future change (not changed here to avoid behavior risk).
- Redirects: Uses siteConfig paths for redirects/navigation (locale derived via next-intl; no i18n keys changed).
- UI safety: No hardcoded user-facing strings; copy is sourced from next-intl keys.
NOTES:
- This update localizes enum values at the UI layer using next-intl keys under GlobalForm.Enums.*.
- No business logic changes; enum display only.
- Hero typography order MUST be: hero-title, hero-subtitle, hero-desc.
- No hardcoded user-facing strings; no i18n fallbacks.
- Buttons must use global button classes (button-primary / button-ghost).
*/

export const dynamic = "force-dynamic";

import "server-only";

import type React from "react";

import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { createServerSupabaseClient } from "@/lib/supabaseServer";
import { siteConfig } from "@/config/siteConfig";

import { PageShell } from "@/components/ui/layout/PageShell";
import { MainColumn } from "@/components/ui/layout/MainColumn";
import { Panel } from "@/components/ui/panel/Panel";
import ContactIcon from "@/components/ui/icons/ContactIcon";

import ExportClientProfileButton, {
	type ExportClientProfilePayload,
} from "@/components/admin/ExportClientProfileButton";

import styles from "./details.module.css";

type ClientProfile = {
	user_id: string;

	first_name: string;
	middle_name: string | null;
	last_name: string;

	date_of_birth: string | null;
	citizenship_country: string | null;
	city_country: string | null;

	marital_status: string | null;

	phone_country_code: string | null;
	phone_number: string | null;

	/* legacy (kept for backward-compat if older rows exist) */
	whatsapp_country_code: string | null;
	whatsapp_number: string | null;

	preferred_contact_method: string | null;
	preferred_contact_time: string | null;

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

	created_at: string;
	updated_at: string;

	/* NEW columns */
	contact_email: string | null;
	telegram_username: string | null;
	whatsapp_e164: string | null;
	drive_parent_folder_id: string | null;
};

function safeDate(value: string | Date | null | undefined) {
	if (!value) return null;
	const d = value instanceof Date ? value : new Date(value);
	return Number.isNaN(d.getTime()) ? null : d;
}

function humanizeSnake(value: string | null | undefined) {
	if (!value) return "";
	return value
		.split("_")
		.filter(Boolean)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
}

function formatPhone(code?: string | null, number?: string | null) {
	if (!code && !number) return "";
	if (code && number) return `${code}${number}`;
	return code || number || "";
}

function fullName(p: Pick<ClientProfile, "first_name" | "middle_name" | "last_name">) {
	return [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/* i18n enum localization (UI layer)                                           */
/* -------------------------------------------------------------------------- */

type EnumGroup = "yesNo" | "englishLevel" | "maritalStatus" | "preferredContactMethod";

function normalizeEnumValue(value: unknown) {
	if (typeof value !== "string") return "";
	return value.trim().toLowerCase();
}

function isEnumGroup(group: string): group is EnumGroup {
	return (
		group === "yesNo" ||
		group === "englishLevel" ||
		group === "maritalStatus" ||
		group === "preferredContactMethod"
	);
}

function enumKey(group: EnumGroup, value: string) {
	return `Enums.${group}.${value}` as const;
}

/**
 * Localize known enum values using GlobalForm.Enums.*.
 * - If key does not exist, return a safe fallback (humanized) without hardcoding new copy.
 * - If value is empty/null, return "" so caller can use NA label.
 */
type TranslationValues = Record<string, string | number | Date>;

function localizeEnumValue(
	tGlobal: (key: string, values?: TranslationValues) => string,
	group: EnumGroup,
	raw: unknown
) {

	const v = normalizeEnumValue(raw);
	if (!v) return "";

	const key = enumKey(group, v);

	try {
		const translated = tGlobal(key);
		// next-intl typically returns the key itself if missing (depending on config).
		// We treat "no translation" as "same as key prefix".
		if (typeof translated === "string" && translated && translated !== key) {
			return translated;
		}
	} catch {
		// ignore and fall back
	}

	return humanizeSnake(v);
}

/* -------------------------------------------------------------------------- */
/* Contact links                                                               */
/* -------------------------------------------------------------------------- */

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
		preferredRaw === "email" || preferredRaw === "whatsapp" || preferredRaw === "telegram"
			? (preferredRaw as ContactMethod)
			: null;

	const links: ContactLink[] = [];

	// Email
	{
		const email = typeof profile?.contact_email === "string" ? profile.contact_email.trim() : "";
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
		const raw = typeof profile?.whatsapp_e164 === "string" ? profile.whatsapp_e164.trim() : "";
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
			typeof profile?.telegram_username === "string" ? profile.telegram_username.trim() : "";
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

type InfoItemProps = {
	label: string;
	value?: string | null | undefined;
	naLabel: string;
	node?: React.ReactNode;
};

function InfoItem({ label, value, naLabel, node }: InfoItemProps) {
	const display = value && value.trim() ? value : naLabel;

	return (
		<div className={styles.infoItem}>
			<p className="form-label" style={{ margin: 0 }}>
				{label}
			</p>

			{node ? (
				<div className={styles.infoValue}>{node}</div>
			) : (
				<p className={`text-sm ${styles.infoValue}`} style={{ margin: 0 }}>
					{display}
				</p>
			)}
		</div>
	);
}

async function assertAdminOrConsultantOrRedirect() {
	const supabase = await createServerSupabaseClient();

	const {
		data: { user },
		error: userError,
	} = await supabase.auth.getUser();

	if (!user || userError) {
		redirect(siteConfig.loginPath);
	}

	const { data: roleRow } = await supabase
		.from("user_roles")
		.select("role")
		.eq("user_id", user.id)
		.maybeSingle();

	if (!roleRow || (roleRow.role !== "admin" && roleRow.role !== "consultant")) {
		redirect("/");
	}

	return supabase;
}

export default async function AdminClientProfileDetailsPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const t = await getTranslations("AdminClientProfiles");
	const tGlobal = await getTranslations("GlobalForm");
	const locale = await getLocale();

	const naLabel = tGlobal("Common.na");
	const arrowLeft = tGlobal("Common.symbols.arrowLeft");
	const arrowRight = tGlobal("Common.symbols.arrowRight");

	const fmtShort = new Intl.DateTimeFormat(locale, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});

	const supabase = await assertAdminOrConsultantOrRedirect();

	const { data: profile, error } = await supabase
		.from("client_profiles")
		.select("*")
		.eq("user_id", id)
		.single();

	if (error || !profile) {
		return (
			<PageShell>
				<header className="hero-shell">
					<div className="hero-inner">
						<h1 className="hero-title">{t("errors.title")}</h1>
						<p className="hero-subtitle">{t("errors.subtitle")}</p>
						<p className="hero-desc">{t("errors.description")}</p>

						<div style={{ marginTop: "var(--space-4)" }}>
							<Link href={siteConfig.adminClientProfilesPath} className="button button-ghost">
								{arrowLeft} {t("actions.backToClients")}
							</Link>
						</div>
					</div>
				</header>
			</PageShell>
		);
	}

	const p = profile as ClientProfile;

	const name = fullName(p) || t("hero.unknownName");

	const dob = safeDate(p.date_of_birth);
	const passportExpiry = safeDate(p.passport_expiry);

	const dobLabel = dob ? fmtShort.format(dob) : "";
	const passportLabel = passportExpiry ? fmtShort.format(passportExpiry) : "";

	const phone = formatPhone(p.phone_country_code, p.phone_number);

	/* NEW preferred display */
	const whatsappE164 = (p.whatsapp_e164 ?? "").trim();
	const telegramUsername = (p.telegram_username ?? "").trim();
	const contactEmail = (p.contact_email ?? "").trim();

	const contactLinks = buildContactLinks(p);

	/* Drive folder link (only if present) */
	const driveParentFolderId = (p.drive_parent_folder_id ?? "").trim();
	const driveFolderHref = driveParentFolderId
		? `https://drive.google.com/drive/folders/${driveParentFolderId}`
		: "";

	/* Localized enums (UI layer) */
	const maritalStatusLabel = localizeEnumValue(tGlobal, "maritalStatus", p.marital_status);
	const preferredContactMethodLabel = localizeEnumValue(
		tGlobal,
		"preferredContactMethod",
		p.preferred_contact_method
	);
	const incomeOver2000Label = localizeEnumValue(tGlobal, "yesNo", p.income_over_2000);
	const beenToSaLabel = localizeEnumValue(tGlobal, "yesNo", p.been_to_sa);
	const visaRefusalsLabel = localizeEnumValue(tGlobal, "yesNo", p.visa_refusals);
	const englishLevelLabel = localizeEnumValue(tGlobal, "englishLevel", p.english_level);
	const needLanguageSchoolLabel = localizeEnumValue(
		tGlobal,
		"yesNo",
		p.need_language_school
	);

	const exportPayload: ExportClientProfilePayload = {
		userId: p.user_id,
		firstName: p.first_name,
		middleName: p.middle_name,
		lastName: p.last_name,
	
		headers: {
			title: t("export.title", { name }),
			userId: t("fields.userId"),
			firstName: t("fields.firstName"),
			middleName: t("fields.middleName"),
			lastName: t("fields.lastName"),
		},
	
		fields: [
			// keep your existing localized export fields as-is
			{ label: t("fields.citizenship"), value: humanizeSnake(p.citizenship_country) },
			{ label: t("fields.dateOfBirth"), value: dobLabel },
			{ label: t("fields.currentLocation"), value: p.current_location },
			{ label: t("fields.passportExpiry"), value: passportLabel },
			{ label: t("fields.whatsapp"), value: whatsappE164 },
			{ label: t("fields.telegramUsername"), value: telegramUsername },
			{ label: t("fields.contactEmail"), value: contactEmail },
			{ label: t("fields.preferredContactMethod"), value: preferredContactMethodLabel },
			{ label: t("fields.preferredContactTime"), value: p.preferred_contact_time },
			{ label: t("fields.visitPurpose"), value: p.visit_purpose },
			{ label: t("fields.immigrationGoal"), value: p.immigration_goal },
			{ label: t("fields.beenToSA"), value: beenToSaLabel },
			{ label: t("fields.firstEntrySA"), value: p.first_entry_sa },
			{ label: t("fields.visaRefusals"), value: visaRefusalsLabel },
			{ label: t("fields.visaRefusalsDetails"), value: p.visa_refusals_details },
			{ label: t("fields.englishLevel"), value: englishLevelLabel },
			{ label: t("fields.needLanguageSchool"), value: needLanguageSchoolLabel },
			{ label: t("fields.incomeOver2000"), value: incomeOver2000Label },
			{ label: t("fields.incomeSource"), value: p.income_source },
			{ label: t("fields.familyComposition"), value: p.family_composition },
			{ label: t("fields.driveParentFolderId"), value: driveParentFolderId },
		],
	};
	

	return (
		<PageShell>
			<header className="hero-shell">
				<div className="hero-inner">
					<h1 className="hero-title">{t("hero.title")}</h1>
					<p className="hero-subtitle">{name}</p>
					<p className="hero-desc">{t("hero.description")}</p>
				</div>
			</header>

			<MainColumn>
				<div className={styles.topActions}>
					<Link href={siteConfig.adminClientProfilesPath} className="button button-ghost">
						<span aria-hidden="true">{tGlobal("Common.symbols.arrowLeft")}</span>
						{tGlobal("header.actions.backToProfiles")}
					</Link>

					<ExportClientProfileButton
						profile={exportPayload}
						label={t("actions.exportProfile")}
						pdfLabel={t("actions.exportPdf")}
						wordLabel={t("actions.exportWord")}
						exportingLabel={t("actions.exporting")}
						toggleAriaLabel={t("aria.exportToggle")}
						menuAriaLabel={t("aria.exportMenu")}
						className="button button-primary"
						itemClassName="button button-secondary"
					/>
				</div>

				<Panel title={t("sections.keyInfo.title")} subtitle={t("sections.keyInfo.subtitle")}>
					<div className={styles.grid}>
						<InfoItem
							label={t("fields.citizenship")}
							value={humanizeSnake(p.citizenship_country)}
							naLabel={naLabel}
						/>
						<InfoItem label={t("fields.dateOfBirth")} value={dobLabel} naLabel={naLabel} />
						<InfoItem
							label={t("fields.currentLocation")}
							value={p.current_location}
							naLabel={naLabel}
						/>
						{/*<InfoItem label={t("fields.currentVisaStatus")} value={p.current_visa_status} naLabel={naLabel} />*/}
						<InfoItem label={t("fields.passportExpiry")} value={passportLabel} naLabel={naLabel} />
					</div>
				</Panel>

				<Panel title={t("sections.contact.title")} subtitle={t("sections.contact.subtitle")}>
					<div className={styles.grid}>
						{/*<InfoItem label={t("fields.phone")} value={phone} naLabel={naLabel} />*/}

						{/* UPDATED: whatsapp_e164 */}
						<InfoItem label={t("fields.whatsapp")} value={whatsappE164} naLabel={naLabel} />

						{/* NEW */}
						<InfoItem
							label={t("fields.telegramUsername")}
							value={telegramUsername}
							naLabel={naLabel}
						/>
						<InfoItem label={t("fields.contactEmail")} value={contactEmail} naLabel={naLabel} />

						<InfoItem
							label={t("fields.preferredContactMethod")}
							value={preferredContactMethodLabel}
							naLabel={naLabel}
						/>
						<InfoItem
							label={t("fields.preferredContactTime")}
							value={p.preferred_contact_time}
							naLabel={naLabel}
						/>
					</div>

					{driveFolderHref || contactLinks.length > 0 ? (
						<div style={{ marginTop: "var(--space-4)" }}>
							<p className="form-label" style={{ margin: 0 }}>
								{t("actions.quickActions")}
							</p>

							<div style={{ marginTop: "var(--space-2)" }}>
								{/* Row 1: Drive (own line) */}
								{driveFolderHref ? (
									<div className={styles.formInline}>
										<a
											href={driveFolderHref}
											className="button button-secondary"
											target="_blank"
											rel="noopener noreferrer"
										>
											{t("actions.openDriveFolder")}
											<span className={styles.arrow} aria-hidden="true">
												{arrowRight}
											</span>
										</a>
									</div>
								) : null}

								{/* Row 2: Contact methods (own line, wraps) */}
								{contactLinks.length > 0 ? (
									<div className={styles.formInline} style={{ marginTop: "var(--space-2)" }}>
										{contactLinks.map((l) => (
											<a
												key={l.method}
												href={l.href}
												className="button button-secondary"
												target={l.isExternal ? "_blank" : undefined}
												rel={l.isExternal ? "noopener noreferrer" : undefined}
											>
												<ContactIcon method={l.method} />
												{t("actions.contactMethod", { method: t(`contactMethods.${l.method}`) })}
												<span className={styles.arrow} aria-hidden="true">
													{arrowRight}
												</span>
											</a>
										))}
									</div>
								) : null}
							</div>
						</div>
					) : null}
				</Panel>

				<Panel title={t("sections.intent.title")} subtitle={t("sections.intent.subtitle")}>
					<div className={styles.longGrid}>
						<InfoItem label={t("fields.visitPurpose")} value={p.visit_purpose} naLabel={naLabel} />
						<InfoItem
							label={t("fields.immigrationGoal")}
							value={p.immigration_goal}
							naLabel={naLabel}
						/>
					</div>
				</Panel>

				<Panel title={t("sections.background.title")} subtitle={t("sections.background.subtitle")}>
					<div className={styles.grid}>
						<InfoItem label={t("fields.maritalStatus")} value={maritalStatusLabel} naLabel={naLabel} />
						<InfoItem label={t("fields.beenToSA")} value={beenToSaLabel} naLabel={naLabel} />
						<InfoItem label={t("fields.firstEntrySA")} value={p.first_entry_sa} naLabel={naLabel} />
						<InfoItem label={t("fields.visaRefusals")} value={visaRefusalsLabel} naLabel={naLabel} />
						<InfoItem label={t("fields.englishLevel")} value={englishLevelLabel} naLabel={naLabel} />
						<InfoItem
							label={t("fields.needLanguageSchool")}
							value={needLanguageSchoolLabel}
							naLabel={naLabel}
						/>
					</div>

					{p.visa_refusals_details ? (
						<div style={{ marginTop: "var(--space-4)" }}>
							<p className="text-xs text-muted" style={{ margin: 0 }}>
								{t("fields.visaRefusalsDetails")}
							</p>
							<p className="text-sm" style={{ margin: "var(--space-1) 0 0" }}>
								{p.visa_refusals_details}
							</p>
						</div>
					) : null}
				</Panel>

				<Panel title={t("sections.household.title")} subtitle={t("sections.household.subtitle")}>
					<div className={styles.grid}>
						<InfoItem label={t("fields.incomeOver2000")} value={incomeOver2000Label} naLabel={naLabel} />
						<InfoItem label={t("fields.incomeSource")} value={p.income_source} naLabel={naLabel} />
						<InfoItem
							label={t("fields.familyComposition")}
							value={p.family_composition}
							naLabel={naLabel}
						/>
					</div>
				</Panel>
			</MainColumn>
		</PageShell>
	);
}
