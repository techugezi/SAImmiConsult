/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/password/change/page.tsx
SCOPE: Shared Change Password page (guarded). Works for both admin and client users.
STATUS: UNLOCKED (lock after approved)
NOTES:
- Best practice: re-authenticate user with current password before updating password.
- Uses Supabase auth.signInWithPassword({ email, password: currentPassword }) to confirm current password.
- Then uses Supabase auth.updateUser({ password }) for current session.
- Does NOT display existing password (never available; never should be).
- No hardcoded UI strings; i18n keys only.
- No console logging (treat auth as sensitive).
*/

"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { supabase } from "@/lib/supabaseClient";
import { siteConfig } from "@/config/siteConfig";

import { PageShell } from "@/components/ui/layout/PageShell";
import { MainColumn } from "@/components/ui/layout/MainColumn";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons/AuthEyeIcons";

import styles from "@/styles/auth.module.css";

const SPINNER_DELAY_MS = 250;

function prefixLocale(locale: string, path: string) {
	if (!path) return `/${locale}`;
	if (path.startsWith(`/${locale}/`) || path === `/${locale}`) return path;
	if (!path.startsWith("/")) return `/${locale}/${path}`;
	return `/${locale}${path}`;
}

export default function ChangePasswordPage() {
	const t = useTranslations("PasswordForm.change");
	const tGlobal = useTranslations("GlobalForm");
	const locale = useLocale();
	const router = useRouter();

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showSpinner, setShowSpinner] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);
	const [formSuccess, setFormSuccess] = useState<string | null>(null);

	const [isLoading, setIsLoading] = useState(true);

	type PasswordFieldId = "currentPassword" | "newPassword" | "confirmPassword";
	const [visibleFields, setVisibleFields] = useState<Set<PasswordFieldId>>(new Set());

	const toggleFieldVisibility = useCallback((id: PasswordFieldId) => {
		setVisibleFields((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, []);

	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");

	const resolvedReturnHrefRef = useRef<string>("");
	const loginEmailRef = useRef<string>("");

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

	const setError = useCallback(
		(msg: string | null) => {
			setFormError(msg);
			setFormSuccess(null);
		},
		[setFormError, setFormSuccess],
	);

	const setSuccess = useCallback(
		(msg: string | null) => {
			setFormSuccess(msg);
			setFormError(null);
		},
		[setFormError, setFormSuccess],
	);

	useEffect(() => {
		let cancelled = false;

		const run = async () => {
			setIsLoading(true);
			setError(null);
			setSuccess(null);

			try {
				const { data, error } = await supabase.auth.getUser();

				if (cancelled) return;

				if (error || !data.user) {
					router.push(prefixLocale(locale, siteConfig.loginPath));
					return;
				}

				loginEmailRef.current = (data.user.email ?? "").toString();

				const role = (data.user.app_metadata?.role || "").toString() || "client";
				const target =
					role === "admin" || role === "super_admin"
						? prefixLocale(locale, siteConfig.adminDashboardPath)
						: prefixLocale(locale, siteConfig.clientDashboardPath);

				resolvedReturnHrefRef.current = target;
			} catch {
				router.push(prefixLocale(locale, siteConfig.loginPath));
				return;
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		};

		run();

		return () => {
			cancelled = true;
		};
	}, [locale, router, setError, setSuccess]);

	const canSubmit = !isLoading && !isSubmitting;

	const goBack = useCallback(() => {
		const target = resolvedReturnHrefRef.current;
		if (target) {
			router.push(target);
			return;
		}
		router.push(prefixLocale(locale, siteConfig.loginPath));
	}, [locale, router]);

	const handleSubmit = useCallback(
		async (e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault();
			if (!canSubmit) return;

			setFormError(null);
			setFormSuccess(null);
			setIsSubmitting(true);

			const curr = currentPassword.toString();
			const pwd = newPassword.toString();
			const confirm = confirmPassword.toString();

			if (!curr) {
				setError(t("messages.missingCurrentPassword"));
				setIsSubmitting(false);
				return;
			}

			if (!pwd || !confirm) {
				setError(t("messages.missingPassword"));
				setIsSubmitting(false);
				return;
			}

			if (pwd !== confirm) {
				setError(t("messages.passwordMismatch"));
				setIsSubmitting(false);
				return;
			}

			if (pwd.length < 8) {
				setError(t("messages.passwordTooShort"));
				setIsSubmitting(false);
				return;
			}

			try {
				// Guard: ensure we have an authenticated user + email
				const { data: userData, error: userError } = await supabase.auth.getUser();
				if (userError || !userData.user) {
					setError(t("messages.notAuthenticated"));
					setIsSubmitting(false);
					return;
				}

				const email = (userData.user.email ?? loginEmailRef.current ?? "").toString().trim();
				if (!email) {
					setError(t("messages.notAuthenticated"));
					setIsSubmitting(false);
					return;
				}

				// Best practice: re-authenticate to confirm current password
				const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
					email,
					password: curr,
				});

				if (signInError || !signInData.user) {
					setError(t("messages.currentPasswordIncorrect"));
					setIsSubmitting(false);
					return;
				}

				// Now update password
				const { error: updateError } = await supabase.auth.updateUser({ password: pwd });
				if (updateError) {
					setError(t("messages.changeFailed"));
					setIsSubmitting(false);
					return;
				}

				setSuccess(t("messages.changeSuccess"));

				// Clear fields
				setCurrentPassword("");
				setNewPassword("");
				setConfirmPassword("");

				window.setTimeout(() => {
					goBack();
				}, 900);
			} catch {
				setError(t("messages.changeFailed"));
				setFormSuccess(null);
				setIsSubmitting(false);
				return;
			} finally {
				setIsSubmitting(false);
			}
		},
		[
			canSubmit,
			confirmPassword,
			currentPassword,
			goBack,
			newPassword,
			setError,
			setSuccess,
			t,
		],
	);

	const showLabel = t("actions.showPassword");
	const hideLabel = t("actions.hidePassword");
	const submitLabel = isSubmitting ? t("actions.submitting") : t("actions.submit");

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
					<button
						type="button"
						className="button button-ghost"
						onClick={goBack}
						disabled={isSubmitting || isLoading}
					>
						<span aria-hidden="true">{tGlobal("Common.symbols.arrowLeft")}</span>
						{t("actions.backToProfile")}
					</button>
				</div>

				<div className={styles.authFormShell}>
					{formSuccess ? (
						<div id="change-password-success" className="alert badge-success" role="status" aria-live="polite">
							{formSuccess}
						</div>
					) : null}

					{formError ? (
						<div id="change-password-error" className="alert badge-caution" role="alert" aria-live="polite">
							{formError}
						</div>
					) : null}

					<form className={styles.authForm} onSubmit={handleSubmit} aria-busy={isSubmitting}>
						<fieldset className={styles.fieldsetReset} disabled={isSubmitting || isLoading}>
							<div className={styles.formSection}>
								<div className={styles.formGrid}>
									<div className={styles.formField}>
										<label className={styles.fieldLabel} htmlFor="currentPassword">
											{t("fields.currentPassword.label")}
										</label>

										<div className={styles.passwordField}>
											<input
												id="currentPassword"
												name="currentPassword"
												type={visibleFields.has("currentPassword") ? "text" : "password"}
												className={styles.fieldInput}
												placeholder={t("fields.currentPassword.placeholder")}
												value={currentPassword}
												onChange={(e) => setCurrentPassword(e.currentTarget.value)}
												autoComplete="current-password"
												required
												aria-describedby={formError ? "change-password-error" : undefined}
											/>

											<button
												type="button"
												className={styles.passwordToggle}
												onClick={() => toggleFieldVisibility("currentPassword")}
												aria-pressed={visibleFields.has("currentPassword")}
												aria-label={visibleFields.has("currentPassword") ? hideLabel : showLabel}
												title={visibleFields.has("currentPassword") ? hideLabel : showLabel}
											>
												{visibleFields.has("currentPassword") ? <EyeOffIcon /> : <EyeIcon />}
											</button>
										</div>
									</div>

									<div className={styles.formField}>
										<div className={styles.formField}>
										<label className={styles.fieldLabel} htmlFor="newPassword">
											{t("fields.newPassword.label")}
										</label>

										<div className={styles.passwordField}>
											<input
												id="newPassword"
												name="newPassword"
												type={visibleFields.has("newPassword") ? "text" : "password"}
												className={styles.fieldInput}
												placeholder={t("fields.newPassword.placeholder")}
												value={newPassword}
												onChange={(e) => setNewPassword(e.currentTarget.value)}
												autoComplete="new-password"
												required
												aria-describedby={formError ? "change-password-error" : undefined}
											/>

											<button
												type="button"
												className={styles.passwordToggle}
												onClick={() => toggleFieldVisibility("newPassword")}
												aria-pressed={visibleFields.has("newPassword")}
												aria-label={visibleFields.has("newPassword") ? hideLabel : showLabel}
												title={visibleFields.has("newPassword") ? hideLabel : showLabel}
											>
												{visibleFields.has("newPassword") ? <EyeOffIcon /> : <EyeIcon />}
											</button>
										</div>

										<p className={styles.alertText} style={{ marginTop: "0.45rem" }}>
											{t("fields.newPassword.hint")}
										</p>
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
												type={visibleFields.has("confirmPassword") ? "text" : "password"}
												className={styles.fieldInput}
												placeholder={t("fields.confirmPassword.placeholder")}
												value={confirmPassword}
												onChange={(e) => setConfirmPassword(e.currentTarget.value)}
												autoComplete="new-password"
												required
												aria-describedby={formError ? "change-password-error" : undefined}
											/>

											<button
												type="button"
												className={styles.passwordToggle}
												onClick={() => toggleFieldVisibility("confirmPassword")}
												aria-pressed={visibleFields.has("confirmPassword")}
												aria-label={visibleFields.has("confirmPassword") ? hideLabel : showLabel}
												title={visibleFields.has("confirmPassword") ? hideLabel : showLabel}
											>
												{visibleFields.has("confirmPassword") ? <EyeOffIcon /> : <EyeIcon />}
											</button>
										</div>
									</div>
								</div>
							</div>

							<div className={styles.authActions}>
								<button
									type="submit"
									className="button button-primary"
									disabled={!canSubmit}
									aria-busy={isSubmitting}
								>
									<span className={styles.buttonInner}>
										{showSpinner ? <span className={styles.spinner} aria-hidden="true" /> : null}
										<span className={styles.buttonLabel}>{submitLabel}</span>
									</span>
								</button>

								<p className={styles.authSecondaryText}>
									<Link href={siteConfig.forgotPasswordPath} className={styles.authLink}>
										{t("footer.forgotPasswordLink")}
									</Link>
								</p>
							</div>
						</fieldset>
					</form>
				</div>
			</MainColumn>
		</PageShell>
	);
}
