/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/news/[slug]/page.tsx
SCOPE: Public news article page (slug route). Cached server read + tag revalidation.
STATUS: UNLOCKED (lock after verified)
AUDIT:
- Uses slug-safe cached read (prevents cross-slug cache collisions).
- Uses PageShell + MainColumn (global primitives).
- Uses mandatory global hero structure (hero-shell/hero-inner).
- Removed hardcoded arrow literal; uses GlobalForm symbol key.
- Uses global hero primitive: PageWithStickyHero (sticky image overlay logic).
*/

import "server-only";

import type { CSSProperties } from "react";

import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { Link } from "@/i18n/navigation";
import { getPublicNewsBySlug } from "@/lib/siteContent";
import { siteConfig } from "@/config/siteConfig";

import { PageWithStickyHero } from "@/components/ui/hero/PageWithStickyHero";

import styles from "../news.module.css";

type Props = {
	params: Promise<{
		slug: string;
	}>;
};

function splitParagraphs(md: string) {
	return md
		.replace(/\r\n/g, "\n")
		.split("\n")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

function safeDateLabel(raw: string | null | undefined, locale: string): string {
	if (!raw) return "";
	const d = new Date(raw);
	if (!Number.isFinite(d.getTime())) return "";
	try {
		return d.toLocaleDateString(locale);
	} catch {
		return "";
	}
}

export default async function NewsSlugPage({ params }: Props) {
	const uiLocale = await getLocale();
	const t = await getTranslations("News");
	const tGlobal = await getTranslations("GlobalForm");

	const { slug: rawSlug } = await params;
	const slug = (rawSlug ?? "").toString().trim();
	if (slug.length === 0) notFound();

	const n = await getPublicNewsBySlug(slug);
	if (!n) notFound();

	const isRu = uiLocale.startsWith("ru");
	const title = isRu ? n.title_ru : n.title_en;
	const summary = isRu ? n.summary_ru : n.summary_en;
	const body = isRu ? n.body_md_ru : n.body_md_en;

	const dateLabel = safeDateLabel(n.published_at, uiLocale);
	const paragraphs = splitParagraphs(String(body ?? ""));

	return (
		<PageWithStickyHero
			imageSrc="/images/news-slug.jpg"
			overlap={false}
			title={t("title")}
			subtitle={title}
			description={summary}
			descriptionOnImageRole={true}
			style={
				{
					"--hero-anchor-x": "50%",
					"--hero-anchor-y": "50%",
					"--hero-x": "0px",
					"--hero-y": "0px",
					"--hero-x-mobile": "90px",
					"--hero-y-mobile": "-60px",
					"--hero-height": "clamp(420px, 70svh, 820px)",
					"--hero-overlay-top": "0.70",
					"--hero-overlay-mid": "0.44",
					"--hero-overlay-bot": "0.26",
					"--hero-overlay-blur": "0px",
					"--hero-overlay-sat": "1.2",
				} as CSSProperties
			}
		>
			<section className={styles.newsSection}>
				<div className={styles.newsSquare}>
					<div className={styles.newsList}>
						<div className={styles.formInline}>
							<Link href={siteConfig.newsHref} className="button button-ghost">
								<span aria-hidden="true">{tGlobal("Common.symbols.arrowLeft")}</span>
								{tGlobal("header.actions.backToNews")}
							</Link>
						</div>

						{/* Static article card (no hover lift) */}
						<article className={`${styles.newsItem} ${styles.newsItemStatic}`}>
							<div className={styles.newsMetaRow}>
								<p className={styles.newsItemMeta}>{dateLabel}</p>
							</div>

							<h2 className={styles.newsItemTitle}>{title}</h2>

							<p className={`${styles.summary} text-sm text-muted`}>{summary}</p>

							<div className={styles.articleBody}>
								{paragraphs.map((p, idx) => (
									<p key={`${n.id}-p-${idx}`} className={styles.newsItemSummary}>
										{p}
									</p>
								))}
							</div>

							<Link href={siteConfig.newsPath} className={styles.newsReadMore}>
								<span className="text-sm text-bold">{t("backToList")}</span>
								<span className={styles.readMoreArrow} aria-hidden="true">
									{tGlobal("Common.symbols.arrowLeft")}
								</span>
							</Link>
						</article>
					</div>
				</div>
			</section>
		</PageWithStickyHero>
	);
}
