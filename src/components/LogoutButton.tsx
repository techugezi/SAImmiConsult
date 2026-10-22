// src/components/LogoutButton.tsx
"use client";

/* DOC NAME: LogoutButton.tsx
   LOCATION: /src/components/LogoutButton.tsx
   SCOPE: Client logout control (sign out + redirect). Client-only.
   STATUS: UNLOCKED (lock after verified)
*/

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

import { siteConfig } from "@/config/siteConfig";
import { supabase } from "@/lib/supabaseClient";

import styles from "./LogoutButton.module.css";

const SPINNER_DELAY_MS = 250;

export default function LogoutButton() {
	const router = useRouter();
	const t = useTranslations("GlobalForm");

	const [isSubmitting, setIsSubmitting] = useState(false);
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

	const handleLogout = useCallback(async () => {
		if (isSubmitting) return;

		setIsSubmitting(true);

		try {
			await supabase.auth.signOut();
		} finally {
			// Keep locale-aware navigation inside the i18n router
			router.push(siteConfig.loginPath);
			router.refresh();
		}
	}, [isSubmitting, router]);

	return (
		<button
			type="button"
			onClick={handleLogout}
			className={styles.logoutButton}
			disabled={isSubmitting}
			aria-disabled={isSubmitting}
			aria-busy={isSubmitting}
		>
			<span className={styles.buttonInner}>
				{showSpinner ? <span className={styles.spinner} aria-hidden="true" /> : null}

				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 20 20"
					fill="currentColor"
					className={styles.icon}
					aria-hidden="true"
					focusable="false"
				>
					<path
						fillRule="evenodd"
						d="M3 3a1 1 0 0 0-1 1v12a1 1 0 1 0 2 0V4a1 1 0 0 0-1-1Zm10.293 3.293a1 1 0 0 1 1.414 0l3 3a1 1 0 0 1 0 1.414l-3 3a1 1 0 0 1-1.414-1.414L14.586 11H7a1 1 0 1 1 0-2h7.586l-1.293-1.293a1 1 0 0 1 0-1.414Z"
						clipRule="evenodd"
					/>
				</svg>

				<span className={styles.logoutText}>{t("actions.logout")}</span>
			</span>
		</button>
	);
}
