/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/login/page.tsx
SCOPE: Login (client-side). Layout refactor to GLOBAL PRIMITIVES only. Logic unchanged.
STATUS: UNLOCKED (lock after approved)
NOTES:
- No hardcoded user-facing strings; no i18n fallbacks.
- No console logging (treat auth + links as sensitive).
- Uses global hero primitive: PageWithStickyHero (sticky image overlay logic).
AUDIT:
- FIXED: locale-dropping redirect after login. `router.push(targetPath)` used non-locale-prefixed paths (e.g. `/client/dashboard`), which can break i18n routing. Now uses `prefixLocale(locale, targetPath)` so it always navigates to `/${locale}/...`.
- KEPT: auth flow + retry logic unchanged; only routing correctness updated.
- NO: added logging, new deps, or behavior changes outside navigation.
*/

"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { supabase } from "@/lib/supabaseClient";
import { siteConfig } from "@/config/siteConfig";

import { EyeIcon, EyeOffIcon } from "@/components/ui/icons/AuthEyeIcons";

import styles from "@/styles/auth.module.css";

/* --- GLOBAL HERO PRIMITIVE (layout only) --------------------------------- */
import { PageWithStickyHero } from "@/components/ui/hero/PageWithStickyHero";
/* ------------------------------------------------------------------------- */

const SPINNER_DELAY_MS = 250;

function prefixLocale(locale: string, path: string) {
	if (!path) return `/${locale}`;
	if (path.startsWith(`/${locale}/`) || path === `/${locale}`) return path;
	if (!path.startsWith("/")) return `/${locale}/${path}`;
	return `/${locale}${path}`;
}

