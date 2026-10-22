/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/about/page.tsx
SCOPE: About page. Visual-only: uses PageShell/MainColumn + global hero-shell/hero-inner + global typography + global buttons.
STATUS: UNLOCKED (lock after verified)
NOTES:
- HERO MUST use required structure: PageShell -> header.hero-shell -> .hero-inner -> h1.hero-title, p.hero-subtitle, p.hero-desc
- Only i18n keys allowed to change are hero keys: title/subtitle/description (About namespace).
- Do NOT redefine hero typography here; use globals.css hero roles.
- Keep framer-motion for entrance only.
- Uses global hero primitive: PageWithStickyHero (sticky image overlay logic).
*/

"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import { useMemo } from "react";
import { siteConfig } from "@/config/siteConfig";

import { PageWithStickyHero } from "@/components/ui/hero/PageWithStickyHero";

import styles from "./about.module.css";

/* =========================================================
   Inline Icons (brand-aligned tiles)
   ========================================================= */

function IconCap() {
	return (
		<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path
				d="M3 7.5L12 3l9 4.5-9 4.5L3 7.5Z"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinejoin="round"
			/>
			<path
				d="M7 10v6.2c0 .7 2.2 2.8 5 2.8s5-2.1 5-2.8V10"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
			/>
		</svg>
	);
}

function IconGlobe() {
	return (
		<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" stroke="currentColor" strokeWidth="2" />
			<path d="M3 12h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
			<path
				d="M12 3c2.5 2.6 4 5.7 4 9s-1.5 6.4-4 9c-2.5-2.6-4-5.7-4-9s1.5-6.4 4-9Z"
				stroke="currentColor"
				strokeWidth="2"
			/>
		</svg>
	);
}

function IconBriefcase() {
	return (
		<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path
				d="M9 7V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
			/>
			<path
				d="M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinejoin="round"
			/>
			<path d="M4 13h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
		</svg>
	);
}

function IconBuild() {
	return (
		<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path d="M3 20h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
			<path
				d="M7 20V10l5-4 5 4v10"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinejoin="round"
			/>
			<path d="M10 20v-5h4v5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
		</svg>
	);
}

function IconSun() {
	return (
		<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" stroke="currentColor" strokeWidth="2" />
			<path
				d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
			/>
		</svg>
	);
}

function IconPin() {
	return (
		<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
			<path
				d="M12 21s7-4.4 7-11a7 7 0 1 0-14 0c0 6.6 7 11 7 11Z"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinejoin="round"
			/>
			<path
				d="M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
				stroke="currentColor"
				strokeWidth="2"
			/>
		</svg>
	);
}

/* =========================================================
   Page
   ========================================================= */

