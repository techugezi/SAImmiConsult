/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/services/emigration/page.tsx
SCOPE: Services subpage — Emigration. Visual-only: global hero-shell/hero-inner + global buttons + global typography utilities.
STATUS: UNLOCKED (lock after verified)
NOTES:
- Uses global hero primitive: PageWithStickyHero (sticky image overlay logic).
*/

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/config/siteConfig";

import { PageWithStickyHero } from "@/components/ui/hero/PageWithStickyHero";

import styles from "../services.module.css";

import type { CSSProperties } from "react";

export default function EmigrationPage() {
	const t = useTranslations("ServicesEmigration");

	return (
		<PageWithStickyHero
			imageSrc="/images/service-emigration.jpg"
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
					"--hero-y-mobile": "-200px",
					"--hero-height": "clamp(420px, 70svh, 820px)",
					"--hero-overlay-top": "0.40",
					"--hero-overlay-mid": "0.4",
					"--hero-overlay-bot": "0.26",
					"--hero-overlay-blur": "0.4px",
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
			{/* MAIN CONTENT + SIDEBAR (no logic changes) */}
			<div className={styles.sectionGroup}>
				<div className={styles.sectionBlock}>
					{/* Emigrate from South Africa */}
					<article className={styles.subArticle}>
						<h2 className="panel-title">{t("fromSa.title")}</h2>
						<p className="text-muted">{t("fromSa.body")}</p>

						<ul className={styles.bulletList}>
							{[0, 1, 2].map((i) => (
								<li key={i} className="text-sm">
									{t(`fromSa.points.${i}`)}
								</li>
							))}
						</ul>
					</article>

					{/* Work & study visas abroad */}
					<article className={styles.subArticle}>
						<h2 className="panel-title">{t("workStudy.title")}</h2>
						<p className="text-muted">{t("workStudy.body")}</p>

						<ul className={styles.bulletList}>
							{[0, 1, 2].map((i) => (
								<li key={i} className="text-sm">
									{t(`workStudy.points.${i}`)}
								</li>
							))}
						</ul>
					</article>

					{/* Tourist & training visas */}
					<article className={styles.subArticle}>
						<h2 className="panel-title">{t("touristTraining.title")}</h2>
						<p className="text-muted">{t("touristTraining.body")}</p>

						<ul className={styles.bulletList}>
							{[0, 1, 2].map((i) => (
								<li key={i} className="text-sm">
									{t(`touristTraining.points.${i}`)}
								</li>
							))}
						</ul>
					</article>
				</div>

				{/* SIDEBAR */}
				<aside className={styles.highlightPanel}>
					<h3 className="text-bold">{t("greece.title")}</h3>
					<p className="text-muted">{t("greece.body")}</p>

					<ul className={styles.pillList}>
						{[0, 1, 2, 3].map((i) => (
							<li key={i} className={styles.pill}>
								<span className="text-sm text-bold">{t(`greece.pills.${i}`)}</span>
							</li>
						))}
					</ul>
				</aside>
			</div>
		</PageWithStickyHero>
	);
}
