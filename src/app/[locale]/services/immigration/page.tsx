/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/services/immigration/page.tsx
SCOPE: Services subpage — Immigration. Visual-only: global hero-shell/hero-inner + global buttons + global typography utilities.
STATUS: UNLOCKED (lock after verified)
NOTES:
- Page MUST use <PageShell> + the global hero structure (hero-title/subtitle/desc).
- Do not change any i18n keys besides title/subtitle/description.
- Uses global hero primitive: PageWithStickyHero (sticky image overlay logic).
*/

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/config/siteConfig";
import type { CSSProperties } from "react";

import { PageWithStickyHero } from "@/components/ui/hero/PageWithStickyHero";

import styles from "../services.module.css";

export default function ImmigrationPage() {
	const t = useTranslations("ServicesImmigration");

	return (
		<PageWithStickyHero
			imageSrc="/images/service-immigration.jpg"
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
					"--hero-y": "90px",
					"--hero-x-mobile": "0px",
					"--hero-y-mobile": "0px",
					"--hero-height": "clamp(420px, 70svh, 820px)",
					"--hero-overlay-top": "0.45",
					"--hero-overlay-mid": "0.3",
					"--hero-overlay-bot": "0.1",
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
			{/* MAIN CONTENT + SIDEBAR (no logic changes) */}
			<div className={styles.sectionGroup}>
				<div className={styles.sectionBlock}>
					{/* To South Africa */}
					<article className={styles.subArticle}>
						<h2 className="panel-title">{t("toSa.title")}</h2>
						<p className="text-muted">{t("toSa.body")}</p>

						<ul className={styles.bulletList}>
							{[0, 1, 2, 3, 4].map((i) => (
								<li key={i} className="text-sm">
									{t(`toSa.points.${i}`)}
								</li>
							))}
						</ul>
					</article>

					{/* Why people immigrate to SA */}
					<article className={styles.subArticle}>
						<h2 className="panel-title">{t("whySa.title")}</h2>
						<p className="text-muted">{t("whySa.body")}</p>

						<ul className={styles.bulletList}>
							{[0, 1, 2, 3].map((i) => (
								<li key={i} className="text-sm">
									{t(`whySa.points.${i}`)}
								</li>
							))}
						</ul>
					</article>
				</div>

				{/* Side panel: BRICS & key advantages */}
				<aside className={styles.highlightPanel}>
					<h3 className="text-bold">{t("brics.title")}</h3>
					<p className="text-muted">{t("brics.body")}</p>

					<ul className={styles.pillList}>
						{[0, 1, 2, 3].map((i) => (
							<li key={i} className={styles.pill}>
								<span className="text-sm text-bold">{t(`brics.pills.${i}`)}</span>
							</li>
						))}
					</ul>
				</aside>
			</div>
		</PageWithStickyHero>
	);
}
