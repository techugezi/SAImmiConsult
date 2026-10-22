/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/contact/page.tsx
SCOPE: Contact page — remove enquiry form; provide direct contact CTAs only. Visual overhaul only.
STATUS: UNLOCKED (lock after verified)
NOTES:
- No hardcoded user-facing strings; i18n keys only (no fallbacks).
- Uses global hero roles (.hero-title/.hero-subtitle/.hero-desc).
- Buttons use global button classes (button-primary / button-secondary).
- Uses global hero primitive: PageWithStickyHero (sticky image overlay logic).
*/

import { getLocale, getTranslations } from "next-intl/server";
import { siteConfig } from "@/config/siteConfig";
import type { CSSProperties } from "react";

import { PageWithStickyHero } from "@/components/ui/hero/PageWithStickyHero";

import styles from "./contact.module.css";

export default async function ContactPage() {
	const t = await getTranslations("Contact");

	// Keep the existing prefill behaviour, but with strict i18n (no fallbacks).
	const whatsappPrefill = t("quickChat.prefill");
	const whatsappHref = `${siteConfig.whatsappUrl}?text=${encodeURIComponent(whatsappPrefill)}`;

	const telegramHref = siteConfig.telegramPhoneUrl;

	return (
		<PageWithStickyHero
			imageSrc="/images/contact.jpg"
			overlap={false}
			title={t("eyebrow")}
			subtitle={t("title")}
			description={t("subtitle")}
			descriptionOnImageRole={true}
			style={
				{
					"--hero-anchor-x": "50%",
					"--hero-anchor-y": "50%",
					"--hero-x": "0px",
					"--hero-y": "80px",
					"--hero-x-mobile": "170px",
					"--hero-y-mobile": "0px",
					"--hero-height": "clamp(420px, 70svh, 820px)",
					"--hero-overlay-top": "0.2",
					"--hero-overlay-mid": "0.4",
					"--hero-overlay-bot": "0.2",
					"--hero-overlay-blur": "0px",
					"--hero-overlay-sat": "1.2",
				} as CSSProperties
			}
		>
			<article className={`surface-soft ${styles.card}`}>
				<h2 className="panel-title">{t("quickChat.title")}</h2>

				<p className={`text-sm text-muted ${styles.quickBody}`}>{t("quickChat.body")}</p>

				<p className={`text-sm ${styles.fastHint}`}>{t("quickChat.quickerResponse")}</p>

				<div className={styles.actionsGrid} aria-label={t("quickChat.ariaLabel")}>
					<a
						href={whatsappHref}
						target="_blank"
						rel="noopener noreferrer"
						className={`button button-primary ${styles.actionButton}`}
					>
						{t("quickChat.actions.whatsapp")}
					</a>

					<a
						href={telegramHref}
						target="_blank"
						rel="noopener noreferrer"
						className={`button button-secondary ${styles.actionButton}`}
					>
						{t("quickChat.actions.telegram")}
					</a>
				</div>

				<p className={`text-xs text-muted ${styles.metaNote}`}>{t("quickChat.note")}</p>
			</article>
		</PageWithStickyHero>
	);
}
