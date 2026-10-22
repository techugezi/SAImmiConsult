/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/services/additional-support/page.tsx
SCOPE: Services subpage — Additional Support. Visual-only: global hero + layout primitives.
STATUS: UNLOCKED (lock after verified)
NOTES:
- Hero MUST follow global contract (title/subtitle/description only).
- Do not change existing i18n keys except adding title/subtitle/description.
- Uses global hero primitive: PageWithStickyHero (sticky image overlay logic).
*/

"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/config/siteConfig";
import type { CSSProperties } from "react";

import { PageWithStickyHero } from "@/components/ui/hero/PageWithStickyHero";

import styles from "../services.module.css";

export default function AdditionalSupportPage() {
	const t = useTranslations("ServicesAdditional");

	return (
		<PageWithStickyHero
			imageSrc="/images/service-additional-support.jpg"
			overlap={false}
			title={t("header.title")}
			subtitle={t("header.subtitle")}
			description={t("header.description")}
			descriptionOnImageRole={true}
			style={
				{
					"--hero-anchor-x": "50%",
					"--hero-anchor-y": "50%",
					"--hero-x": "0px",
					"--hero-y": "0px",
					"--hero-x-mobile": "0px",
					"--hero-y-mobile": "-20px",
					"--hero-height": "clamp(420px, 70svh, 820px)",
					"--hero-overlay-top": "0.70",
					"--hero-overlay-mid": "0.44",
					"--hero-overlay-bot": "0.26",
					"--hero-overlay-blur": "0px",
					"--hero-overlay-sat": "1.2",
				} as CSSProperties
			}
			actions={
				<>
					<Link href={siteConfig.contactPath} className="button button-primary">
						{t("header.primaryCta")}
					</Link>

					<Link href={siteConfig.faqPath} className="button button-secondary">
						{t("header.secondaryCta")}
					</Link>
				</>
			}
		>
			<article className={styles.subArticle}>
				<h2 className="panel-title">{t("summary.title")}</h2>
				<p className="text-muted">{t("summary.body")}</p>

				<ul className={styles.pillList}>
					{[0, 1, 2, 3].map((i) => (
						<li key={i} className={styles.pill}>
							<span className="text-sm text-bold">{t(`summary.pills.${i}`)}</span>
						</li>
					))}
				</ul>
			</article>

			<div className={styles.supportCardsGrid}>
				<article className={styles.supportCard}>
					<h3 className="panel-title">{t("education.title")}</h3>
					<p className="text-muted">{t("education.body")}</p>

					<ul className={styles.bulletList}>
						{[0, 1, 2].map((i) => (
							<li key={i} className="text-sm">
								{t(`education.points.${i}`)}
							</li>
						))}
					</ul>
				</article>

				<article className={styles.supportCard}>
					<h3 className="panel-title">{t("realEstate.title")}</h3>
					<p className="text-muted">{t("realEstate.body")}</p>

					<ul className={styles.bulletList}>
						{[0, 1].map((i) => (
							<li key={i} className="text-sm">
								{t(`realEstate.points.${i}`)}
							</li>
						))}
					</ul>
				</article>

				<article className={styles.supportCard}>
					<h3 className="panel-title">{t("banking.title")}</h3>
					<p className="text-muted">{t("banking.body")}</p>

					<ul className={styles.bulletList}>
						{[0, 1].map((i) => (
							<li key={i} className="text-sm">
								{t(`banking.points.${i}`)}
							</li>
						))}
					</ul>
				</article>
			</div>
		</PageWithStickyHero>
	);
}
