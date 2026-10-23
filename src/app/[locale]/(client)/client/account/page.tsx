/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/(client)/client/account/page.tsx
SCOPE: Client profile intake. Global primitives only; module CSS is layout/interaction only.
STATUS: LOCKED
AUDIT NOTES (PROD PRIMING) — /src/app/[locale]/(client)/client/profile/page.tsx

SCOPE CHECK
- This page is client-facing profile intake (PII). Keep changes minimal, predictable, and data-safe.

FIXES APPLIED (NUISANCE / DATA-INTEGRITY)
1) Citizenship dropdown value correctness (HIGH)
   - Previous implementation stored the *localized country name* as the DB value (e.g. "South Africa"),
     which is unstable across locales and breaks filtering/analytics.
   - Updated to store ISO-3166 alpha-2 codes (e.g. "ZA") while displaying localized names.
   - Legacy/free-text DB values are still preserved as a "custom" option so existing prod data is not dropped.

2) Prevent silent data loss on city_country (HIGH)
   - Removed `.split(",")[0]` when loading `city_country`.
   - That behavior truncates existing data (e.g. "Cape Town, South Africa" → "Cape Town"),
     and is unacceptable for prod priming.

3) Backward compatibility (MED)
   - If citizenship is stored as lower-case ISO, UI normalizes to upper-case.
   - If citizenship is stored as legacy free text, UI keeps it selectable and persists it unchanged.

PROD-SAFETY / UX
- No hardcoded UI strings introduced (still i18n keys only).
- No changes to submit flow, auth flow, or routing.
- Dirty-check logic preserved (snapshot compare).
- WhatsApp E164 derivation preserved (derived field only, DB writes derived).

KNOWN FOLLOW-UPS (DB/SECURITY) — NOT CHANGED HERE
- Ensure DB constraints/checks enforce expected values where applicable (e.g. citizenship format, enums).
- Verify RLS policies on `client_profiles` prevent cross-user access and enforce `user_id` ownership.
- Consider server-side validation for preferred contact method fields (email/telegram/whatsapp) as final gate.

*/

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/config/siteConfig";
import { supabase } from "@/lib/supabaseClient";
import { PageShell } from "@/components/ui/layout/PageShell";
import { MainColumn } from "@/components/ui/layout/MainColumn";
import styles from "./profile.module.css";

import {
	CLIENT_PROFILE_SECTIONS,
	MARITAL_STATUS_OPTIONS,
	YES_NO_UNSPECIFIED_OPTIONS,
	ENGLISH_LEVEL_OPTIONS,
	PREFERRED_CONTACT_METHOD_OPTIONS,
	type PreferredContactMethod,
} from "@/config/clientProfileFormConfig";

import {
	DEFAULT_WHATSAPP_COUNTRY_ISO2,
	EXCLUDED_PHONE_COUNTRIES_ISO2,
	WHATSAPP_COUNTRY_GROUPS,
} from "@/config/phoneCountries";

import { ISO_3166_ALPHA2_ALL } from "@/config/iso3166Countries";

import {
	getCountries,
	getCountryCallingCode,
	parsePhoneNumberFromString,
	type CountryCode,
} from "libphonenumber-js";

type FormState = {
	isLoading: boolean;
	isSubmitting: boolean;
	formError: string | null;
	formSuccess: string | null;
};

type ProfileFormValues = {
	// Identity
	firstName: string;
	middleName: string;
	lastName: string;
	dateOfBirth: string;

	citizenship: string; // ISO2 (preferred). Legacy free-text tolerated.
	cityCountry: string;
	maritalStatus: string;

	// Contact preference
	preferredContactMethod: PreferredContactMethod | "";
	contactEmail: string;
	telegramUsername: string;

	// Email convenience
	useLoginEmail: boolean;

	// WhatsApp (UI)
	whatsappCountry: string; // ISO2
	whatsappNumber: string; // freeform
	whatsappE164: string; // derived

	// Family & finances
	familyComposition: string;
	income2000plus: string;
	incomeSource: string;

	// Travel & visa history
	beenToSa: string;
	firstEntrySa: string;
	currentLocation: string;
	currentVisa: string;
	visaRefusals: string;

	// Passport & plans
	passportExpiry: string;
	visitPurpose: string;

	// Language
	englishLevel: string;
	needLanguageSchool: string;
};

const EMPTY_VALUES: ProfileFormValues = {
	firstName: "",
	middleName: "",
	lastName: "",
	dateOfBirth: "",

	citizenship: "",
	cityCountry: "",
	maritalStatus: "",

	preferredContactMethod: "",
	contactEmail: "",
	telegramUsername: "",

	useLoginEmail: false,

	whatsappCountry: DEFAULT_WHATSAPP_COUNTRY_ISO2,
	whatsappNumber: "",
	whatsappE164: "",

	familyComposition: "",
	income2000plus: "",
	incomeSource: "",

	beenToSa: "",
	firstEntrySa: "",
	currentLocation: "",
	currentVisa: "",
	visaRefusals: "",

	passportExpiry: "",
	visitPurpose: "",

	englishLevel: "",
	needLanguageSchool: "",
};

function toInputDate(value: string | null | undefined) {
	if (!value) return "";
	if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return "";
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}

function normalizeTrim(v: string) {
	return v.trim();
}

function isValidEmailFormat(v: string) {
	return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(v.trim());
}

function isValidTelegramUsernameFormat(v: string) {
	return /^[A-Za-z0-9_]{5,32}$/.test(v.trim());
}

/**
 * Returns true when the passport expiry date is less than 6 months away.
 * Empty / unparseable dates return false (not a "too soon" error).
 */
function isPassportExpiringSoon(value: string) {
	if (!value) return false;
	const expiry = new Date(value);
	if (Number.isNaN(expiry.getTime())) return false;

	const sixMonthsFromNow = new Date();
	sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

	return expiry < sixMonthsFromNow;
}

