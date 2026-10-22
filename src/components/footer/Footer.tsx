/*
DOC NAME: Footer.tsx
LOCATION: /src/components/footer/Footer.tsx
SCOPE: Global site footer (minimal, screenshot-style). Logo + stacked link rows above divider,
       clocks + socials + footer note below divider.
STATUS: UNLOCKED (lock after verified)
AUDIT:
- No hardcoded UI strings: uses next-intl keys for labels.
- Flat layout: no card surfaces.
*/

"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/config/siteConfig";
import styles from "./Footer.module.css";
import { useTranslations } from "next-intl";

type TimesState = { za: string; ru: string };

function formatTime(timeZone: string): string {
	const options: Intl.DateTimeFormatOptions = {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	};
	return new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).format(new Date());
}

export function Footer() {
	const t = useTranslations("Footer");

	const [times, setTimes] = useState<TimesState>({ za: "--:--", ru: "--:--" });
	const [showBackToTop, setShowBackToTop] = useState(false);

	const year = useMemo(() => new Date().getFullYear(), []);

	useEffect(() => {
		const update = () => {
			setTimes({
				za: formatTime("Africa/Johannesburg"),
				ru: formatTime("Europe/Moscow"),
			});
		};

		update();
		const timer = setInterval(update, 30_000);
		return () => clearInterval(timer);
	}, []);

	useEffect(() => {
		const onScroll = () => {
			const threshold = Math.max(520, Math.floor(window.innerHeight * 0.9));
			setShowBackToTop(window.scrollY > threshold);
		};

		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const socialLinks = useMemo(
		() => [
			{
				id: "instagram",
				href: siteConfig.instagramUrl,
				label: t("social.instagram"),
				aria: t("social.instagramAria"),
				icon: (
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<rect x="2.5" y="2.5" width="19" height="19" rx="5" stroke="currentColor" strokeWidth="1.8" />
						<path
							d="M16.2 11.9a4.2 4.2 0 1 1-8.4 0 4.2 4.2 0 0 1 8.4 0Z"
							stroke="currentColor"
							strokeWidth="1.8"
						/>
						<path d="M17.6 6.5h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
					</svg>
				),
			},
			{
				id: "facebook",
				href: siteConfig.facebookUrl,
				label: t("social.facebook"),
				aria: t("social.facebookAria"),
				icon: (
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path
							d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v3H7v3h3v6h3v-6h3l1-3h-4v-3c0-.6.4-1 1-1Z"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinejoin="round"
							strokeLinecap="round"
						/>
					</svg>
				),
			},
			{
				id: "vk",
				href: siteConfig.vkUrl,
				label: t("social.vk"),
				aria: t("social.vkAria"),
				icon: (
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path
							d="M3.5 7.5h3.4c.3 0 .6.2.7.5.6 1.6 1.7 3.9 2.9 5 .5.4.8.3.8-.3V7.9c0-.2.1-.4.3-.4h3.2c.2 0 .4.2.4.4v3.8c0 .4.2.5.5.3 1.2-.8 2.7-2.8 3.5-4.3.1-.2.3-.3.6-.3h3.3c.4 0 .6.4.4.8-.8 1.5-2.6 4.2-4 5.6-.2.2-.2.5 0 .7 1.5 1.3 3.2 3.2 3.9 4.4.2.4-.1.8-.5.8h-3.6c-.2 0-.4-.1-.5-.3-.6-.9-1.6-2.3-2.7-3.3-.4-.4-.8-.3-.8.3v3c0 .2-.2.5-.5.5h-1.6c-4.9 0-8.7-3.4-10.7-11.2-.1-.3.2-.7.6-.7Z"
							stroke="currentColor"
							strokeWidth="1.4"
							strokeLinejoin="round"
						/>
					</svg>
				),
			},
			{
				id: "telegram",
				href: siteConfig.telegramUrl,
				label: t("social.telegram"),
				aria: t("social.telegramAria"),
				icon: (
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path
							d="M21.5 4.7 3.7 11.6c-1.2.5-1.2 1.2-.2 1.5l4.6 1.4 1.7 5.2c.2.6.1.8.7.8.5 0 .7-.2 1-.5l2.2-2.1 4.5 3.3c.8.4 1.3.2 1.5-.8l3.1-14.6c.3-1.2-.5-1.7-1.3-1.3Z"
							stroke="currentColor"
							strokeWidth="1.6"
							strokeLinejoin="round"
						/>
					</svg>
				),
			},
		],
		[t]
	);

	return (
		<>
			<footer className={styles.footer}>
				<div className={styles.container}>
					{/* TOP (above divider): logo left + stacked rows of links */}
					<div className={styles.topLayout}>
						<div className={styles.brandBlock}>
							<Image
								src="/pnglogo_black.png"
								alt={siteConfig.brandName}
								width={380}
								height={190}
								className={styles.logo}
							/>
						</div>

						<nav className={styles.linkStack} aria-label={t("aria.footerNav")}>
							<div className={styles.linkCol}>
								<Link href={siteConfig.aboutHref} className={styles.footerLink}>
									{t("links.about")}
								</Link>
								<Link href={siteConfig.servicesHref} className={styles.footerLink}>
									{t("links.services")}
								</Link>
								<Link href={siteConfig.contactHref} className={styles.footerLink}>
									{t("links.contact")}
								</Link>
								<Link href={siteConfig.loginHref} className={styles.footerLink}>
									{t("links.login")}
								</Link>								
							</div>

							<div className={styles.linkCol}>
								<Link href={siteConfig.newsHref} className={styles.footerLink}>
									{t("links.news")}
								</Link>
								<Link href={siteConfig.faqHref} className={styles.footerLink}>
									{t("links.faq")}
								</Link>
							</div>

							<div className={styles.linkCol}>
								<Link href={siteConfig.servicesImmigrationHref} className={styles.footerLink}>
									{t("links.subServices.immigration")}
								</Link>
								<Link href={siteConfig.servicesEmigrationHref} className={styles.footerLink}>
									{t("links.subServices.emigration")}
								</Link>
								<Link href={siteConfig.servicesVisaTypesHref} className={styles.footerLink}>
									{t("links.subServices.visaTypes")}
								</Link>
								<Link href={siteConfig.servicesAdditionalSupportHref} className={styles.footerLink}>
									{t("links.subServices.additionalServices")}
								</Link>
							</div>
						</nav>
					</div>

					{/* DIVIDER (middle) */}
					<div className={styles.midDivider} aria-hidden="true" />

					{/* BOTTOM (below divider): clocks -> socials -> footer note */}
					<div className={styles.bottomCenter}>
						<div className={styles.clocks}>
							<div className={styles.clockItem}>
								<span className={styles.cityLabel}>{t("status.cityZa")}</span>
								<span className={styles.digitalTime}>{times.za}</span>
							</div>

							<span className={styles.clockDivider} aria-hidden="true" />

							<div className={styles.clockItem}>
								<span className={styles.cityLabel}>{t("status.cityRu")}</span>
								<span className={styles.digitalTime}>{times.ru}</span>
							</div>
						</div>

						<div className={styles.socialRow}>
							{socialLinks.map((s) => (
								<a
									key={s.id}
									href={s.href}
									target="_blank"
									rel="noreferrer"
									className={styles.socialIconLink}
									aria-label={s.aria}
									title={s.label}
								>
									{s.icon}
								</a>
							))}
						</div>

						<div className={styles.footerNote}>
							<span className={styles.copyright}>{t("legal.copyright", { year })}</span>
						</div>
					</div>
				</div>
			</footer>

			{/* Back to top */}
			<button
				type="button"
				className={`${styles.backToTop} ${showBackToTop ? styles.backToTopVisible : ""}`}
				onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
				aria-label={t("backToTop.text")}
			>
				<span className={styles.backToTopCircle} aria-hidden="true">
					<svg
						className={styles.backToTopIcon}
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5"
					>
						<path d="M7 17L17 7M17 7H7M17 7V17" />
					</svg>
				</span>

				<span className={styles.backToTopText}>{t("backToTop.text")}</span>
			</button>
		</>
	);
}
