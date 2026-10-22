/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/signup/page.tsx
SCOPE: Signup (client-side). Layout refactor to GLOBAL PRIMITIVES only. Logic unchanged.
STATUS: UNLOCKED (lock after approved)
NOTES:
- Hero typography order MUST be: hero-title, hero-subtitle, hero-desc.
- No hardcoded user-facing strings; no i18n fallbacks.
- Buttons must use global button classes (button-primary / button-ghost).
- No console logging (treat auth as sensitive).
- Uses global hero primitive: PageWithStickyHero (sticky image overlay logic).
AUDIT:
- FIXED: `siteConfig.clientFormPath` reference (not present in siteConfig) caused runtime/compile break; replaced with canonical client “account/profile step” route (`siteConfig.clientAccountPath`) and locale-prefixed for router.push().
- KEPT: all auth logic + retry behavior unchanged (only route constant corrected).
- NO: new deps, no logging, no behavioral snowballs.
*/

"use client";

import type React from "react";
import { useCallback, useMemo, useState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/config/siteConfig";
import { supabase } from "@/lib/supabaseClient";

import type { CSSProperties } from "react";

import styles from "@/styles/auth.module.css";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons/AuthEyeIcons";

/* --- GLOBAL HERO PRIMITIVE (layout only) --------------------------------- */
import { PageWithStickyHero } from "@/components/ui/hero/PageWithStickyHero";
/* ------------------------------------------------------------------------- */

type FormState = {
	isSubmitting: boolean;
	formError: string | null;
	formSuccess: string | null;
	lastSubmittedEmail: string | null;
	canResendConfirm: boolean;
};

function prefixLocale(locale: string, path: string) {
	if (!path) return `/${locale}`;
	if (path.startsWith(`/${locale}/`) || path === `/${locale}`) return path;
	if (!path.startsWith("/")) return `/${locale}/${path}`;
	return `/${locale}${path}`;
}

function safeOrigin(): string | null {
	if (typeof window === "undefined") return null;
	if (!window.location?.origin) return null;
	return window.location.origin;
}

export default function SignupCredentialsPage() {
	const t = useTranslations("Signup");
	const tGlobal = useTranslations("GlobalForm");

	const locale = useLocale();
	const router = useRouter();

	const [isPasswordVisible, setIsPasswordVisible] = useState(false);
	const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);

	const [state, setState] = useState<FormState>({
		isSubmitting: false,
		formError: null,
		formSuccess: null,
		lastSubmittedEmail: null,
		canResendConfirm: false,
	});
	
	const [isResending, setIsResending] = useState(false);

	const { isSubmitting, formError, formSuccess, lastSubmittedEmail, canResendConfirm } = state;

	const [authBanner, setAuthBanner] = useState<"code_expired" | "callback_failed" | "invalid_link" | null>(null);

	const setError = useCallback(
		(msg: string) => {
			setState((s) => ({
				...s,
				formError: msg,
				formSuccess: null,
			}));
		},
		[],
	);

	const setSuccess = useCallback(
		(msg: string) => {
			setState((s) => ({
				...s,
				formSuccess: msg,
				formError: null,
			}));
		},
		[],
	);

	const setSubmitting = useCallback((v: boolean) => {
		setState((s) => ({ ...s, isSubmitting: v }));
	}, []);

	const loginHref = useMemo(() => prefixLocale(locale, siteConfig.loginPath), [locale]);

	// FIX: siteConfig.clientFormPath doesn't exist; use your canonical client account/profile step route.
	const profileStepHref = useMemo(
		() => prefixLocale(locale, siteConfig.clientAccountPath),
		[locale],
	);

	const emailRedirectTo = useMemo(() => {
		const origin = safeOrigin();
		if (!origin) return null;

		// IMPORTANT:
		// This must be allow-listed in Supabase Auth → Redirect URLs.
		// Route should exist in your app and handle Supabase "code" flows.
		return `${origin}${prefixLocale(locale, "/auth/callback")}`;
	}, [locale]);
	
/* -------------------------------------------------------------------------- */
/* Auth callback banners (expired link / invalid link)                         */
/* -------------------------------------------------------------------------- */

useEffect(() => {
	if (typeof window === "undefined") return;

	const url = new URL(window.location.href);

	const errorCode =
		url.searchParams.get("error_code") ||
		url.hash.match(/(?:^|&)error_code=([^&]+)/)?.[1] ||
		"";

	const decoded = decodeURIComponent(errorCode || "").trim().toLowerCase();

	if (decoded === "otp_expired") {
		setAuthBanner("code_expired");
		return;
	}

	// Any other auth callback error
	const hasError =
		Boolean(url.searchParams.get("error")) ||
		Boolean(url.searchParams.get("error_description")) ||
		Boolean(url.hash.includes("error="));

	if (hasError) {
		setAuthBanner("callback_failed");
	}
}, []);


	/* -------------------------------------------------------------------------- */
	/* Network Timeout Retry Helper - Supabase DB Cold Start                      */
	/* -------------------------------------------------------------------------- */
	
	async function resendConfirmEmail(email: string) {
		if (!emailRedirectTo) throw new Error("missing_redirect");
	
		await supabase.auth.resend({
			type: "signup",
			email,
			options: { emailRedirectTo },
		});
	}

	async function signUpWithRetry(email: string, password: string) {
		const signUpArgs = {
			email,
			password,
			options: {
				// Used by Supabase email templates for language branching.
				// Accessible as: {{ .Data.language }}
				data: {
					language: locale,
				},
				// Ensures the confirmation link brings the user back to the correct locale.
				// Must be in Supabase redirect allow-list.
				...(emailRedirectTo ? { emailRedirectTo } : {}),
			},
		} as const;

		const result = await supabase.auth.signUp(signUpArgs);

		if (!result.error) return result;

		const msg = result.error.message.toLowerCase();
		const isTransient =
			msg.includes("fetch") ||
			msg.includes("network") ||
			msg.includes("timeout") ||
			msg.includes("failed to fetch");

		if (!isTransient) {
			return result;
		}

		// Single retry for cold DB wake-up
		await new Promise((r) => setTimeout(r, 600));

		return await supabase.auth.signUp(signUpArgs);
	}

	const handleSubmit = useCallback(
		async (e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault();

			if (isSubmitting) return;

			setSubmitting(true);
			setState((s) => ({
				...s,
				formError: null,
				formSuccess: null,
				lastSubmittedEmail: null,
				canResendConfirm: false,
			}));

			const form = e.currentTarget;
			const formData = new FormData(form);

			const email = (formData.get("email") || "").toString().trim();
			const password = (formData.get("password") || "").toString();
			const confirmPassword = (formData.get("confirmPassword") || "").toString();

			if (!email || !password) {
				setError(t("messages.missingEmailOrPassword"));
				setSubmitting(false);
				return;
			}

			const passwordMeetsRequirements =
				password.length >= 8 &&
				/[A-Z]/.test(password) &&
				/[a-z]/.test(password) &&
				/[0-9]/.test(password) &&
				/[^A-Za-z0-9]/.test(password);

			if (!passwordMeetsRequirements) {
				setError(t("messages.passwordRequirements"));
				setSubmitting(false);
				return;
			}

			if (password !== confirmPassword) {
				setError(t("messages.passwordMismatch"));
				setSubmitting(false);
				return;
			}

			try {
				const { data: signUpData, error: signUpError } = await signUpWithRetry(email, password);

				if (signUpError?.message === "User already registered") {
					setState((s) => ({ ...s, lastSubmittedEmail: email }));
					setError(t("messages.userAlreadyRegistered"));
					return;
				}

				const hasSession = Boolean(signUpData.session);

				// Confirm-signup flow: if no session is returned, Supabase requires email confirmation.
				if (!hasSession) {
					setState((s) => ({
						...s,
						lastSubmittedEmail: email,
						canResendConfirm: true,
					}));

					setSuccess(t("messages.signupConfirmSuccess", { email }));
					return;
				}

				// Immediate session flow (email confirmation disabled / not required)
				//
				// NOTE (FUTURE): If you re-enable email confirmation in Supabase,
				// you’ll need to re-enable the “resend confirmation” UX here (and/or on login)
				// because signup may return no session and the user must confirm via email first.
				setSuccess(t("messages.signupSuccess"));
				
				try {
					// Ensure session cookie/state is fully established before we navigate
					await supabase.auth.refreshSession();
				} catch {
					// No console logging (auth-sensitive). Best-effort only.
				}
				
				window.setTimeout(() => {
					// Use replace so the signup form isn't in back history
					router.replace(profileStepHref);
				
					// IMPORTANT: forces server components/layouts to re-render and re-read user,
					// which updates the Navbar "user" prop.
					router.refresh();
				}, 250);
				
			} catch {
				setError(t("messages.signupFailed"));
			} finally {
				setSubmitting(false);
			}
		},
		[
			isSubmitting,
			loginHref,
			profileStepHref,
			router,
			setError,
			setSubmitting,
			setSuccess,
			t,
			// signUpWithRetry closes over locale + emailRedirectTo via its scope
		],
	);

	const submitLabel = isSubmitting ? t("actions.submitting") : t("actions.submit");
	const showLabel = t("actions.showPassword");
	const hideLabel = t("actions.hidePassword");

	const backToLoginLabel = useMemo(() => {
		if (lastSubmittedEmail) return t("actions.backToLoginAfterConfirm");
		return tGlobal("header.actions.backToLogin");
	}, [lastSubmittedEmail, t, tGlobal]);

	return (
		<PageWithStickyHero
			imageSrc="/images/signup.jpg"
			overlap={false}
			title={t("heading")}
			subtitle={t("subheading")}
			description={t("description")}
			descriptionOnImageRole={true}
			style={
				{
					"--hero-anchor-x": "50%",
					"--hero-anchor-y": "50%",
					"--hero-x": "0px",
					"--hero-y": "0px",
					"--hero-x-mobile": "0px",
					"--hero-y-mobile": "0px",
					"--hero-height": "clamp(420px, 70svh, 820px)",
					"--hero-overlay-top": "0.40",
					"--hero-overlay-mid": "0.3",
					"--hero-overlay-bot": "0.1",
					"--hero-overlay-blur": "0px",
					"--hero-overlay-sat": "1.2",
				} as CSSProperties
			}
		>
			<div className={`${styles.formInline} ${styles.formInlineStart}`}>
				<Link href={siteConfig.loginPath} className="button button-ghost">
					<span aria-hidden="true">{tGlobal("Common.symbols.arrowLeft")}</span>
					{backToLoginLabel}
				</Link>
			</div>

			<div className={styles.authFormShell}>
				{authBanner === "code_expired" ? (
					<div className="alert badge-caution" role="alert" aria-live="polite">
						{t("messages.codeExpired")}
					</div>
				) : null}
				
				{authBanner === "callback_failed" ? (
					<div className="alert badge-caution" role="alert" aria-live="polite">
						{t("messages.callbackFailed")}
					</div>
				) : null}

				{formError ? (
					<div id="signup-error" className="alert badge-caution" role="alert" aria-live="polite">
						{formError}
					</div>
				) : null}

				{formSuccess ? (
					<div className="alert badge-success" role="status" aria-live="polite">
						{formSuccess}
					</div>
				) : null}
				
				{lastSubmittedEmail && canResendConfirm ? (
					<div className={`${styles.formInline} ${styles.formInlineStart}`}>
						<button
						type="button"
						className="button button-secondary"
						disabled={isResending}
						onClick={async () => {
							if (isResending) return;
					
							setIsResending(true);
							try {
							await resendConfirmEmail(lastSubmittedEmail);
							setSuccess(t("messages.resendConfirmSent"));
							} catch {
							setError(t("messages.resendConfirmFailed"));
							} finally {
							setIsResending(false);
							}
						}}
						>
						{isResending ? t("actions.resending") : t("actions.resendConfirm")}
						</button>
					</div>
				) : null}

				

				<form className={styles.authForm} onSubmit={handleSubmit} aria-busy={isSubmitting}>
					<fieldset className={styles.fieldsetReset} disabled={isSubmitting}>
						<div className={styles.formSection}>
							<div className={styles.formGrid}>
								<div className={styles.formField}>
									<label className={styles.fieldLabel} htmlFor="email">
										{t("fields.email.label")}
									</label>
									<input
										id="email"
										name="email"
										type="email"
										className={styles.fieldInput}
										placeholder={t("fields.email.placeholder")}
										autoComplete="email"
										required
										aria-describedby={formError ? "signup-error" : undefined}
									/>
								</div>

								<div className={styles.formField}>
									<label className={styles.fieldLabel} htmlFor="password">
										{t("fields.password.label")}
									</label>

									<div className={styles.passwordField}>
										<input
											id="password"
											name="password"
											type={isPasswordVisible ? "text" : "password"}
											className={styles.fieldInput}
											placeholder={t("fields.password.placeholder")}
											required
											autoComplete="new-password"
											aria-describedby={formError ? "signup-error" : undefined}
										/>

										<button
											type="button"
											className={styles.passwordToggle}
											onClick={() => setIsPasswordVisible((v) => !v)}
											aria-pressed={isPasswordVisible}
											aria-label={isPasswordVisible ? hideLabel : showLabel}
											title={isPasswordVisible ? hideLabel : showLabel}
										>
											{isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
										</button>
									</div>
								</div>

								<div className={styles.formField}>
									<label className={styles.fieldLabel} htmlFor="confirmPassword">
										{t("fields.confirmPassword.label")}
									</label>

									<div className={styles.passwordField}>
										<input
											id="confirmPassword"
											name="confirmPassword"
											type={isConfirmPasswordVisible ? "text" : "password"}
											className={styles.fieldInput}
											placeholder={t("fields.confirmPassword.placeholder")}
											required
											autoComplete="new-password"
											aria-describedby={formError ? "signup-error" : undefined}
										/>

										<button
											type="button"
											className={styles.passwordToggle}
											onClick={() => setIsConfirmPasswordVisible((v) => !v)}
											aria-pressed={isConfirmPasswordVisible}
											aria-label={isConfirmPasswordVisible ? hideLabel : showLabel}
											title={isConfirmPasswordVisible ? hideLabel : showLabel}
										>
											{isConfirmPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
										</button>
									</div>
								</div>
							</div>
						</div>

						<div className={styles.authActions}>
							<button
								type="submit"
								className="button button-primary"
								disabled={isSubmitting}
								aria-busy={isSubmitting}
							>
								<span className={styles.buttonInner}>
									{isSubmitting ? <span className={styles.spinner} aria-hidden="true" /> : null}
									<span className={styles.buttonLabel}>{submitLabel}</span>
								</span>
							</button>

							<p className={styles.authSecondaryText}>
								{t("footer.haveAccount")}{" "}
								<Link href={siteConfig.loginPath} className={styles.authLink}>
									{t("footer.loginLink")}
								</Link>
							</p>
						</div>
					</fieldset>
				</form>
			</div>
		</PageWithStickyHero>
	);
}