export default function LoginPage() {
	const t = useTranslations("Login");
	const tGlobal = useTranslations("GlobalForm");
	const locale = useLocale();
	const router = useRouter();

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showSpinner, setShowSpinner] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [formSuccess, setFormSuccess] = useState<string | null>(null);

	const [isPasswordVisible, setIsPasswordVisible] = useState(false);
	
	const [authBanner, setAuthBanner] = useState<"code_expired" | "callback_failed" | "invalid_link" | null>(null);

	const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
	
	const [emailValue, setEmailValue] = useState("");
	const [isResending, setIsResending] = useState(false);

	const spinnerTimerRef = useRef<number | null>(null);

	useEffect(() => {
		if (spinnerTimerRef.current) {
			window.clearTimeout(spinnerTimerRef.current);
			spinnerTimerRef.current = null;
		}

		if (isSubmitting) {
			setShowSpinner(false);
			spinnerTimerRef.current = window.setTimeout(() => {
				setShowSpinner(true);
			}, SPINNER_DELAY_MS);
			return;
		}

		setShowSpinner(false);
	}, [isSubmitting]);

	useEffect(() => {
		return () => {
			if (spinnerTimerRef.current) {
				window.clearTimeout(spinnerTimerRef.current);
				spinnerTimerRef.current = null;
			}
		};
	}, []);

	/* -------------------------------------------------------------------------- */
	/* Network Timeout Retry Helper - Supabase DB Cold Start                      */
	/* -------------------------------------------------------------------------- */

	async function signInWithRetry(email: string, password: string) {
		const result = await supabase.auth.signInWithPassword({ email, password });

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

		// Single retry to allow DB cold-start to recover
		await new Promise((r) => setTimeout(r, 600));

		return await supabase.auth.signInWithPassword({ email, password });
	}
	
	async function resendConfirmEmail(targetEmail: string) {
		const email = (targetEmail || "").trim();
		if (!email) {
			throw new Error("missing_email");
		}
	
		const origin = window.location?.origin;
		if (!origin) {
			throw new Error("missing_origin");
		}
	
		const emailRedirectTo = `${origin}${prefixLocale(locale, "/auth/callback")}`;
	
		const { error } = await supabase.auth.resend({
			type: "signup",
			email,
			options: { emailRedirectTo },
		});
	
		if (error) {
			throw error;
		}
	}
	
	
	useEffect(() => {
		const q = new URLSearchParams(window.location.search);
		const flag = q.get("auth");
	
		if (flag === "code_expired" || flag === "callback_failed" || flag === "invalid_link") {
			setAuthBanner(flag);
			return;
		}
	
		setAuthBanner(null);
	}, []);
	

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		if (isSubmitting) return;

		setFormError(null);
		setFormSuccess(null);
		setIsSubmitting(true);
		setNeedsEmailConfirm(false);

		try {
			const form = e.currentTarget;
			const formData = new FormData(form);

			const email = (formData.get("email") || "").toString().trim();
			const password = (formData.get("password") || "").toString();

			if (!email || !password) {
				setFormError(t("messages.missingEmailOrPassword"));
				setIsSubmitting(false);
				return;
			}

			const { data: signInData, error: signInError } = await signInWithRetry(email, password);

			if (signInError || !signInData.user) {
				const msg = (signInError?.message || "").toLowerCase();
			
				// Supabase commonly returns a message like "Email not confirmed"
				// We treat that as a special UX case (not a generic login failure).
				const isUnconfirmed =
					msg.includes("email not confirmed") ||
					msg.includes("not confirmed") ||
					msg.includes("unconfirmed");
			
				if (isUnconfirmed) {
					setNeedsEmailConfirm(true);
					setFormError(null);
					setFormSuccess(null);
					setIsSubmitting(false);
					return;
				}
			
				setFormError(t("messages.loginFailed"));
				setFormSuccess(null);
				setIsSubmitting(false);
				return;
			}
			

			await supabase.auth.refreshSession();

			const { data: refreshedUserData, error: refreshedUserError } = await supabase.auth.getUser();

			if (refreshedUserError || !refreshedUserData.user) {
				setFormError(t("messages.loginFailed"));
				setFormSuccess(null);
				setIsSubmitting(false);
				return;
			}

			setFormSuccess(t("messages.loginSuccess"));

			const role = (refreshedUserData.user.app_metadata?.role || "").toString() || "client";

			const targetPath =
				role === "admin" || role === "super_admin"
					? siteConfig.adminDashboardPath
					: siteConfig.clientDashboardPath;

			// FIX: ensure we never drop locale when navigating after auth.
			router.push(prefixLocale(locale, targetPath));
			router.refresh();
		} catch {
			setFormError(t("messages.loginFailed"));
			setFormSuccess(null);
			setIsSubmitting(false);
		}
	};

	const submitLabel = isSubmitting ? t("actions.submitting") : t("actions.submit");

	const showLabel = t("actions.showPassword");
	const hideLabel = t("actions.hidePassword");

	return (
		<PageWithStickyHero
			imageSrc="/images/login.jpg"
			overlap={false}
			title={t("heading")}
			subtitle={t("subheading")}
			description={t("subtitle")}
			descriptionOnImageRole={true}
			style={
				{
					"--hero-anchor-x": "50%",
					"--hero-anchor-y": "50%",
					"--hero-x": "0px",
					"--hero-y": "30px",
					"--hero-x-mobile": "0px",
					"--hero-y-mobile": "0px",
					"--hero-height": "clamp(420px, 70svh, 820px)",
					"--hero-overlay-top": "0.40",
					"--hero-overlay-mid": "0.3",
					"--hero-overlay-bot": "0.26",
					"--hero-overlay-blur": "0px",
					"--hero-overlay-sat": "1.2",
				} as CSSProperties
			}
		>
			<div className={`${styles.formInline} ${styles.formInlineEnd}`}>
				<Link href={siteConfig.signupPath} className="button button-secondary">
					{tGlobal("header.actions.createNewAccount")}
					<span aria-hidden="true">{tGlobal("Common.symbols.arrowRight")}</span>
				</Link>
			</div>

			<div className={styles.authFormShell}>
			
				{needsEmailConfirm ? (
					<div className="alert badge-caution" role="alert" aria-live="polite">
						{t("messages.emailNotConfirmed")}{" "}
						<Link href={siteConfig.signupPath} className={styles.authLink}>
							{t("actions.goToSignup")}
						</Link>
					</div>
				) : null}
				
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
				
				{authBanner === "invalid_link" ? (
					<div className="alert badge-caution" role="alert" aria-live="polite">
						{t("messages.invalidLink")}
					</div>
				) : null}
				
				{(needsEmailConfirm || authBanner) ? (
					<div className={`${styles.formInline} ${styles.formInlineStart}`}>
						<button
							type="button"
							className="button button-secondary"
							disabled={isResending || !emailValue.trim()}
							onClick={async () => {
								if (isResending) return;
				
								setFormError(null);
								setFormSuccess(null);
								setIsResending(true);
				
								try {
									await resendConfirmEmail(emailValue);
									setFormSuccess(t("messages.resendConfirmSent"));
								} catch (err) {
									const msg = (err instanceof Error ? err.message : "").toLowerCase();
				
									// Optional: translate a nicer message based on common cases
									// (keep keys in i18n, no hardcoded UI copy)
									if (msg.includes("too many requests") || msg.includes("rate")) {
										setFormError(t("messages.resendRateLimited"));
									} else {
										setFormError(t("messages.resendConfirmFailed"));
									}
								} finally {
									setIsResending(false);
								}
							}}
						>
							{isResending ? t("actions.resending") : t("actions.resendConfirm")}
						</button>
					</div>
				) : null}
				
				
				{formSuccess ? (
					<div id="login-success" className="alert badge-success" role="status" aria-live="polite">
						{formSuccess}
					</div>
				) : null}

				{formError ? (
					<div id="login-error" className="alert badge-caution" role="alert" aria-live="polite">
						{formError}
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
										autoComplete="email"
										className={styles.fieldInput}
										placeholder={t("fields.email.placeholder")}
										required
										value={emailValue}
										onChange={(e) => setEmailValue(e.target.value)}
										aria-describedby={formError ? "login-error" : undefined}
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
											autoComplete="current-password"
											className={styles.fieldInput}
											placeholder={t("fields.password.placeholder")}
											required
											aria-describedby={formError ? "login-error" : undefined}
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

									<div className={`${styles.formInline} ${styles.formInlineEnd}`}>
										<Link href={siteConfig.forgotPasswordPath} className={styles.authLink}>
											{t("actions.forgotPassword")}
										</Link>
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
									{showSpinner ? <span className={styles.spinner} aria-hidden="true" /> : null}
									<span className={styles.buttonLabel}>{submitLabel}</span>
								</span>
							</button>

							<p className={styles.authSecondaryText}>
								{t("footer.noAccount")}{" "}
								<Link href={siteConfig.signupPath} className={styles.authLink}>
									{t("footer.signupLink")}
								</Link>
							</p>
						</div>
					</fieldset>
				</form>
			</div>
		</PageWithStickyHero>
	);
}
