/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/faq/page.tsx
SCOPE: Public FAQ list (cached server reads + locale-specific fields).
STATUS: UNLOCKED (lock after verified)
NOTES:
- Uses global hero primitive: PageWithStickyHero (sticky image overlay logic).
*/

import { getLocale, getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";

import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/config/siteConfig";

import { getPublicFaq } from "@/lib/siteContent";

import { PageWithStickyHero } from "@/components/ui/hero/PageWithStickyHero";
import { Panel } from "@/components/ui/panel/Panel";
import SearchField from "@/components/ui/SearchField/SearchField";
import FaqLedger from "@/components/ui/FaqLedger/FaqLedger";

import styles from "./faq.module.css";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

type SearchParamsShape = {
	q?: string | string[];
};

function normalizeSearchParam(value: string | string[] | undefined, fallback = ""): string {
	if (!value) return fallback;
	if (Array.isArray(value)) return value[0] ?? fallback;
	return value;
}

function buildFaqHref({ q }: { q?: string }) {
	const qq = (q || "").trim();

	// Object-href for next-intl <Link/>
	if (!qq) {
		return { pathname: siteConfig.faqPath } as const;
	}

	return { pathname: siteConfig.faqPath, query: { q: qq } } as const;
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default async function FAQPage({
	searchParams,
}: {
	// IMPORTANT: Next.js 16.1.6 PageProps expects Promise here (per your build error).
	searchParams?: Promise<SearchParamsShape>;
}) {
	const locale = await getLocale();
	const isRu = String(locale).startsWith("ru");

	const t = await getTranslations("FAQ");

	const resolvedSearchParams = (await searchParams) ?? {};
	const qRaw = normalizeSearchParam(resolvedSearchParams.q, "");
	const q = qRaw.trim();
	const qLower = q.toLowerCase();

	const faqs = await getPublicFaq();

	const filteredFaqs = !q
		? faqs
		: faqs.filter((f) => {
				const question = isRu ? f.question_ru : f.question_en;
				const answer = isRu ? f.answer_md_ru : f.answer_md_en;

				const hay = `${question ?? ""}\n${answer ?? ""}`.toLowerCase();
				return hay.includes(qLower);
		  });

	return (
		<PageWithStickyHero
			imageSrc="/images/faq.jpg"
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
					"--hero-y": "-30px",
					"--hero-x-mobile": "120px",
					"--hero-y-mobile": "-60px",
					"--hero-height": "clamp(420px, 70svh, 820px)",
					"--hero-overlay-top": "0.70",
					"--hero-overlay-mid": "0.44",
					"--hero-overlay-bot": "0.26",
					"--hero-overlay-blur": "0px",
					"--hero-overlay-sat": "2",
				} as CSSProperties
			}
		>
			<div className={`content-gutter ${styles.faqPanel}`}>
				<Panel
					title={t("panel.title")}
					subtitle={q ? t("search.subtitleWithQuery", { q }) : t("panel.subtitle")}
					actions={
						<div className={styles.panelActionsShell}>
							<SearchField
								// Submits to the localized route (GET /{locale}/faq?q=...)
								action={`/${locale}${siteConfig.faqPath}`}
								name="q"
								defaultValue={q}
								clearHref={buildFaqHref({})}
								srLabel={t("search.label")}
								placeholder={t("search.placeholder")}
								clearLabel={t("search.clear")}
								searchLabel={t("search.submit")}
							/>
						</div>
					}
				>
					{q && filteredFaqs.length === 0 ? (
						<div className={styles.emptyState} role="status" aria-live="polite">
							<p className={styles.emptyTitle}>{t("search.noResults.title")}</p>
							<p className={styles.emptyDesc}>{t("search.noResults.desc", { q })}</p>
							<div className={styles.emptyActions}>
								<Link href={buildFaqHref({})} className="button button-ghost">
									{t("search.noResults.clearCta")}
								</Link>
							</div>
						</div>
					) : (
						<FaqLedger
							items={filteredFaqs
								.map((f) => {
									const question = (isRu ? f.question_ru : f.question_en) ?? "";
									const answer = (isRu ? f.answer_md_ru : f.answer_md_en) ?? "";
									return {
										id: f.id,
										question: String(question).trim(),
										answer: String(answer).trim(),
									};
								})
								.filter((x) => x.question.length > 0 && x.answer.length > 0)}
						/>
					)}
				</Panel>
			</div>
		</PageWithStickyHero>
	);
}