export default function AboutPage() {
	const t = useTranslations("About");

	const fadeInUp = {
		initial: { opacity: 0, y: 20 },
		whileInView: { opacity: 1, y: 0 },
		viewport: { once: true, amount: 0.2 },
		transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const },
	};

	const advantages = [
		"advantages.localTeam",
		"advantages.languages",
		"advantages.experience",
		"advantages.loyalty",
		"advantages.translation",
		"advantages.tailoredPath",
	];

	const serviceBlocks = [
		"services.immigration",
		"services.education",
		"services.realEstate",
		"services.internationalVisas",
	];
	
	const tHeroKpi = useTranslations("Home.hero.kpi");

	return (
		<PageWithStickyHero
			imageSrc="/images/about.jpg"
			overlap={false}
			title={
				<motion.span
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
				>
					{t("title")}
				</motion.span>
			}
			subtitle={
				<motion.span
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
				>
					{t("subtitle")}
				</motion.span>
			}
			description={
				<motion.span
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
				>
					{t("description")}
				</motion.span>
			}
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
					"--hero-overlay-top": "0.5",
					"--hero-overlay-mid": "0.3",
					"--hero-overlay-bot": "0.1",
					"--hero-overlay-blur": "1.3px",
					"--hero-overlay-sat": "2",

					"--hero-title-color": "var(--eggshell)",
					"--hero-subtitle-color": "var(--savanna-gold)",
					"--hero-desc-color": "var(--eggshell)",
					"--hero-desc-onImage-color": "var(--eggshell)",
				} as CSSProperties
			}
		>
			<div className={styles.page}>
				{/* 1) WHO WE ARE — Story Grid */}
				<section className={styles.section}>
					<div className={styles.square}>
						<div className={styles.storyGrid}>
							<motion.div {...fadeInUp}>
								<div className={styles.sectionHeader}>
									<h2 className="page-title">{t("whoWeAre.title")}</h2>
								</div>

								<div className={styles.storyBodyCanvas}>
									<p className={styles.bodyLead}>{t("whoWeAre.body1")}</p>
									<p className="text-muted">{t("whoWeAre.body2")}</p>
								</div>

								<div className={styles.highlightStrip}>
									{advantages.map((key, i) => (
										<motion.div
											key={key}
											className={styles.glassPill}
											initial={{ opacity: 0, x: -10 }}
											whileInView={{ opacity: 1, x: 0 }}
											transition={{ delay: i * 0.08, duration: 0.5 }}
											viewport={{ once: true }}
										>
											<span className="text-sm text-bold">{t(key)}</span>
										</motion.div>
									))}
								</div>
							</motion.div>

							{/* Visual with signature badge */}
							<motion.div
								className={styles.storyVisual}
								initial={{ opacity: 0, x: 20 }}
								whileInView={{ opacity: 1, x: 0 }}
								transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
								viewport={{ once: true }}
							>
								<div className={styles.visualFrame}>
									<Image
										src="/home/about-texture.jpg"
										alt={t("imageAlt")}
										fill
										className={styles.visualImg}
										sizes="(max-width: 920px) 92vw, 46vw"
									/>
									<div className={styles.visualOverlay} />

									<div className={styles.experienceSignature}>
										<div className={styles.spinningWrapper}>
											<svg
												viewBox="0 0 100 100"
												className={styles.spinningTextSVG}
												style={{ "--circle-r": "40" } as React.CSSProperties}
												>
												<defs>
													<path
													id="circlePath"
													pathLength="1000"
													d="
														M 50, 50
														m calc(-1 * var(--circle-r)), 0
														a var(--circle-r),var(--circle-r) 0 1,1 calc(2 * var(--circle-r)),0
														a var(--circle-r),var(--circle-r) 0 1,1 calc(-2 * var(--circle-r)),0
													"
													/>
												</defs>
												
												<text className={styles.circleText}>
													<textPath
													href="#circlePath"
													startOffset="50%"
													textAnchor="middle"
													textLength="1000"
													lengthAdjust="spacing"
													>
													{tHeroKpi("circlePath")}
													</textPath>
												</text>
											</svg>
												
										</div>

										<div className={styles.sigValue}>
											{tHeroKpi("yearsInSA.value")}
											<span>{tHeroKpi("yearsInSA.label")}</span>
										</div>
									</div>
								</div>
							</motion.div>
						</div>
					</div>
				</section>

				{/* 2) WHY SOUTH AFRICA */}
				<section className={styles.section}>
					<motion.div className={styles.squareTight} {...fadeInUp}>
						<div className={styles.sectionHeader}>
							<h2 className="page-title">{t("whySouthAfrica.title")}</h2>
						</div>
						<p className={`text-muted ${styles.featureIntro}`}>{t("whySouthAfrica.intro")}</p>

						<div className={styles.featureGrid}>
							{[
								{ key: "education", Icon: IconCap },
								{ key: "visaFree", Icon: IconGlobe },
								{ key: "business", Icon: IconBriefcase },
								{ key: "bricks", Icon: IconBuild },
								{ key: "lifestyle", Icon: IconSun },
							].map(({ key, Icon }) => (
								<motion.div key={key} className={styles.featureCard} whileHover={{ y: -8, transition: { duration: 0.3 } }}>
									<div className={styles.featureIcon} aria-hidden="true">
										<Icon />
									</div>
									<p className={styles.featureText}>{t(`whySouthAfrica.${key}`)}</p>
								</motion.div>
							))}
						</div>
					</motion.div>
				</section>

				{/* 3) THREE STEP PROCESS */}
				<section className={styles.section}>
					<div className={styles.squareTight}>
						<motion.div className={styles.sectionHeader} {...fadeInUp}>
							<h2 className="page-title">{t("steps.title")}</h2>
							<p className="text-muted">{t("steps.intro")}</p>
						</motion.div>

						<div className={styles.processGrid}>
							{[
								{ key: "eligibility", id: "01" },
								{ key: "preparation", id: "02" },
								{ key: "submission", id: "03" },
							].map((step, i) => (
								<motion.div
									key={step.key}
									className={styles.processStep}
									initial={{ opacity: 0, y: 30 }}
									whileInView={{ opacity: 1, y: 0 }}
									transition={{ delay: i * 0.15, duration: 0.8 }}
									viewport={{ once: true }}
								>
									<div className={styles.stepNumber}>{step.id}</div>
									<h3 className="text-bold">{t(`steps.${step.key}.title`)}</h3>
									<p className="text-muted">{t(`steps.${step.key}.body`)}</p>
								</motion.div>
							))}
						</div>
					</div>
				</section>

				{/* 4) LOCATION */}
				<section className={styles.section}>
					<div className={styles.squareTight}>
						<motion.div className={styles.sectionHeader} {...fadeInUp}>
							<h2 className="page-title">{t("location.title")}</h2>
							<p className="text-muted">{t("location.subtitle")}</p>
						</motion.div>

						<div className={styles.locationGrid}>
							<motion.div className={styles.locationCard} {...fadeInUp}>
								<div className={styles.locationTop}>
									<div className={styles.locationIcon} aria-hidden="true">
										<IconPin />
									</div>
									<div className={styles.locationMeta}>
										<p className={styles.locationName}>{t("location.placeName")}</p>
										<p className="text-muted">{t("location.placeHint")}</p>
									</div>
								</div>

								<address className={styles.addressBlock}>
									<p className={styles.addressLine}>{t("location.line1")}</p>
									<p className={styles.addressLine}>{t("location.line2")}</p>
									<p className={styles.addressLine}>{t("location.line3")}</p>
									<p className={styles.addressLine}>{t("location.line4")}</p>
									<p className={styles.addressLine}>{t("location.postcode")}</p>
								</address>

								{/* Buttons */}
								<div className={styles.locationActions}>
									<Link href={siteConfig.contactPath} className="button button-ghost">
										{t("location.contactCta")}
									</Link>
								</div>
							</motion.div>

							<motion.div className={styles.locationNote} {...fadeInUp}>
								<p className="text-muted">{t("location.note")}</p>
							</motion.div>
						</div>
					</div>
				</section>

				{/* 5) SERVICES */}
				<section className={styles.section}>
					<div className={styles.squareTight}>
						<motion.div className={styles.sectionHeader} {...fadeInUp}>
							<h2 className="page-title">{t("services.title")}</h2>
						</motion.div>

						<div className={styles.servicesGrid}>
							{serviceBlocks.map((base, i) => (
								<motion.article
									key={base}
									className={`${styles.serviceCard} glass-vessel`}
									initial={{ opacity: 0 }}
									whileInView={{ opacity: 1 }}
									transition={{ delay: i * 0.1, duration: 0.6 }}
									viewport={{ once: true }}
								>
									<h3 className="text-bold">{t(`${base}.title`)}</h3>
									<p className="text-muted">{t(`${base}.body`)}</p>
									<ul className={styles.serviceList}>
										<li className="text-sm">{t(`${base}.items.0`)}</li>
										<li className="text-sm">{t(`${base}.items.1`)}</li>
										<li className="text-sm">{t(`${base}.items.2`)}</li>
									</ul>
								</motion.article>
							))}
						</div>

						<div className={styles.bottomCtaRow}>
							<Link href={siteConfig.servicesPath} className="button button-ghost">
								{t("ctaExploreServices")}
							</Link>
							<Link href={siteConfig.contactPath} className="button button-primary">
								{t("ctaTalkToConsultant")}
							</Link>
						</div>
					</div>
				</section>

			</div>
		</PageWithStickyHero>
	);
}