function buildWhatsAppE164(countryIso2: string, rawNumber: string) {
	const iso = countryIso2.toUpperCase() as CountryCode;
	const number = rawNumber.trim();
	if (!number) return "";

	const parsed = parsePhoneNumberFromString(number, iso);
	if (!parsed || !parsed.isValid()) return "";

	return parsed.number;
}

function buildComparableSnapshot(v: ProfileFormValues) {
	const whatsappE164 = buildWhatsAppE164(v.whatsappCountry, v.whatsappNumber);

	return JSON.stringify({
		firstName: v.firstName.trim(),
		middleName: v.middleName.trim(),
		lastName: v.lastName.trim(),
		dateOfBirth: v.dateOfBirth || "",

		citizenship: v.citizenship.trim(),
		cityCountry: v.cityCountry.trim(),
		maritalStatus: v.maritalStatus || "",

		preferredContactMethod: v.preferredContactMethod || "",
		contactEmail: v.contactEmail.trim(),
		telegramUsername: v.telegramUsername.trim(),
		useLoginEmail: Boolean(v.useLoginEmail),

		whatsappCountry: v.whatsappCountry || "",
		whatsappNumber: v.whatsappNumber.trim(),
		whatsappE164,

		familyComposition: v.familyComposition.trim(),
		income2000plus: v.income2000plus || "unspecified",
		incomeSource: v.incomeSource.trim(),

		beenToSa: v.beenToSa || "unspecified",
		firstEntrySa: v.firstEntrySa.trim(),
		currentLocation: v.currentLocation.trim(),
		currentVisa: v.currentVisa.trim(),
		visaRefusals: v.visaRefusals || "unspecified",

		passportExpiry: v.passportExpiry || "",
		visitPurpose: v.visitPurpose.trim(),

		englishLevel: v.englishLevel || "basic",
		needLanguageSchool: v.needLanguageSchool || "unspecified",
	});
}

