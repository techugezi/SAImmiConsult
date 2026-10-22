/* ==========================================================================
   page.tsx
   Location: /src/app/[locale]/services/page.tsx
   Scope: Services overview (public). Uses GLOBAL hero + GLOBAL primitives
          (PageShell/MainColumn). Cards use services.module.css visuals only.
   Status: UNLOCKED (lock after verified)

   Notes:
   - REQUIRED HERO (NO EXCEPTIONS):
     <PageShell>
       <header className="hero-shell">
         <div className="hero-inner">
           <h1 className="hero-title">{t("title")}</h1>
           <p className="hero-subtitle">{t("subtitle")}</p>
           <p className="hero-desc">{t("description")}</p>

   - Only i18n key changes allowed here are for: title/subtitle/description.
   - Buttons MUST use global classes:
     button button-primary / button button-secondary / button button-ghost
   - services.module.css is visuals-only for cards (no page shell / column layout responsibility).
   - Uses global hero primitive: PageWithStickyHero (sticky image overlay logic).
   ========================================================================== */

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/config/siteConfig";
import type { CSSProperties, ReactElement, ComponentProps } from "react";

import { PageWithStickyHero } from "@/components/ui/hero/PageWithStickyHero";

import styles from "./services.module.css";

const SERVICE_KEYS = ["immigration", "emigration", "visaTypes", "additionalSupport"] as const;

type ServiceKey = (typeof SERVICE_KEYS)[number];

type AppHref = ComponentProps<typeof Link>["href"];

const SERVICE_LINKS: Record<ServiceKey, AppHref> = {
	immigration: siteConfig.servicesImmigrationHref,
	emigration: siteConfig.servicesEmigrationHref,
	visaTypes: siteConfig.servicesVisaTypesHref,
	additionalSupport: siteConfig.servicesAdditionalSupportHref,
};

/** Icons */
function IconImmigration() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path
				d="M12 21s7-4.6 7-10.2C19 6.9 15.9 4 12 4S5 6.9 5 10.8C5 16.4 12 21 12 21Z"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
			/>
			<path
				d="M9.6 10.8a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0-4.8 0Z"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
			/>
		</svg>
	);
}

function IconEmigration() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path
				d="M3 16.5l9-4.5 9 4.5-9-12-9 12Z"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinejoin="round"
			/>
			<path
				d="M12 12v8"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
			/>
		</svg>
	);
}

function IconVisa() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path
				d="M7 4h7l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
			/>
			<path d="M14 4v4h4" fill="none" stroke="currentColor" strokeWidth="2" />
			<path
				d="M8 13h8M8 17h6"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
			/>
		</svg>
	);
}

function IconSupport() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true">
			<path
				d="M12 22s8-4 8-10V7l-8-3-8 3v5c0 6 8 10 8 10Z"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinejoin="round"
			/>
			<path
				d="M9 12l2 2 4-4"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function ServiceIcon({ k }: { k: ServiceKey }) {
	const map: Record<ServiceKey, ReactElement> = {
		immigration: <IconImmigration />,
		emigration: <IconEmigration />,
		visaTypes: <IconVisa />,
		additionalSupport: <IconSupport />,
	};

	return map[k];
}

export default function ServicesPage() {
	const t = useTranslations("ServicesOverview");
	const tGlobal = useTranslations("GlobalForm");

	return (
		<PageWithStickyHero
			imageSrc="/images/services.jpg"
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
					"--hero-y-mobile": "0px",
					"--hero-height": "clamp(420px, 70svh, 820px)",
					"--hero-overlay-top": "0.70",
					"--hero-overlay-mid": "0.44",
					"--hero-overlay-bot": "0.26",
					"--hero-overlay-blur": "0px",
					"--hero-overlay-sat": "1.2",
				} as CSSProperties
			}
			actions={
				<div className="hero-actions">
					<Link href={siteConfig.contactHref} className="button button-primary">
						{t("header.primaryCta")}
					</Link>

					<Link href={siteConfig.faqHref} className="button button-secondary">
						{t("header.secondaryCta")}
					</Link>
				</div>
			}
		>
			<div className="stack">
				<div>
					<h2 className="page-title">{t("grid.title")}</h2>
					<p className="text-muted">{t("grid.subtitle")}</p>
				</div>

				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
						gap: "clamp(1rem, 2.2vw, 1.5rem)",
						alignItems: "stretch",
					}}
				>
					{SERVICE_KEYS.map((key) => (
						<Link
							key={key}
							href={SERVICE_LINKS[key]}
							className={styles.serviceCard}
							aria-label={t(`cards.${key}.title`)}
						>
							<div className={styles.serviceCardInner}>
								<div className={styles.serviceIcon} aria-hidden="true">
									<ServiceIcon k={key} />
								</div>

								<h3 className={`text-bold ${styles.serviceCardTitle}`}>{t(`cards.${key}.title`)}</h3>

								<p className={`text-muted ${styles.serviceCardBody}`}>{t(`cards.${key}.body`)}</p>

								<div className={styles.serviceCardLink} aria-hidden="true">
									<span className="text-sm text-bold">{t(`cards.${key}.cta`)}</span>

									<span className={styles.ctaArrow} aria-hidden="true">
										{tGlobal("Common.symbols.arrowRight")}
									</span>
								</div>
							</div>
						</Link>
					))}
				</div>
			</div>
		</PageWithStickyHero>
	);
}
