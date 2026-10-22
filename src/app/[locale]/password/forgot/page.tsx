/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/password/forgot/page.tsx
SCOPE: Forgot password (client-side). Sends Supabase reset email.
STATUS: UNLOCKED (lock after approved)
NOTES:
- Uses Supabase auth.resetPasswordForEmail(email, { redirectTo }) when supported.
- No hardcoded user-facing strings; i18n keys only.
- No console logging (treat auth + links as sensitive).
- Layout matches /password/change (global primitives + hero).
- Alerts (success/error) mirror /login (global alert badge classes).
*/

"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { supabase } from "@/lib/supabaseClient";
import { siteConfig } from "@/config/siteConfig";

import styles from "@/styles/auth.module.css";

/* --- GLOBAL PRIMITIVES (layout only) ------------------------------------- */
import { PageShell } from "@/components/ui/layout/PageShell";
import { MainColumn } from "@/components/ui/layout/MainColumn";
/* ------------------------------------------------------------------------- */

const SPINNER_DELAY_MS = 250;

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

function safeOrigin(): string | null {
	if (typeof window === "undefined") return null;
	if (!window.location?.origin) return null;
	return window.location.origin;
}

export default function ForgotPasswordPage() {
	const t = useTranslations("PasswordForm.forgot");
	const locale = useLocale();

	const [state, setState] = useState<FormState>({
		isSubmitting: false,
		formError: null,
		formSuccess: null,
	});

	const { isSubmitting, formError, formSuccess } = state;

	const [showSpinner, setShowSpinner] = useState(false);
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

	const setError = useCallback((msg: string | null) => {
		setState((s) => ({ ...s, formError: msg, formSuccess: null }));
	}, []);

	const setSuccess = useCallback((msg: string | null) => {
		setState((s) => ({ ...s, formSuccess: msg, formError: null }));
	}, []);

	const setSubmitting = useCallback((v: boolean) => {
		setState((s) => ({ ...s, isSubmitting: v }));
	}, []);

	const resetPath = useMemo(() => {
		const candidate =
			(siteConfig as Record<string, unknown>)?.resetPasswordPath ??
			(siteConfig as Record<string, unknown>)?.passwordResetPath ??
			"/password/reset";

		return String(candidate);
	}, []);

	const redirectTo = useMemo(() => {
		// Must be absolute for Supabase.
		const origin = safeOrigin();
		if (!origin) return "";

		return `${origin}${prefixLocale(locale, resetPath)}`;
	}, [locale, resetPath]);

	const tryUpdateLanguageMetadata = useCallback(async () => {
		// Best-effort:
		// Only works if a user session exists; if not, this will no-op.
		try {
			const { data } = await supabase.auth.getUser();
			if (!data?.user) return;

			await supabase.auth.updateUser({
				data: {
					language: locale,
				},
			});
		} catch {
			// Intentionally ignore (no console logging; not user-facing).
		}
	}, [locale]);

	const handleSubmit = useCallback(
		async (e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault();
			if (isSubmitting) return;

			setSubmitting(true);
			setError(null);
			setSuccess(null);

			try {
				const form = e.currentTarget;
				const formData = new FormData(form);

				const email = (formData.get("email") || "").toString().trim();

				if (!email) {
					setError(t("messages.missingEmail"));
					setSubmitting(false);
					return;
				}

				// Ensure the user lands on the correct locale reset page after clicking the email.
				// If your supabase-js version doesn't accept the second param,
				// remove { redirectTo } and configure redirect in Supabase dashboard.
				const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo } as any);

				if (error) {
					setError(t("messages.requestFailed"));
					setSubmitting(false);
					return;
				}

				// Best-effort: keep auth metadata in sync so templates can use {{ .Data.language }}
				// for future emails (when a session exists).
				await tryUpdateLanguageMetadata();

				setSuccess(t("messages.requestSuccess"));
				form.reset();
			} catch {
				setError(t("messages.requestFailed"));
			} finally {
				setSubmitting(false);
			}
		},
		[isSubmitting, redirectTo, setError, setSubmitting, setSuccess, t, tryUpdateLanguageMetadata],
	);

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
				<div className={styles.authFormShell}>
					{/* Alerts mirror /login */}
					{formSuccess ? (
						<div id="forgot-success" className="alert badge-success" role="status" aria-live="polite">
							{formSuccess}
						</div>
					) : null}

					{formError ? (
						<div id="forgot-error" className="alert badge-caution" role="alert" aria-live="polite">
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
											aria-describedby={formError ? "forgot-error" : undefined}
										/>
									</div>
								</div>
							</div>

							<div className={styles.authActions}>
								<button
									type="submit"
									className="button button-primary"
									disabled={isSubmitting || Boolean(formSuccess)}
									aria-busy={isSubmitting}
								>
									<span className={styles.buttonInner}>
										{showSpinner ? <span className={styles.spinner} aria-hidden="true" /> : null}
										<span className={styles.buttonLabel}>{submitLabel}</span>
									</span>
								</button>
							</div>
						</fieldset>
					</form>
				</div>
			</MainColumn>
		</PageShell>
	);
}
