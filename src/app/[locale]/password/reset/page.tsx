/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/password/reset/page.tsx
SCOPE: Reset password (client-side, Supabase recovery landing). User sets a new password after email link.
STATUS: UNLOCKED (lock after approved)
NOTES:
- Requires recovery tokens in URL (hash params or ?code= depending on Supabase setup).
- No hardcoded user-facing strings; no i18n fallbacks.
- No console logging (treat auth as sensitive).
*/

"use client";

import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/config/siteConfig";
import { supabase } from "@/lib/supabaseClient";

import styles from "@/styles/auth.module.css";

import { PageShell } from "@/components/ui/layout/PageShell";
import { MainColumn } from "@/components/ui/layout/MainColumn";

import { EyeIcon, EyeOffIcon } from "@/components/ui/icons/AuthEyeIcons";

type FormState = {
	isSubmitting: boolean;
	formError: string | null;
	formSuccess: string | null;
};

function prefixLocale(locale: string, path: string) {
	if (!path) return `/${locale}`;
	if (path.startsWith(`/${locale}/`) || path === `/${locale}`) return path;
	if (!path.startsWith("/")) return `/${locale}/${path}`;
	return `/${locale}${path}`;
}

function hasRecoveryTokensInUrl(): boolean {
	if (typeof window === "undefined") return false;

	// Supabase commonly uses hash params for recovery (access_token, refresh_token, type=recovery)
	// Some setups may use a ?code= flow.
	const url = new URL(window.location.href);
	const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
	const hashParams = new URLSearchParams(hash);

	const hasAccessToken = Boolean(hashParams.get("access_token"));
	const hasTypeRecovery = hashParams.get("type") === "recovery";
	const hasCode = url.searchParams.has("code");

	return (hasAccessToken && hasTypeRecovery) || hasCode;
}

export default function ResetPasswordPage() {
	const t = useTranslations("PasswordForm.reset");
	const tGlobal = useTranslations("GlobalForm");
	const locale = useLocale();
	const router = useRouter();

	const [isPasswordVisible, setIsPasswordVisible] = useState(false);

	const [state, setState] = useState<FormState>({
		isSubmitting: false,
		formError: null,
		formSuccess: null,
	});

	const { isSubmitting, formError, formSuccess } = state;

	const eligible = useMemo(() => hasRecoveryTokensInUrl(), []);

	const setError = useCallback((msg: string) => {
		setState((s) => ({ ...s, formError: msg, formSuccess: null }));
	}, []);

	const setSuccess = useCallback((msg: string) => {
		setState((s) => ({ ...s, formSuccess: msg, formError: null }));
	}, []);

	const setSubmitting = useCallback((v: boolean) => {
		setState((s) => ({ ...s, isSubmitting: v }));
	}, []);

	const handleSubmit = useCallback(
		async (e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault();

			if (isSubmitting) return;

			setSubmitting(true);
			setState((s) => ({ ...s, formError: null, formSuccess: null }));

			const form = e.currentTarget;
			const formData = new FormData(form);

			const password = (formData.get("password") || "").toString();
			const confirmPassword = (formData.get("confirmPassword") || "").toString();

			if (!password || !confirmPassword) {
				setError(t("messages.missingPassword"));
				setSubmitting(false);
				return;
			}

			if (password !== confirmPassword) {
				setError(t("messages.passwordMismatch"));
				setSubmitting(false);
				return;
			}

			try {
				// In recovery flow, the user is temporarily authenticated.
				const { error } = await supabase.auth.updateUser({ password });

				if (error) {
					setError(t("messages.updateFailed"));
					return;
				}

				setSuccess(t("messages.updateSuccess"));
				form.reset();

				// Optional: sign out so they re-login with the new password
				await supabase.auth.signOut();

				window.setTimeout(() => {
					router.push(prefixLocale(locale, siteConfig.loginPath));
				}, 900);
			} catch {
				setError(t("messages.updateFailed"));
			} finally {
				setSubmitting(false);
			}
		},
		[isSubmitting, locale, router, setError, setSubmitting, setSuccess, t],
	);

	const submitLabel = isSubmitting ? t("actions.submitting") : t("actions.submit");
	const showLabel = t("actions.showPassword");
	const hideLabel = t("actions.hidePassword");

	return (
		<PageShell>
			<header className="hero-shell">
				<div className="hero-inner">
					<div className="hero-square">
						<h1 className="hero-title">{t("heading")}</h1>
						<p className="hero-subtitle">{t("subheading")}</p>
						<p className="hero-desc">{t("description")}</p>
					</div>
				</div>
			</header>

			<MainColumn>
				<div className={`${styles.formInline} ${styles.formInlineStart}`}>
					<Link href={siteConfig.loginPath} className="button button-ghost">
						<span aria-hidden="true">{tGlobal("Common.symbols.arrowLeft")}</span>
						{tGlobal("header.actions.backToLogin")}
					</Link>
				</div>

				<div className={styles.authFormShell}>
					{!eligible ? (
						<>
							<div className="alert badge-caution" role="alert" aria-live="polite">
								<strong>{t("messages.invalidLinkTitle")}</strong> {t("messages.invalidLinkText")}
							</div>

							<div className={`${styles.formInline} ${styles.formInlineStart}`}>
								<Link href={siteConfig.forgotPasswordPath} className={styles.authLink}>
									{t("footer.requestNewLink")}
								</Link>
							</div>
						</>
					) : (
						<>
							{formError ? (
								<div className="alert badge-caution" role="alert" aria-live="polite">
									{formError}
								</div>
							) : null}

							{formSuccess ? (
								<div className="alert badge-success" role="status" aria-live="polite">
									{formSuccess}
								</div>
							) : null}

							<form className={styles.authForm} onSubmit={handleSubmit} aria-busy={isSubmitting}>
								<fieldset className={styles.fieldsetReset} disabled={isSubmitting}>
									<div className={styles.formSection}>
										<div className={styles.formGrid}>
											<div className={styles.formField}>
												<label className={styles.fieldLabel} htmlFor="password">
													{t("fields.password.label")}
												</label>

												<div className={styles.passwordField}>
													<input
														id="password"
														name="password"
														type={isPasswordVisible ? "text" : "password"}
														autoComplete="new-password"
														className={styles.fieldInput}
														placeholder={t("fields.password.placeholder")}
														required
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
														type={isPasswordVisible ? "text" : "password"}
														autoComplete="new-password"
														className={styles.fieldInput}
														placeholder={t("fields.confirmPassword.placeholder")}
														required
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
										</div>
									</div>

									<div className={styles.authActions}>
										<button type="submit" className="button button-primary" disabled={isSubmitting} aria-busy={isSubmitting}>
											<span className={styles.buttonInner}>
												{isSubmitting ? <span className={styles.spinner} aria-hidden="true" /> : null}
												<span className={styles.buttonLabel}>{submitLabel}</span>
											</span>
										</button>

										<p className={styles.authSecondaryText}>
											<Link href={siteConfig.loginPath} className={styles.authLink}>
												{t("footer.backToLogin")}
											</Link>
										</p>
									</div>
								</fieldset>
							</form>
						</>
					)}
				</div>
			</MainColumn>
		</PageShell>
	);
}