export default function ClientProfileIntakePage() {
	const t = useTranslations("ClientForm");
	const tGlobal = useTranslations("GlobalForm");
	const locale = useLocale();
	const router = useRouter();

	const na = tGlobal("Common.na");

	const [userId, setUserId] = useState<string | null>(null);
	const [loginEmail, setLoginEmail] = useState<string>("");

	const [state, setState] = useState<FormState>({
		isLoading: true,
		isSubmitting: false,
		formError: null,
		formSuccess: null,
	});

	const [values, setValues] = useState<ProfileFormValues>(EMPTY_VALUES);
	const [currentStep, setCurrentStep] = useState(0);
	const [hasStarted, setHasStarted] = useState(false);
	const [isCompleted, setIsCompleted] = useState(false);
	// Flipped true once the initial load resolves (profile + progress).
	// Prevents the wizard/readiness UI from flashing for already-completed users.
	const [hasLoadedIntakeState, setHasLoadedIntakeState] = useState(false);

	const { isLoading, isSubmitting, formError, formSuccess } = state;

	const setError = (msg: string | null) =>
		setState((s) => ({ ...s, formError: msg, formSuccess: null }));

	const setSuccess = (msg: string | null) =>
		setState((s) => ({ ...s, formSuccess: msg, formError: null }));

	const setLoading = (v: boolean) => setState((s) => ({ ...s, isLoading: v }));
	const setSubmitting = (v: boolean) => setState((s) => ({ ...s, isSubmitting: v }));

	const regionNames = useMemo(() => {
		return new Intl.DisplayNames([locale], { type: "region" });
	}, [locale]);

	// WhatsApp Countries: stable ordering (priority groups first), then rest A–Z. Exclusions applied.
	const whatsappCountryOptions = useMemo(() => {
		const excluded = new Set(EXCLUDED_PHONE_COUNTRIES_ISO2.map((c) => c.toUpperCase()));
		const allSupported = getCountries()
			.map((c) => c.toUpperCase() as CountryCode)
			.filter((c) => !excluded.has(c));

		const priority = WHATSAPP_COUNTRY_GROUPS.flatMap((g) => g.iso2.map((c) => c.toUpperCase() as CountryCode));
		const prioritySet = new Set(priority);

		const rest = allSupported.filter((c) => !prioritySet.has(c));

		const ordered = [...priority, ...rest].filter((c, i, arr) => arr.indexOf(c) === i);

		function toOption(c: CountryCode) {
			const name = regionNames.of(c) ?? c;
			const callingCode = getCountryCallingCode(c);
			return { value: c, label: `${name} — ${c} (+${callingCode})` };
		}

		return ordered.map(toOption);
	}, [regionNames]);

	// Citizenship: ISO-3166 alpha-2 (incl territories). Value stored as ISO2 code.
	// Legacy/free-text DB values are preserved as a "custom" option to avoid dropping the selection.
	const citizenshipOptions = useMemo(() => {
		function toOption(iso2: string) {
			const code = iso2.toUpperCase();
			const name = regionNames.of(code) ?? code;
			return { key: code, value: code, label: name };
		}

		const base = ISO_3166_ALPHA2_ALL.map(toOption).sort((a, b) => a.label.localeCompare(b.label));

		const current = values.citizenship.trim();
		if (!current) return base;

		const currentUpper = current.toUpperCase();
		const exists = base.some((o) => o.value === currentUpper);

		if (exists) {
			// Normalize UI to ISO2 if the DB stored lower-case ISO.
			if (current !== currentUpper) {
				setValues((v) => ({ ...v, citizenship: currentUpper }));
			}
			return base;
		}

		// Preserve legacy free-text / localized stored values.
		return [{ key: "custom", value: current, label: current }, ...base];
	}, [regionNames, values.citizenship]);

	// Guard save button from non-dirty fields
	const initialSnapshotRef = useRef<string>("");
	const isDirty = useMemo(() => {
		if (!initialSnapshotRef.current) return false;
		return buildComparableSnapshot(values) !== initialSnapshotRef.current;
	}, [values]);

	const disableAll = isLoading || isSubmitting;

	// Load user + profile
	useEffect(() => {
		let cancelled = false;

		const run = async () => {
			setLoading(true);
			setError(null);
			setSuccess(null);

			try {
				const {
					data: { user },
					error: userError,
				} = await supabase.auth.getUser();

				if (cancelled) return;

				if (!user || userError) {
					router.push(siteConfig.loginPath);
					return;
				}

				setUserId(user.id);
				setLoginEmail(user.email ?? "");

				const { data: profile, error: profileError } = await supabase
					.from("client_profiles")
					.select(
						`
						first_name,
						middle_name,
						last_name,
						date_of_birth,
						citizenship_country,
						city_country,
						marital_status,
						family_composition,
						income_over_2000,
						income_source,
						been_to_sa,
						first_entry_sa,
						current_location,
						current_visa_status,
						visa_refusals,
						passport_expiry,
						visit_purpose,
						english_level,
						need_language_school,
						preferred_contact_method,
						contact_email,
						telegram_username,
						whatsapp_e164
					`,
					)
					.eq("user_id", user.id)
					.maybeSingle();

				if (cancelled) return;

				if (profileError) {
					console.error("[ClientProfileIntake] Failed to load profile:", profileError);
				}

				let nextValues: ProfileFormValues = EMPTY_VALUES;

				if (profile) {
					const preferred = (profile.preferred_contact_method ?? "") as PreferredContactMethod | "";

					let whatsappCountry = DEFAULT_WHATSAPP_COUNTRY_ISO2;
					let whatsappNumber = "";
					let whatsappE164 = profile.whatsapp_e164 ?? "";

					if (whatsappE164) {
						const parsed = parsePhoneNumberFromString(whatsappE164);
						if (parsed && parsed.country) {
							whatsappCountry = parsed.country;
							whatsappNumber = parsed.nationalNumber ?? "";
							whatsappE164 = parsed.number ?? whatsappE164;
						}
					}

					const contactEmail = profile.contact_email ?? "";
					const useLoginEmail = Boolean(
						(user.email ?? "") &&
							contactEmail &&
							contactEmail.trim().toLowerCase() === (user.email ?? "").trim().toLowerCase(),
					);

					nextValues = {
						firstName: profile.first_name ?? "",
						middleName: profile.middle_name ?? "",
						lastName: profile.last_name ?? "",
						dateOfBirth: toInputDate(profile.date_of_birth),

						// Prefer ISO2 codes going forward; legacy values allowed.
						citizenship: profile.citizenship_country ?? "",
						cityCountry: profile.city_country ?? "",
						maritalStatus: profile.marital_status ?? "",

						preferredContactMethod: preferred,
						contactEmail,
						telegramUsername: profile.telegram_username ?? "",

						useLoginEmail,

						whatsappCountry,
						whatsappNumber,
						whatsappE164,

						familyComposition: profile.family_composition ?? "",
						income2000plus: profile.income_over_2000 ?? "",
						incomeSource: profile.income_source ?? "",

						beenToSa: profile.been_to_sa ?? "",
						firstEntrySa: profile.first_entry_sa ?? "",
						currentLocation: profile.current_location ?? "",
						currentVisa: profile.current_visa_status ?? "",
						visaRefusals: profile.visa_refusals ?? "",

						passportExpiry: toInputDate(profile.passport_expiry),
						visitPurpose: profile.visit_purpose ?? "",

						englishLevel: profile.english_level ?? "",
						needLanguageSchool: profile.need_language_school ?? "",
					};
				}

				const { data: progress, error: progressError } = await supabase
					.from("client_profile_intake_progress")
					.select("current_step, has_started, is_completed")
					.eq("user_id", user.id)
					.maybeSingle();

				if (cancelled) return;

				if (progressError) {
					console.error("[ClientProfileIntake] Failed to load wizard progress:", progressError);
					setError(t("messages.progressUnavailable"));
				} else if (progress) {
					const savedStep = Number(progress.current_step);
					setCurrentStep(Number.isInteger(savedStep) ? Math.min(5, Math.max(0, savedStep)) : 0);
					setHasStarted(Boolean(progress.has_started));
					setIsCompleted(Boolean(progress.is_completed));
				}

				setValues(nextValues);
				initialSnapshotRef.current = buildComparableSnapshot(nextValues);
			} catch (err) {
				console.error("[ClientProfileIntake] Unexpected error while loading profile:", err);
				setError(t("messages.saveFailed"));
				setValues(EMPTY_VALUES);
				initialSnapshotRef.current = buildComparableSnapshot(EMPTY_VALUES);
			} finally {
				if (!cancelled) {
					setHasLoadedIntakeState(true);
					setLoading(false);
				}
			}
		};

		run();

		return () => {
			cancelled = true;
		};
	}, [router, t]);

	const onChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
			const { name, value } = e.currentTarget;
			setValues((v) => ({ ...v, [name]: value }));
		},
		[],
	);

	const onToggleUseLoginEmail = useCallback(() => {
		setValues((v) => {
			const next = !v.useLoginEmail;

			if (!next) {
				return { ...v, useLoginEmail: false };
			}

			return { ...v, useLoginEmail: true, contactEmail: loginEmail || v.contactEmail };
		});
	}, [loginEmail]);

	// Keep whatsappE164 derived as the user types/selects
	useEffect(() => {
		const derived = buildWhatsAppE164(values.whatsappCountry, values.whatsappNumber);
		setValues((v) => {
			if (v.whatsappE164 === derived) return v;
			return { ...v, whatsappE164: derived };
		});
	}, [values.whatsappCountry, values.whatsappNumber]);

	const handleSubmit = useCallback(
		async (e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault();

			if (!userId) {
				setError(t("messages.notAuthenticated"));
				return;
			}

			setSubmitting(true);
			setError(null);
			setSuccess(null);

			try {
				const preferred = values.preferredContactMethod;

				const contactEmail = normalizeTrim(values.contactEmail);
				const telegramUsername = normalizeTrim(values.telegramUsername);
				const whatsappE164 = buildWhatsAppE164(values.whatsappCountry, values.whatsappNumber);
				// Store the localized country NAME, not the ISO code.
				// Falls back to the raw value when it's legacy free-text (not in the ISO list).
				const citizenshipRaw = values.citizenship.trim();
				const citizenshipName = (() => {
					if (!citizenshipRaw) return "";
					const code = citizenshipRaw.toUpperCase();
					const isIso = (ISO_3166_ALPHA2_ALL as readonly string[]).includes(code);
					if (!isIso) return citizenshipRaw; // legacy free-text, keep as-is
					return regionNames.of(code) ?? citizenshipRaw;
				})();

				// Light UI checks (DB is final gate)
				if (preferred === "email") {
					if (!contactEmail || !isValidEmailFormat(contactEmail)) {
						setError(t("messages.contactEmailInvalid"));
						setSubmitting(false);
						return;
					}
				}

				if (preferred === "telegram") {
					if (!telegramUsername || !isValidTelegramUsernameFormat(telegramUsername)) {
						setError(t("messages.telegramInvalid"));
						setSubmitting(false);
						return;
					}
				}

				if (preferred === "whatsapp") {
					if (!whatsappE164) {
						setError(t("messages.whatsappInvalid"));
						setSubmitting(false);
						return;
					}
				}

				if (isPassportExpiringSoon(values.passportExpiry)) {
					setError(t("messages.passportExpiringSoon"));
					setSubmitting(false);
					return;
				}				

				const payload = {
					user_id: userId,

					first_name: values.firstName.trim(),
					middle_name: values.middleName.trim() || null,
					last_name: values.lastName.trim(),

					date_of_birth: values.dateOfBirth || null,

					// Store ISO2 where possible; legacy free-text still supported.
					citizenship_country: citizenshipName || null,
					city_country: values.cityCountry.trim() || null,
					marital_status: values.maritalStatus || null,

					preferred_contact_method: preferred || null,
					contact_email: contactEmail || null,
					telegram_username: telegramUsername || null,
					whatsapp_e164: whatsappE164 || null,

					family_composition: values.familyComposition.trim() || null,
					income_over_2000: values.income2000plus || "unspecified",
					income_source: values.incomeSource.trim() || null,

					been_to_sa: values.beenToSa || "unspecified",
					first_entry_sa: values.firstEntrySa.trim() || null,
					current_location: values.currentLocation.trim() || null,
					current_visa_status: values.currentVisa.trim() || null,
					visa_refusals: values.visaRefusals || "unspecified",

					passport_expiry: values.passportExpiry || null,
					visit_purpose: values.visitPurpose.trim() || null,

					english_level: values.englishLevel || "basic",
					need_language_school: values.needLanguageSchool || "unspecified",
				};

				if (isDirty) {
					const { error } = await supabase.from("client_profiles").upsert(payload, { onConflict: "user_id" });

					if (error) {
						console.error("[ClientProfileIntake] Upsert error:", error);
						setError(t("messages.saveFailed"));
						setSubmitting(false);
						return;
					}
				}

				const savedValues: ProfileFormValues = {
					...values,

					firstName: values.firstName.trim(),
					middleName: values.middleName.trim(),
					lastName: values.lastName.trim(),

					citizenship: values.citizenship.trim(),
					cityCountry: values.cityCountry.trim(),

					contactEmail,
					telegramUsername,

					whatsappNumber: values.whatsappNumber.trim(),
					whatsappE164,

					familyComposition: values.familyComposition.trim(),
					incomeSource: values.incomeSource.trim(),

					firstEntrySa: values.firstEntrySa.trim(),
					currentLocation: values.currentLocation.trim(),
					currentVisa: values.currentVisa.trim(),

					visitPurpose: values.visitPurpose.trim(),

					income2000plus: values.income2000plus || "unspecified",
					beenToSa: values.beenToSa || "unspecified",
					visaRefusals: values.visaRefusals || "unspecified",
					englishLevel: values.englishLevel || "basic",
					needLanguageSchool: values.needLanguageSchool || "unspecified",
				};

				setValues(savedValues);
				initialSnapshotRef.current = buildComparableSnapshot(savedValues);

				// Once intake is complete, keep the regular editable profile form visible.
				// Saving edits must not restart or display the wizard again.
				if (isCompleted) {
					setSuccess(t("messages.saveSuccess"));
					return;
				}

				const nextStep = currentStep < 5 ? currentStep + 1 : 5;
				const completing = currentStep === 5;
				const { error: progressSaveError } = await supabase
					.from("client_profile_intake_progress")
					.upsert(
						{
							user_id: userId,
							current_step: nextStep,
							has_started: true,
							is_completed: completing,
							updated_at: new Date().toISOString(),
						},
						{ onConflict: "user_id" },
					);

				if (progressSaveError) {
					console.error("[ClientProfileIntake] Failed to save wizard progress:", progressSaveError);
					setError(t("messages.progressSaveFailed"));
					return;
				}

				if (completing) {
					setIsCompleted(true);
					setSuccess(t("wizard.completed"));
					router.push(`/${locale}${siteConfig.clientDashboardPath}`);
					router.refresh();
					return;
				} else {
					setCurrentStep(nextStep);
				}
			} catch (err) {
				console.error("[ClientProfileIntake] Unexpected error:", err);
				setError(t("messages.saveFailed"));
			} finally {
				setSubmitting(false);
			}
		},
		[currentStep, isCompleted, isDirty, t, userId, values],
	);

	const beginWizard = useCallback(async () => {
		if (!userId) {
			setError(t("messages.notAuthenticated"));
			return;
		}
		setSubmitting(true);
		setError(null);
		try {
			const { error } = await supabase
				.from("client_profile_intake_progress")
				.upsert(
					{ user_id: userId, current_step: currentStep, has_started: true, is_completed: false, updated_at: new Date().toISOString() },
					{ onConflict: "user_id" },
				);
			if (error) throw error;
			setHasStarted(true);
			setIsCompleted(false);
		} catch (err) {
			console.error("[ClientProfileIntake] Failed to start wizard:", err);
			setError(t("messages.progressSaveFailed"));
		} finally {
			setSubmitting(false);
		}
	}, [currentStep, t, userId]);

	const goToPreviousStep = useCallback(async () => {
		if (!userId || currentStep <= 0 || isSubmitting) return;
		const previousStep = currentStep - 1;
		setSubmitting(true);
		setError(null);
		try {
			const { error } = await supabase
				.from("client_profile_intake_progress")
				.upsert(
					{ user_id: userId, current_step: previousStep, has_started: true, is_completed: false, updated_at: new Date().toISOString() },
					{ onConflict: "user_id" },
				);
			if (error) throw error;
			setCurrentStep(previousStep);
			setIsCompleted(false);
			setError(null);
		} catch (err) {
			console.error("[ClientProfileIntake] Failed to update wizard step:", err);
			setError(t("messages.progressSaveFailed"));
		} finally {
			setSubmitting(false);
		}
	}, [currentStep, isSubmitting, t, userId]);

	const showEmail = values.preferredContactMethod === "email";
	const showTelegram = values.preferredContactMethod === "telegram";
	const showWhatsApp = values.preferredContactMethod === "whatsapp";

	return (
		<PageShell>
			{/* Global Hero Shell (LOCKED): matches “news” sizing + centering */}
			<header className="hero-shell">
				<div className="hero-inner">
					<h1 className="hero-title">{t("headingProfile")}</h1>
					<p className="hero-subtitle">{t("subheadingProfile")}</p>
					<p className="hero-desc">{t("detailsProfile")}</p>
				</div>
			</header>

			<MainColumn>
				<div className={styles.topActions}>
					<Link href={siteConfig.clientDashboardPath} className="button button-ghost">
						<span aria-hidden="true">{tGlobal("Common.symbols.arrowLeft")}</span>
						{tGlobal("header.actions.backToDashboard")}
					</Link>

					<Link href={siteConfig.changePasswordPath} className="button button-primary">
						{tGlobal("header.actions.changePassword")}
						<span aria-hidden="true">{tGlobal("Common.symbols.arrowRight")}</span>
					</Link>
				</div>

				<form className={`stack ${styles.form}`} onSubmit={handleSubmit}>
					<div className={!hasLoadedIntakeState ? undefined : isCompleted ? styles.completedSections : `surface-soft ${styles.card}`}>					
					{!hasLoadedIntakeState ? (
					    <section className={`surface-soft ${styles.section}`} aria-busy="true">
					        <p className="text-m text-muted">{t("actions.loading")}</p>
					    </section>
					) : (
					    <>	
						{!hasStarted ? (
							<section className={`surface-soft ${styles.section} ${styles.readiness}`}>
								<h2 className="panel-title">{t("wizard.readinessTitle")}</h2>
								<p className="text-m text-muted">{t("wizard.readinessDescription")}</p>
								<ul className="text">
									<li>{t("wizard.readinessPassport")}</li>
									<li>{t("wizard.readinessVisa")}</li>
								</ul>
								{formError ? <div className="alert badge-caution" role="alert" aria-live="polite">{formError}</div> : null}
								<div className={styles.actions}>
									<button type="button" className="button button-primary" onClick={beginWizard} disabled={disableAll}>
										{isSubmitting ? t("actions.saving") : t("wizard.readyButton")}
									</button>
									<Link href={siteConfig.clientDashboardPath} className="button button-ghost">
										{t("wizard.notNowButton")}
									</Link>
								</div>
							</section>
						) : !isCompleted ? (
							<>
								<div className={styles.stepper} aria-label={t("wizard.progressLabel")}>
									<div className={styles.stepperHead}>
										<span className="form-label" aria-current="step">
											{t("wizard.stepLabel", { current: currentStep + 1, total: 6 })}
										</span>
										<strong className="text-md text-strong">{t(CLIENT_PROFILE_SECTIONS[currentStep].titleKey)}</strong>
									</div>
									<div className={`wizard-progress ${styles.stepperProgress}`} role="progressbar" aria-valuemin={1} aria-valuemax={6} aria-valuenow={currentStep + 1}>
										{Array.from({ length: 6 }, (_, index) => (
											<div key={index} className={`wizard-progressSegment ${currentStep >= index ? "isFilled" : ""}`} />
										))}
									</div>
								</div>
							</>
						) : null}
					    </>
					)}
					{hasLoadedIntakeState && (isCompleted || (hasStarted && currentStep === 0)) && (
					
					<section className={`${isCompleted ? "surface-soft " : ""}${styles.section}`}>
						<div className="stack" style={{ gap: "var(--space-2)" }}>
							<h2 className="panel-title">{t(CLIENT_PROFILE_SECTIONS[0].titleKey)}</h2>
							<p className="text-sm text-muted" style={{ margin: 0 }}>
								{t(CLIENT_PROFILE_SECTIONS[0].subtitleKey)}
							</p>
						</div>

						<div className={styles.grid2}>
							<div className="stack" style={{ gap: "var(--space-1)" }}>
								<label className="form-label" htmlFor="firstName">
									{t("fields.firstName.label")}
								</label>
								<input
									id="firstName"
									name="firstName"
									type="text"
									className="form-control"
									placeholder={t("fields.firstName.placeholder")}
									value={values.firstName}
									onChange={onChange}
									disabled={disableAll}
									required
								/>
							</div>

							<div className="stack" style={{ gap: "var(--space-1)" }}>
								<label className="form-label" htmlFor="middleName">
									{t("fields.middleName.label")}
								</label>
								<input
									id="middleName"
									name="middleName"
									type="text"
									className="form-control"
									placeholder={t("fields.middleName.placeholder")}
									value={values.middleName}
									onChange={onChange}
									disabled={disableAll}
								/>
							</div>

							<div className="stack" style={{ gap: "var(--space-1)" }}>
								<label className="form-label" htmlFor="lastName">
									{t("fields.lastName.label")}
								</label>
								<input
									id="lastName"
									name="lastName"
									type="text"
									className="form-control"
									placeholder={t("fields.lastName.placeholder")}
									value={values.lastName}
									onChange={onChange}
									disabled={disableAll}
									required
								/>
							</div>

							<div className="stack" style={{ gap: "var(--space-1)" }}>
								<label className="form-label" htmlFor="citizenship">
									{t("fields.citizenship.label")}
								</label>
								<select
									id="citizenship"
									name="citizenship"
									className="form-control"
									value={values.citizenship}
									onChange={onChange}
									disabled={disableAll}
									required
								>
									<option value="">{t("fields.citizenship.placeholder")}</option>
									{citizenshipOptions.map((o) => (
										<option key={o.key} value={o.value}>
											{o.label}
										</option>
									))}
								</select>
							</div>

							<div className="stack" style={{ gap: "var(--space-1)" }}>
								<label className="form-label" htmlFor="dateOfBirth">
									{t("fields.dateOfBirth.label")}
								</label>
								<input
									id="dateOfBirth"
									name="dateOfBirth"
									type="date"
									className="form-control"
									value={values.dateOfBirth}
									onChange={onChange}
									disabled={disableAll}
									required
								/>
							</div>

							<div className="stack" style={{ gap: "var(--space-1)" }}>
								<label className="form-label" htmlFor="maritalStatus">
									{t("fields.maritalStatus.label")}
								</label>
								<select
									id="maritalStatus"
									name="maritalStatus"
									className="form-control"
									value={values.maritalStatus}
									onChange={onChange}
									disabled={disableAll}
									required
								>
									<option value="">{t("fields.maritalStatus.placeholder")}</option>
									{MARITAL_STATUS_OPTIONS.map((o) => (
										<option key={o.value} value={o.value}>
											{t(o.labelKey)}
										</option>
									))}
								</select>
							</div>
						</div>
					</section>
					)}

					{hasLoadedIntakeState && (isCompleted || (hasStarted && currentStep === 1)) && (
					
					<section className={`${isCompleted ? "surface-soft " : ""}${styles.section}`}>
						<h2 className="panel-title">{t(CLIENT_PROFILE_SECTIONS[1].titleKey)}</h2>

						<div className={styles.grid2}>
							<div className={`stack ${styles.full}`} style={{ gap: "var(--space-1)" }}>
								<label className="form-label" htmlFor="cityCountry">
									{t("fields.cityCountry.label")}
								</label>
								<input
									id="cityCountry"
									name="cityCountry"
									type="text"
									className="form-control"
									placeholder={t("fields.cityCountry.placeholder")}
									value={values.cityCountry}
									onChange={onChange}
									disabled={disableAll}
									required
								/>
							</div>
						</div>

						<div className={styles.divider} />

						<div className={styles.grid2}>
							<div className={`stack ${styles.full}`} style={{ gap: "var(--space-1)" }}>
								<label className="form-label" htmlFor="preferredContactMethod">
									{t("fields.preferredContactMethod.label")}
								</label>
								<select
									id="preferredContactMethod"
									name="preferredContactMethod"
									className="form-control"
									value={values.preferredContactMethod}
									onChange={(e) => {
										onChange(e);

										const next = e.currentTarget.value as PreferredContactMethod | "";
										setValues((v) => {
											if (next !== "email") return { ...v, useLoginEmail: false };
											return v;
										});
									}}
									disabled={disableAll}
									required
								>
									<option value="">{t("fields.preferredContactMethod.placeholder")}</option>
									{PREFERRED_CONTACT_METHOD_OPTIONS.map((o) => (
										<option key={o.value} value={o.value}>
											{t(o.labelKey)}
										</option>
									))}
								</select>
							</div>

							{showEmail ? (
								<div className={`stack ${styles.full}`} style={{ gap: "var(--space-2)" }}>
									<div className="stack" style={{ gap: "var(--space-1)" }}>
										<label className="form-label" htmlFor="contactEmail">
											{t("fields.contactEmail.label")}
										</label>
										<input
											id="contactEmail"
											name="contactEmail"
											type="email"
											className="form-control"
											placeholder={t("fields.contactEmail.placeholder")}
											value={values.contactEmail}
											onChange={onChange}
											disabled={disableAll || values.useLoginEmail}
											required={showEmail}
										/>
										<p className="text-sm text-muted" style={{ margin: 0 }}>
											{t("fields.contactEmail.hint")}
										</p>
									</div>

									<div className="stack" style={{ gap: "var(--space-1)" }}>
										<span className="form-label">
											{t("fields.contactEmail.useLoginEmail.label")}
										</span>

										<label
											htmlFor="useLoginEmail"
											className={styles.checkRow}
											style={{
												cursor:
													disableAll || loginEmail.length === 0
														? "not-allowed"
														: "pointer",
											}}
										>
											<input
												id="useLoginEmail"
												name="useLoginEmail"
												type="checkbox"
												checked={values.useLoginEmail}
												onChange={onToggleUseLoginEmail}
												disabled={disableAll || loginEmail.length === 0}
												required={showEmail}
											/>
											<span className="text-sm text-muted">
												{loginEmail
													? t("fields.contactEmail.useLoginEmail.caption", { email: loginEmail })
													: t("fields.contactEmail.useLoginEmail.noEmail")}
											</span>
										</label>
									</div>
								</div>
							) : null}

							{showTelegram ? (
								<div className={`stack ${styles.full}`} style={{ gap: "var(--space-1)" }}>
									<label className="form-label" htmlFor="telegramUsername">
										{t("fields.telegramUsername.label")}
									</label>
									<input
										id="telegramUsername"
										name="telegramUsername"
										type="text"
										className="form-control"
										placeholder={t("fields.telegramUsername.placeholder")}
										value={values.telegramUsername}
										onChange={onChange}
										disabled={disableAll}
										required={showTelegram}
									/>
									<p className="text-sm text-muted" style={{ margin: 0 }}>
										{t("fields.telegramUsername.hint")}
									</p>
								</div>
							) : null}

							{showWhatsApp ? (
								<>
									<div className="stack" style={{ gap: "var(--space-1)" }}>
										<label className="form-label" htmlFor="whatsappCountry">
											{t("fields.whatsappCountry.label")}
										</label>
										<select
											id="whatsappCountry"
											name="whatsappCountry"
											className="form-control"
											value={values.whatsappCountry}
											onChange={onChange}
											disabled={disableAll}
											required={showWhatsApp}
										>
											{whatsappCountryOptions.map((o) => (
												<option key={o.value} value={o.value}>
													{o.label}
												</option>
											))}
										</select>
									</div>

									<div className="stack" style={{ gap: "var(--space-1)" }}>
										<label className="form-label" htmlFor="whatsappNumber">
											{t("fields.whatsappNumber.label")}
										</label>
										<input
											id="whatsappNumber"
											name="whatsappNumber"
											type="tel"
											className="form-control"
											placeholder={t("fields.whatsappNumber.placeholder")}
											value={values.whatsappNumber}
											onChange={onChange}
											disabled={disableAll}
											required={showWhatsApp}
										/>
										<p className="text-sm text-muted" style={{ margin: 0 }}>
											{t("fields.whatsappNumber.hint")}
										</p>

										<p className="text-xs text-muted" style={{ margin: 0 }}>
											{t("fields.whatsappE164.preview", { e164: values.whatsappE164 || na })}
										</p>
									</div>
								</>
							) : null}
						</div>
					</section>
					)}

					{hasLoadedIntakeState && (isCompleted || (hasStarted && currentStep === 2)) && (
					
					<section className={`${isCompleted ? "surface-soft " : ""}${styles.section}`}>
						<h2 className="panel-title">{t(CLIENT_PROFILE_SECTIONS[2].titleKey)}</h2>

						<div className={styles.grid2}>
							<div className={`stack ${styles.full}`} style={{ gap: "var(--space-1)" }}>
								<label className="form-label" htmlFor="familyComposition">
									{t("fields.familyComposition.label")}
								</label>
								<textarea
									id="familyComposition"
									name="familyComposition"
									className="form-control form-control-note"
									placeholder={t("fields.familyComposition.placeholder")}
									value={values.familyComposition}
									onChange={onChange}
									disabled={disableAll}
									required
								/>
							</div>

							<div className="stack" style={{ gap: "var(--space-1)" }}>
								<label className="form-label" htmlFor="income2000plus">
									{t("fields.income2000plus.label")}
								</label>
								<select
									id="income2000plus"
									name="income2000plus"
									className="form-control"
									value={values.income2000plus}
									onChange={onChange}
									disabled={disableAll}
									required
								>
									<option value="">{t("fields.income2000plus.placeholder")}</option>
									{YES_NO_UNSPECIFIED_OPTIONS.map((o) => (
										<option key={o.value} value={o.value}>
											{t(`fields.income2000plus.options.${o.value}`)}
										</option>
									))}
								</select>
							</div>

							<div className="stack" style={{ gap: "var(--space-1)" }}>
								<label className="form-label" htmlFor="incomeSource">
									{t("fields.incomeSource.label")}
								</label>
								<input
									id="incomeSource"
									name="incomeSource"
									type="text"
									className="form-control"
									placeholder={t("fields.incomeSource.placeholder")}
									value={values.incomeSource}
									onChange={onChange}
									disabled={disableAll}
									required
								/>
								<p className="text-sm text-muted" style={{ margin: 0 }}>
									{t("fields.incomeSource.hint")}
								</p>
							</div>
						</div>
					</section>
					)}

					{hasLoadedIntakeState && (isCompleted || (hasStarted && currentStep === 3)) && (
					
					<section className={`${isCompleted ? "surface-soft " : ""}${styles.section}`}>
						<h2 className="panel-title">{t(CLIENT_PROFILE_SECTIONS[3].titleKey)}</h2>

						<div className={styles.grid2}>
							<div className="stack" style={{ gap: "var(--space-1)" }}>
								<label className="form-label" htmlFor="beenToSa">
									{t("fields.beenToSa.label")}
								</label>
								<select
									id="beenToSa"
									name="beenToSa"
									className="form-control"
									value={values.beenToSa}
									onChange={onChange}
									disabled={disableAll}
									required
								>
									<option value="">{t("fields.beenToSa.placeholder")}</option>
									{YES_NO_UNSPECIFIED_OPTIONS.filter((o) => o.value !== "unspecified").map((o) => (
										<option key={o.value} value={o.value}>
											{t(`fields.beenToSa.options.${o.value}`)}
										</option>
									))}
								</select>
							</div>

							<div className="stack" style={{ gap: "var(--space-1)" }}>
								<label className="form-label" htmlFor="firstEntrySa">
									{t("fields.firstEntrySa.label")}
								</label>
								<input
									id="firstEntrySa"
									name="firstEntrySa"
									type="text"
									className="form-control"
									placeholder={t("fields.firstEntrySa.placeholder")}
									value={values.firstEntrySa}
									onChange={onChange}
									disabled={disableAll}
								/>
							</div>

							<div className={`stack ${styles.full}`} style={{ gap: "var(--space-1)" }}>
								<label className="form-label" htmlFor="currentLocation">
									{t("fields.currentLocation.label")}
								</label>
								<input
									id="currentLocation"
									name="currentLocation"
									type="text"
									className="form-control"
									placeholder={t("fields.currentLocation.placeholder")}
									value={values.currentLocation}
									onChange={onChange}
									disabled={disableAll}
									required
								/>
							</div>

							<div className={`stack ${styles.full}`} style={{ gap: "var(--space-1)" }}>
								<label className="form-label" htmlFor="currentVisa">
									{t("fields.currentVisa.label")}
								</label>
								<textarea
									id="currentVisa"
									name="currentVisa"
									className="form-control form-control-note"
									placeholder={t("fields.currentVisa.placeholder")}
									value={values.currentVisa}
									onChange={onChange}
									disabled={disableAll}
								/>
							</div>

							<div className="stack" style={{ gap: "var(--space-1)" }}>
								<label className="form-label" htmlFor="visaRefusals">
									{t("fields.visaRefusals.label")}
								</label>
								<select
									id="visaRefusals"
									name="visaRefusals"
									className="form-control"
									value={values.visaRefusals}
									onChange={onChange}
									disabled={disableAll}
									required
								>
									<option value="">{t("fields.visaRefusals.placeholder")}</option>
									{YES_NO_UNSPECIFIED_OPTIONS.filter((o) => o.value !== "unspecified").map((o) => (
										<option key={o.value} value={o.value}>
											{t(`fields.beenToSa.options.${o.value}`)}
										</option>
									))}
								</select>
							</div>
						</div>
					</section>
					)}

					{hasLoadedIntakeState && (isCompleted || (hasStarted && currentStep === 4)) && (
					
					<section className={`${isCompleted ? "surface-soft " : ""}${styles.section}`}>
						<h2 className="panel-title">{t(CLIENT_PROFILE_SECTIONS[4].titleKey)}</h2>

						<div className={styles.grid2}>
							<div className="stack" style={{ gap: "var(--space-1)" }}>
								<label className="form-label" htmlFor="passportExpiry">
									{t("fields.passportExpiry.label")}
								</label>
								<input
									id="passportExpiry"
									name="passportExpiry"
									type="date"
									className="form-control"
									value={values.passportExpiry}
									onChange={onChange}
									disabled={disableAll}
									required
								/>
							</div>

							<div className={`stack ${styles.full}`} style={{ gap: "var(--space-1)" }}>
								<label className="form-label" htmlFor="visitPurpose">
									{t("fields.visitPurpose.label")}
								</label>
								<textarea
									id="visitPurpose"
									name="visitPurpose"
									className="form-control form-control-note"
									placeholder={t("fields.visitPurpose.placeholder")}
									value={values.visitPurpose}
									onChange={onChange}
									disabled={disableAll}
									required
								/>
							</div>
						</div>
					</section>
					)}

					{hasLoadedIntakeState && (isCompleted || (hasStarted && currentStep === 5)) && (
					
					<section className={`${isCompleted ? "surface-soft " : ""}${styles.section}`}>
						<h2 className="panel-title">{t(CLIENT_PROFILE_SECTIONS[5].titleKey)}</h2>

						<div className={styles.grid2}>
							<div className="stack" style={{ gap: "var(--space-1)" }}>
								<label className="form-label" htmlFor="englishLevel">
									{t("fields.englishLevel.label")}
								</label>
								<select
									id="englishLevel"
									name="englishLevel"
									className="form-control"
									value={values.englishLevel}
									onChange={onChange}
									disabled={disableAll}
									required
								>
									<option value="">{t("fields.englishLevel.placeholder")}</option>
									{ENGLISH_LEVEL_OPTIONS.map((o) => (
										<option key={o.value} value={o.value}>
											{t(o.labelKey)}
										</option>
									))}
								</select>
							</div>

							<div className="stack" style={{ gap: "var(--space-1)" }}>
								<label className="form-label" htmlFor="needLanguageSchool">
									{t("fields.needLanguageSchool.label")}
								</label>
								<select
									id="needLanguageSchool"
									name="needLanguageSchool"
									className="form-control"
									value={values.needLanguageSchool}
									onChange={onChange}
									disabled={disableAll}
									required
								>
									<option value="">{t("fields.needLanguageSchool.placeholder")}</option>
									{YES_NO_UNSPECIFIED_OPTIONS.map((o) => (
										<option key={o.value} value={o.value}>
											{t(`fields.needLanguageSchool.options.${o.value}`)}
										</option>
									))}
								</select>
							</div>
						</div>
					</section>
					)}

					{hasLoadedIntakeState && hasStarted ? (
						<div className={styles.actions}>
							{formSuccess ? <div className="alert badge-success" role="status" aria-live="polite">{formSuccess}</div> : null}
							{formError ? <div className="alert badge-caution" role="alert" aria-live="polite">{formError}</div> : null}
							{!isCompleted ? (
								<div className={styles.wizardActions}>
									<div className={styles.actionsLeft}>
										{currentStep > 0 ? <button type="button" className="button button-secondary" onClick={goToPreviousStep} disabled={disableAll}>{t("wizard.backButton")}</button> : null}
									</div>
									<div className={styles.actionsRight}>
										<button type="submit" className="button button-primary" disabled={disableAll}>
											{isLoading ? t("actions.loading") : isSubmitting ? t("actions.saving") : currentStep === 5 ? t("wizard.finishButton") : t("wizard.continueButton")}
										</button>
									</div>
								</div>
							) : (
								<button type="submit" className={`button button-primary ${styles.saveButton}`} disabled={disableAll}>
									{isLoading ? t("actions.loading") : isSubmitting ? t("actions.saving") : t("actions.save")}
								</button>
							)}
							<p className={styles.footer}>
								{t("footer.goToDashboardPrefix")} {" "}
								<Link href={siteConfig.clientDashboardPath} className={styles.footerLink}><strong>{t("footer.goToDashboardLink")}</strong></Link>
							</p>
						</div>
					) : null}
					</div>
				</form>
			</MainColumn>
		</PageShell>
	);
}
