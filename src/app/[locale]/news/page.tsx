/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/news/page.tsx
SCOPE: Public news list (cached server reads + locale-specific fields).
STATUS: UNLOCKED (lock after verified)
NOTES:
- Styling-only update: news item typography now uses global roles from globals.css.
- NewsTicker left untouched.
- Page uses PageShell + mandatory global hero structure.
- Uses global hero primitive: PageWithStickyHero (sticky image overlay logic).
- Dynamic news links MUST use siteConfig route helpers (no hardcoded "/news/${...}" strings).
*/

import type React from "react";

import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

import { siteConfig } from "@/config/siteConfig";
import { getPublicNews } from "@/lib/siteContent";
import styles from "./news.module.css";

import type { CSSProperties } from "react";

import NewsTicker from "@/components/ui/NewsTicker/NewsTicker";
import { PageWithStickyHero } from "@/components/ui/hero/PageWithStickyHero";

export default async function NewsPage() {
	const uiLocale = await getLocale();
	const t = await getTranslations("News");
	const tGlobal = await getTranslations("GlobalForm");

	const news = await getPublicNews();

	const pinned = news.filter((n) => n.pinned);
	const tickerSource = pinned.length > 0 ? pinned : news.slice(0, 3);

	return (
		<>
			<PageWithStickyHero
				imageSrc="/images/news.jpg"
				overlap={false}
				title={t("title")}
				subtitle={t("subtitle")}
				description={t("description")}
				descriptionOnImageRole={true}
				style={
					{
						"--hero-anchor-x": "50%",
						"--hero-anchor-y": "50%",
						"--hero-x": "0px",
						"--hero-y": "100px",
						"--hero-x-mobile": "90px",
						"--hero-y-mobile": "0px",
						"--hero-height": "clamp(420px, 70svh, 820px)",
						"--hero-overlay-top": "0.3",
						"--hero-overlay-mid": "0.6",
						"--hero-overlay-bot": "0.06",
						"--hero-overlay-blur": "0px",
						"--hero-overlay-sat": "1.2",
					} as CSSProperties
				}
			>
				<NewsTicker
					eyebrow={t("eyebrow")}
					items={tickerSource.map((n) => ({
						key: n.id,
						headline: uiLocale.startsWith("ru") ? n.title_ru : n.title_en,
						// Keep as string if NewsTicker expects string, but still centralize via siteConfig
						href: siteConfig.newsArticleHref(n.slug),
					}))}
				/>

				<section className={styles.newsSection}>
					<div className={styles.newsSquare}>
						<div className={styles.newsList}>
							{news.map((n) => {
								const title = uiLocale.startsWith("ru") ? n.title_ru : n.title_en;
								const summary = uiLocale.startsWith("ru") ? n.summary_ru : n.summary_en;

								return (
									<Link
										key={n.id}
										href={siteConfig.newsArticleHref(n.slug)}
										className={styles.newsItem}
										aria-label={`${t("readMore")}: ${title}`}
									>
										<div className={styles.newsMetaRow}>
											<p className={`text-xs text-muted ${styles.newsItemMeta}`}>
												{n.published_at
													? new Date(n.published_at).toLocaleDateString(uiLocale)
													: ""}
											</p>
										</div>

										<h2 className={`text-md text-bold ${styles.newsItemTitle}`}>{title}</h2>

										<p className={`text-sm text-muted ${styles.newsItemSummary}`}>{summary}</p>

										<span className={styles.newsReadMore} aria-hidden="true">
											<span className="text-sm text-bold">{t("readMore")}</span>
											<span className={styles.readMoreArrow} aria-hidden="true">
												{tGlobal("Common.symbols.arrowRight")}
											</span>
										</span>
									</Link>
								);
							})}
						</div>
					</div>
				</section>
			</PageWithStickyHero>
		</>
	);
}
