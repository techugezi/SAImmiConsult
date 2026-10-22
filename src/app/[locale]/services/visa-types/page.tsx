/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/services/visa-types/page.tsx
SCOPE: Services subpage — Visa Types. Visual-only: global hero-shell/hero-inner + global buttons + global typography utilities.
STATUS: UNLOCKED (lock after verified)
NOTES:
- Must use global layout primitives: PageShell/MainColumn.
- Per global rule: every page uses PageShell + standard hero skeleton (title/subtitle/description).
- Uses global hero primitive: PageWithStickyHero (sticky image overlay logic).
*/

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/config/siteConfig";
import type { CSSProperties } from "react";

import { PageWithStickyHero } from "@/components/ui/hero/PageWithStickyHero";

import styles from "../services.module.css";

const VISA_CATEGORIES = ["work", "study", "business", "family"] as const;

export default async function VisaTypesPage() {
	const t = await getTranslations("ServicesVisaTypes");

	return (
		<PageWithStickyHero
			imageSrc="/images/service-visa-types.jpg"
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
					"--hero-y-mobile": "20px",
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
			<section className={styles.subServiceSection}>
				<div className={styles.subServiceSquare}>
					<div className={styles.visaCardsGrid}>
						{VISA_CATEGORIES.map((cat) => (
							<article key={cat} className={styles.visaCard}>
								<h2 className="panel-title">{t(`${cat}.title`)}</h2>

								<p className="text-muted">{t(`${cat}.body`)}</p>

								<div className={styles.visaDivider} />

								<h3 className="text-sm text-bold">{t(`${cat}.who`)}</h3>
								<p className="text-muted">{t(`${cat}.whoBody`)}</p>

								<h3 className="text-sm text-bold">{t(`${cat}.requirements`)}</h3>

								<ul className={styles.bulletList}>
									{[0, 1, 2].map((i) => (
										<li key={i} className="text-sm">
											{t(`${cat}.requirementList.${i}`)}
										</li>
									))}
								</ul>
							</article>
						))}
					</div>
				</div>
			</section>
		</PageWithStickyHero>
	);
}
