/*
DOC NAME: page.tsx
LOCATION: /src/app/[locale]/home/page.tsx
SCOPE: Public Home page (client) with hero + sections; uses NewsTicker + DB-driven FAQ preview.
STATUS: UNLOCKED (lock after verified)
*/

"use client";

import { useEffect, useMemo, useRef, useState, ComponentProps } from "react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/config/siteConfig";
import styles from "./home.module.css";
import {
	AnimatePresence,
	motion,
	useInView,
	useMotionTemplate,
	useReducedMotion,
	useScroll,
	useTransform,
} from "framer-motion";

import type { Variants } from "framer-motion";

import NewsTicker from "@/components/ui/NewsTicker/NewsTicker";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
const EASE_IN_OUT: [number, number, number, number] = [0.65, 0, 0.35, 1];

// ------------------------------------------------------
// Shared section reveal variants
// ------------------------------------------------------
const sectionRevealVariants: Variants = {
	hidden: { opacity: 0, y: 40 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.8, ease: EASE_OUT },
	},
};

/**
 * Fit a two-line title so EACH line stays on one line (nowrap),
 * choosing the largest font-size within [minPx, maxPx] that fits.
 *
 * Applies via CSS var: --heroTitleFit on the title element.
 */
function fitTwoLineTitle(
	titleEl: HTMLElement,
	line1El: HTMLElement,
	line2El: HTMLElement,
	opts: { minPx: number; maxPx: number; precisionPx: number },
) {
	const minPx = Math.max(1, opts.minPx);
	const maxPx = Math.max(minPx, opts.maxPx);
	const precisionPx = Math.max(0.1, opts.precisionPx);

	// Avoid pointless work if the element is not measurable yet.
	const containerW = titleEl.getBoundingClientRect().width;
	if (!Number.isFinite(containerW) || containerW <= 0) return;

	const apply = (px: number) => {
		titleEl.style.setProperty("--heroTitleFit", `${px}px`);
	};

	const fits = (px: number) => {
		apply(px);

		// Force layout read after apply (sync measurement)
		const w1 = Math.ceil(line1El.scrollWidth);
		const w2 = Math.ceil(line2El.scrollWidth);
		const needed = Math.max(w1, w2);

		// Use clientWidth for true available inline space
		const available = Math.floor(titleEl.clientWidth);

		return needed <= available;
	};

	// Fast path: if even max fits, just use it.
	if (fits(maxPx)) {
		apply(maxPx);
		return;
	}

	// If min doesn't fit, clamp to min (best we can do).
	if (!fits(minPx)) {
		apply(minPx);
		return;
	}

	// Binary search for best fit within precision.
	let lo = minPx;
	let hi = maxPx;

	while (hi - lo > precisionPx) {
		const mid = (lo + hi) / 2;
		if (fits(mid)) lo = mid;
		else hi = mid;
	}

	apply(Math.max(minPx, Math.floor(lo / precisionPx) * precisionPx));
}

function AnimatedCounter({ end, plus = false }: { end: number; plus?: boolean }) {
	const [count, setCount] = useState(0);
	const ref = useRef<HTMLDivElement>(null);
	const inView = useInView(ref, { once: true });

	useEffect(() => {
		if (!inView) return;

		let current = 0;
		const increment = end / 80; // ~2s duration
		const timer = setInterval(() => {
			current += increment;
			if (current >= end) {
				setCount(end);
				clearInterval(timer);
			} else {
				setCount(Math.floor(current));
			}
		}, 25);

		return () => clearInterval(timer);
	}, [inView, end]);

	return (
		<div ref={ref} className={styles.kpiValue}>
			{count}
			{plus && "+"}
		</div>
	);
}

/* -------------------------------------------------------------------------- */
/* Types (client-safe public feeds)                                           */
/* -------------------------------------------------------------------------- */

type HomeNewsItem = {
	id: string;
	slug: string;
	published_at: string | null;
	pinned: boolean;
	title_en: string;
	title_ru: string;
};

type HomeNewsApiResponse = {
	items: HomeNewsItem[];
};

type HomeFaqItem = {
	id: string;
	question_en: string;
	question_ru: string;
	answer_md_en: string;
	answer_md_ru: string;
	sort_order?: number | null;
	updated_at?: string | null;
};

type HomeFaqApiResponse = {
	items: HomeFaqItem[];
};

type AppHref = ComponentProps<typeof Link>["href"];

type HomeCtaProps = {
	href: AppHref;
	label: string;
	className?: string;
};

function HomeMagneticCta({ href, label, className }: HomeCtaProps) {
	const extra = className ? ` ${className}` : "";

	return (
		<Link href={href} className={`${styles.homeMagneticCta}${extra}`}>
			<div className={styles.homeCtaCircle} aria-hidden="true">
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2.5"
				>
					<path d="M7 17L17 7M17 7H7M17 7V17" />
				</svg>
			</div>
			<span className={styles.homeCtaLabel}>{label}</span>
		</Link>
	);
}

/* -------------------------------------------------------------------------- */
/* Minimal, production-safe fetch helper (timeout + abort)                     */
/* -------------------------------------------------------------------------- */

async function fetchJsonWithTimeout<T>(input: string, opts: { timeoutMs: number }): Promise<T> {
	const controller = new AbortController();
	const id = window.setTimeout(() => controller.abort(), Math.max(250, opts.timeoutMs));

	try {
		const res = await fetch(input, {
			method: "GET",
			headers: { Accept: "application/json" },
			signal: controller.signal,
		});

		if (!res.ok) {
			throw new Error(`fetch failed (${res.status})`);
		}

		return (await res.json()) as T;
	} finally {
		window.clearTimeout(id);
	}
}

// ──────────────────────────────────────────────────────
// 1) MAIN PAGE & CONTENT
// ──────────────────────────────────────────────────────
export default function Home() {
	const t = useTranslations("Home");
	const locale = useLocale();
	const prefersReducedMotion = useReducedMotion();

	// Reference for scroll tracking
	const heroRef = useRef<HTMLElement>(null);

	// Title fitting (keeps line1/line2 on a single line each, across any width)
	const titleRef = useRef<HTMLHeadingElement>(null);
	const titleLine1Ref = useRef<HTMLSpanElement>(null);
	const titleLine2Ref = useRef<HTMLSpanElement>(null);

	const { scrollYProgress } = useScroll({
		target: heroRef,
		offset: ["start start", "end start"],
	});

	// Fade + lift on scroll
	const textOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
	const textY = useTransform(scrollYProgress, [0, 0.5], [0, -50]);

	// Blur the COPY ONLY (not CTAs) so both buttons fade consistently
	const copyBlurPx = useTransform(scrollYProgress, [0, 0.5], [0, 10]);
	const copyFilter = useMotionTemplate`blur(${copyBlurPx}px)`;

	// ──────────────────────────────────────────────────────
	// Home News feed (client-safe)
	// ──────────────────────────────────────────────────────
	const [homeNews, setHomeNews] = useState<HomeNewsItem[] | null>(null);

	useEffect(() => {
		let alive = true;

		const run = async () => {
			try {
				const json = await fetchJsonWithTimeout<HomeNewsApiResponse>("/api/public/news?limit=6", {
					timeoutMs: 8000,
				});

				const items = Array.isArray(json?.items) ? json.items : [];
				if (!alive) return;

				setHomeNews(items);
			} catch {
				if (!alive) return;
				setHomeNews(null);
			}
		};

		run();

		return () => {
			alive = false;
		};
	}, []);

	const tickerItems = useMemo(() => {
		// No fallback. If no DB items, show nothing.
		const isRu = locale.startsWith("ru");

		if (!homeNews || homeNews.length === 0) return [];

		return homeNews
			.map((n) => {
				const headline = (isRu ? n.title_ru : n.title_en).trim();
				return {
					key: n.id,
					headline,
					// Keep relative. next-intl Link will locale-prefix.
					href: siteConfig.newsArticleHref(n.slug),
				};
			})
			.filter((i) => i.headline.length > 0);
	}, [homeNews, locale]);

	// ──────────────────────────────────────────────────────
	// Home FAQ preview (TOP 3, ordered by API; no translation fallback)
	// ──────────────────────────────────────────────────────
	const [homeFaq, setHomeFaq] = useState<HomeFaqItem[] | null>(null);

	useEffect(() => {
		let alive = true;

		const run = async () => {
			try {
				const json = await fetchJsonWithTimeout<HomeFaqApiResponse>("/api/public/faq?limit=3", {
					timeoutMs: 8000,
				});

				const items = Array.isArray(json?.items) ? json.items : [];
				if (!alive) return;

				setHomeFaq(items);
			} catch {
				if (!alive) return;
				setHomeFaq(null);
			}
		};

		run();

		return () => {
			alive = false;
		};
	}, []);

	const faqTop3 = useMemo(() => {
		const isRu = locale.startsWith("ru");

		if (!homeFaq || homeFaq.length === 0) return [];

		return homeFaq
			.slice(0, 3)
			.map((f) => {
				const question = (isRu ? f.question_ru : f.question_en).trim();
				const answer = (isRu ? f.answer_md_ru : f.answer_md_en).trim();

				return {
					key: f.id,
					question,
					answer,
				};
			})
			.filter((x) => x.question.length > 0 && x.answer.length > 0);
	}, [homeFaq, locale]);

useEffect(() => {
  const navEl =
    (document.querySelector("[data-site-nav]") as HTMLElement | null) ??
    (document.querySelector("header") as HTMLElement | null);

  if (!navEl) return;

  let raf = 0;
  const setVars = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const navH = Math.ceil(navEl.getBoundingClientRect().height);
      document.documentElement.style.setProperty("--nav-h", `${navH}px`);
    });
  };

  setVars();
  window.addEventListener("orientationchange", setVars);
  window.addEventListener("resize", setVars);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("orientationchange", setVars);
    window.removeEventListener("resize", setVars);
  };
}, []);


	useEffect(() => {
		const titleEl = titleRef.current;
		const l1 = titleLine1Ref.current;
		const l2 = titleLine2Ref.current;
		if (!titleEl || !l1 || !l2) return;
		
		let raf = 0;
		let lastW = 0;
		
		const update = () => {
			cancelAnimationFrame(raf);
			raf = requestAnimationFrame(() => {
			const w = Math.floor(titleEl.getBoundingClientRect().width);
			if (Math.abs(w - lastW) < 4) return; // ignore tiny changes
			lastW = w;
		
			const navHRaw = getComputedStyle(document.documentElement).getPropertyValue("--nav-h").trim();
			const navH = navHRaw.endsWith("px") ? parseFloat(navHRaw) : 0;
		
			const availH = Math.max(320, window.innerHeight - navH);
			const maxPx = Math.min(96, Math.floor(availH * 0.12));
		
			fitTwoLineTitle(titleEl, l1, l2, { minPx: 14, maxPx, precisionPx: 1 }); // coarser precision helps too
			});
		};
		
		update();
		window.addEventListener("orientationchange", update);
		window.addEventListener("resize", update);
		
		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener("orientationchange", update);
			window.removeEventListener("resize", update);
		};
	}, [t]);
	
	
	const [isMounted, setIsMounted] = useState(false);
	
	useEffect(() => {
		setIsMounted(true);
	}, []);

	return (
		<div className={styles.container}>
			{/* STICKY HERO SECTION */}
			<section ref={heroRef} className={styles.stickyHeroSection}>
				<div className={styles.stickyHeroImage} aria-hidden="true">
					<Image
						src="/home/home.png"
						alt={t("hero.imageAlt")}
						fill
						priority
						sizes="100vw"
						className={styles.heroImg}
					/>

					<div className={styles.heroOverlay} />
					<div className={styles.heroSpotlight} />
				</div>

				<motion.div className={styles.heroTextContent} style={{ opacity: textOpacity, y: textY }}>
					<div className={styles.heroTextInner}>
						<motion.div
							className={styles.heroLogoWrap}
							style={{ opacity: textOpacity }}
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.08, duration: 0.75, ease: EASE_OUT }}
						>
							<Image
								src="/pnglogo_white.png"
								alt="SA Immi Consult logo"
								width={220}
								height={210}
								priority
								className={styles.heroLogo}
							/>
						</motion.div>

						<motion.div
							className={styles.heroCopyWrap}
							style={{ filter: prefersReducedMotion ? "none" : (copyFilter as any) }}
							initial={{ opacity: 0, y: 22 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.9, ease: EASE_OUT }}
						>
							<motion.div
								className={styles.heroRule}
								initial={prefersReducedMotion ? false : { scaleX: 0 }}
								animate={prefersReducedMotion ? undefined : { scaleX: 1 }}
								transition={{
									delay: 0.15,
									duration: 0.9,
									ease: EASE_OUT,
								}}
							/>

							<h1 ref={titleRef} className={styles.heroMainTitle}>
								<span ref={titleLine1Ref} className="hero-title1">
									{t("hero.title.line1")}
								</span>
								<span ref={titleLine2Ref} className="hero-title2">
									{t("hero.title.line2")}
								</span>
							</h1>

							<motion.div
								className={styles.heroRule}
								initial={prefersReducedMotion ? false : { scaleX: 0 }}
								animate={prefersReducedMotion ? undefined : { scaleX: 1 }}
								transition={{
									delay: 0.35,
									duration: 0.9,
									ease: EASE_OUT,
								}}
							/>

							<p className={`${styles.heroSubtitleText} hero-desc`}>{t("hero.subtitle")}</p>
						</motion.div>

						<motion.div
							className={styles.heroCtaGroup}
							initial={{ opacity: 0, y: 18 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.15, duration: 0.8, ease: EASE_OUT }}
						>
							<Link href={siteConfig.contactHref} className="button button-primary">
								{t("hero.primaryCta")}
							</Link>
						</motion.div>
					</div>
				</motion.div>

				
				<motion.div
					className={styles.heroScrollIndicator}
					style={{ opacity: isMounted ? (textOpacity as any) : 1 }}
				>
					<motion.div
						className={styles.scrollUnderline}
						animate={{ y: [0, 8, 0] }}
						transition={{ duration: 1.5, repeat: Infinity, ease: EASE_IN_OUT }}
					/>
				</motion.div>
			</section>

			{/* ALL OTHER SECTIONS */}
			<NewsBannerSection tickerItems={tickerItems} />
			<ServicesOverviewSection />
			<WhySouthAfricaSection />
			<AboutBriefSection />
			<SocialProofSection faqTop3={faqTop3} />
			<FinalCtaSection />
		</div>
	);
}

/** 5) NEWS & COMMUNICATION - uses shared NewsTicker (Home + News) */

function NewsBannerSection(props: { tickerItems: { key: string; headline: string; href?: AppHref }[] }) {
	const t = useTranslations("News");

	return (
		<section className={styles.newsBannerSection}>
			<div className={styles.newsBannerSquare}>
				<motion.div
					className={styles.newsBannerLayout}
					variants={sectionRevealVariants}
					initial="hidden"
					whileInView="visible"
					viewport={{ once: true, amount: 0.4 }}
				>
					<div className={styles.newsBannerHeader}>
						<div className={styles.newsBannerText}>
							<div className={styles.newsBannerHeaderText}>
								<p className="hero-title">{t("title")}</p>
								<h2 className="hero-subtitle">{t("subtitle")}</h2>
							</div>
						</div>

						<HomeMagneticCta
							href={siteConfig.newsHref}
							label={t("cta")}
							className={styles.homeMagneticCtaGoldArrow}
						/>
					</div>

					{/* Shared ticker: ONLY render when we have DB items */}
					<div className={styles.newsTickerSlot}>
						{props.tickerItems.length > 0 ? (
							<NewsTicker eyebrow={t("eyebrow")} items={props.tickerItems} />
						) : (
							<div className={styles.newsTickerSkeleton} aria-hidden="true" />
						)}
					</div>

					<p className={styles.newsBannerSubtitle}>{t("description")}</p>
				</motion.div>
			</div>
		</section>
	);
}

// ──────────────────────────────────────────────────────
// 2) SERVICES OVERVIEW
// ──────────────────────────────────────────────────────
function ServicesOverviewSection() {
	const t = useTranslations("Home.services");
	const services = [
		{ key: "immigration", href: siteConfig.servicesImmigrationHref },
		{ key: "emigration", href: siteConfig.servicesEmigrationHref },
		{ key: "visaTypes", href: siteConfig.servicesVisaTypesHref },
		{ key: "additionalSupport", href: siteConfig.servicesAdditionalSupportHref },
	];

	const containerVariants: Variants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: { staggerChildren: 0.15, delayChildren: 0.2 },
		},
	};

	const cardVariants: Variants = {
		hidden: { opacity: 0, y: 30 },
		visible: {
			opacity: 1,
			y: 0,
			transition: { duration: 0.8, ease: EASE_OUT },
		},
	};

	return (
		<section className={styles.servicesFullScreenSection}>
			<motion.div
				className={styles.servicesContentSquare}
				initial="hidden"
				whileInView="visible"
				viewport={{ once: true, margin: "-100px" }}
				variants={containerVariants}
			>
				<header className={styles.servicesHeader}>
					<motion.div className={styles.servicesHeaderText} variants={cardVariants}>
						<p className="hero-title">{t("title")}</p>
						<h2 className="hero-subtitle">{t("subtitle")}</h2>
					</motion.div>

					<motion.div className={styles.servicesHeaderCta} variants={cardVariants}>
						<HomeMagneticCta
							href={siteConfig.servicesHref}
							label={t("viewAll")}
							className={styles.homeMagneticCtaGoldArrow}
						/>
					</motion.div>
				</header>

				<div className={styles.servicesBentoGrid}>
					{services.map((s) => (
						<motion.article
							key={s.key}
							className={`${styles.serviceCard} glass-vessel`}
							variants={cardVariants}
							whileHover={{ y: -10, transition: { duration: 0.3 } }}
						>
							{/* Full-card click overlay (keeps CTA “real”, avoids nested links) */}
							<Link
								href={s.href}
								className={styles.serviceCardOverlayLink}
								aria-label={`${t(`${s.key}.title`)} — ${t(`${s.key}.cta`)}`}
							/>

							<div className={styles.serviceCardContent}>
								<div className={styles.serviceIcon}>✦</div>
								<h3 className={styles.serviceCardTitle}>{t(`${s.key}.title`)}</h3>
								<p className={styles.serviceCardBody}>{t(`${s.key}.body`)}</p>
							</div>

							{/* CTA is now visual only (not a link) since the whole card is clickable */}
							<div className={styles.serviceCardCta} aria-hidden="true">
								{t(`${s.key}.cta`)}
								<span className={styles.ctaArrow}>→</span>
							</div>
						</motion.article>
					))}
				</div>
			</motion.div>
		</section>
	);
}

/** 3) WHY SOUTH AFRICA SECTION - Modern Infinite Marquee (Swipe + Inertia) */
function WhySouthAfricaSection() {
	const t = useTranslations("Home.whySa");
	const reasons = ["lifestyle", "education", "opportunity", "costOfLiving"];

	const images = [
		"/home/south-africa-slideshow/marq-slide-1.jpg",
		"/home/south-africa-slideshow/marq-slide-2.jpg",
		"/home/south-africa-slideshow/marq-slide-3.jpg",
		"/home/south-africa-slideshow/marq-slide-4.jpg",
		"/home/south-africa-slideshow/marq-slide-5.jpg",
		"/home/south-africa-slideshow/marq-slide-6.jpg",
		"/home/south-africa-slideshow/marq-slide-7.jpg",
		"/home/south-africa-slideshow/marq-slide-8.jpg",
		"/home/south-africa-slideshow/marq-slide-9.jpg",
		"/home/south-africa-slideshow/marq-slide-10.jpg",
	];

	const trackRef = useRef<HTMLDivElement | null>(null);
	const setARef = useRef<HTMLDivElement | null>(null);
	const marqueeWrapRef = useRef<HTMLDivElement | null>(null);

	// UI state only (cursor / affordance)
	const [isDragging, setIsDragging] = useState(false);

	useEffect(() => {
		const track = trackRef.current;
		const setA = setARef.current;
		const wrap = marqueeWrapRef.current;

		if (!track || !setA || !wrap) return;

		const prefersReduced =
			window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;

		// We drive transform ourselves (for swipe + inertia), so disable the CSS keyframes.
		track.style.animation = "none";

		// ---- Measurements (loop distance = one full set width) ----
		let distance = 0;

		const measure = () => {
			const d = Math.ceil(setA.scrollWidth);
			if (!d || !Number.isFinite(d)) return;

			distance = d;

			// Keep legacy vars up-to-date (useful for debugging + future styling)
			track.style.setProperty("--marquee-distance", `${distance}px`);
		};

		let rafMeasure = 0;
		const scheduleMeasure = () => {
			cancelAnimationFrame(rafMeasure);
			rafMeasure = requestAnimationFrame(measure);
		};

		scheduleMeasure();

		const ro = new ResizeObserver(scheduleMeasure);
		ro.observe(setA);

		// Also re-measure when images finish loading.
		requestAnimationFrame(() => {
			const imgs = Array.from(setA.querySelectorAll("img"));
			imgs.forEach((img) => {
				const el = img as HTMLImageElement;
				if (el.complete) scheduleMeasure();
				else el.addEventListener("load", scheduleMeasure, { once: true });
			});
		});

		// ---- Animation state ----
		// offset increases as content moves left (track translateX becomes more negative)
		let offsetPx = 0;

		// Extra velocity injected by swipe “fling” (px/sec); decays over time.
		let flingVel = 0;

		// Base auto-scroll speed (px/sec)
		const BASE_PX_PER_SEC = 45;

		// Active / in-view gate (saves battery; matches your existing IO behaviour)
		let isActive = false;

		let lastT = 0;
		let rafAnim = 0;

		const applyTransform = () => {
			if (!distance) return;

			// Keep offset bounded so it doesn't grow forever.
			const m = offsetPx % distance;
			const x = m < 0 ? m + distance : m;

			track.style.transform = `translate3d(${-x}px, 0, 0)`;
		};

		const step = (now: number) => {
			if (!isActive) {
				rafAnim = requestAnimationFrame(step);
				lastT = now;
				return;
			}

			const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000)); // clamp dt
			lastT = now;

			// Reduced motion: freeze (but still keep transform stable).
			if (prefersReduced) {
				applyTransform();
				rafAnim = requestAnimationFrame(step);
				return;
			}

			// During drag, offset is driven by pointermove (no auto step).
			if (!drag.isDragging) {
				// Apply base speed + fling, then decay fling.
				offsetPx += (BASE_PX_PER_SEC + flingVel) * dt;

				// Exponential decay (tuned to feel “weighty” but quick to settle)
				const decay = Math.exp(-6 * dt);
				flingVel *= decay;

				// Small dead-zone to fully settle
				if (Math.abs(flingVel) < 2) flingVel = 0;

				applyTransform();
			}

			rafAnim = requestAnimationFrame(step);
		};

		// ---- Pointer swipe handling ----
		const drag = {
			isDragging: false,
			pointerId: -1,
			startX: 0,
			startOffset: 0,
			lastX: 0,
			lastTime: 0,
			velX: 0, // px/sec (pointer space)
		};

		const onPointerDown = (e: PointerEvent) => {
			// Only primary button for mouse; always allow touch/pen.
			if (e.pointerType === "mouse" && e.button !== 0) return;

			// If distance isn't ready yet, don't start drag.
			if (!distance) return;

			drag.isDragging = true;
			drag.pointerId = e.pointerId;
			drag.startX = e.clientX;
			drag.startOffset = offsetPx;
			drag.lastX = e.clientX;
			drag.lastTime = performance.now();
			drag.velX = 0;

			// Kill any running fling so the swipe feels 1:1.
			flingVel = 0;

			try {
				wrap.setPointerCapture(e.pointerId);
			} catch {
				// no-op
			}

			setIsDragging(true);
		};

		const onPointerMove = (e: PointerEvent) => {
			if (!drag.isDragging) return;
			if (e.pointerId !== drag.pointerId) return;

			const x = e.clientX;
			const dx = x - drag.startX;

			// Dragging right should move content right (offset decreases),
			// dragging left should move content left (offset increases).
			offsetPx = drag.startOffset - dx;

			// Velocity estimation
			const now = performance.now();
			const dtMs = Math.max(8, now - drag.lastTime);
			drag.velX = ((x - drag.lastX) / dtMs) * 1000;

			drag.lastX = x;
			drag.lastTime = now;

			applyTransform();
		};

		const endDrag = (e: PointerEvent) => {
			if (!drag.isDragging) return;
			if (e.pointerId !== drag.pointerId) return;

			drag.isDragging = false;

			try {
				wrap.releasePointerCapture(e.pointerId);
			} catch {
				// no-op
			}

			setIsDragging(false);

			// Convert pointer velocity (right positive) to offset velocity.
			// offset is opposite of pointer dx, so flingVel should be -velX.
			const raw = -drag.velX;

			// Clamp fling to avoid “teleport” on fast swipes.
			const CLAMP = 1400;
			flingVel = Math.max(-CLAMP, Math.min(CLAMP, raw));
		};

		const onPointerUp = (e: PointerEvent) => endDrag(e);
		const onPointerCancel = (e: PointerEvent) => endDrag(e);

		// ---- In-view activation ----
		let io: IntersectionObserver | null = null;

		io = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				if (!entry) return;
				isActive = entry.isIntersecting;
			},
			{ root: null, rootMargin: "200px 0px 200px 0px", threshold: 0.01 },
		);

		io.observe(wrap);

		// Bind pointer handlers on the wrapper so the whole marquee area is swipeable.
		wrap.addEventListener("pointerdown", onPointerDown, { passive: true });
		wrap.addEventListener("pointermove", onPointerMove, { passive: true });
		wrap.addEventListener("pointerup", onPointerUp, { passive: true });
		wrap.addEventListener("pointercancel", onPointerCancel, { passive: true });

		// Start RAF loop
		lastT = performance.now();
		rafAnim = requestAnimationFrame(step);

		return () => {
			cancelAnimationFrame(rafMeasure);
			cancelAnimationFrame(rafAnim);

			wrap.removeEventListener("pointerdown", onPointerDown);
			wrap.removeEventListener("pointermove", onPointerMove);
			wrap.removeEventListener("pointerup", onPointerUp);
			wrap.removeEventListener("pointercancel", onPointerCancel);

			if (io) io.disconnect();
			ro.disconnect();
		};
	}, []);

	return (
		<section className={styles.whyModernSection}>
			<div className={styles.whyModernSquare}>
				<div className={styles.whyModernHeader}>
					<div className={styles.whyModernHeaderText}>
						<p className="hero-title">{t("title")}</p>
						<h2 className="hero-subtitle">{t("subtitle")}</h2>
					</div>
					<p className={styles.whyModernSubtitle}>{t("description")}</p>
				</div>

				<div
					ref={marqueeWrapRef}
					className={`${styles.marqueeWrapper}${
						isDragging ? ` ${styles.marqueeWrapperDragging}` : ""
					}`}
				>
					<div ref={trackRef} className={styles.marqueeTrack}>
						<div ref={setARef} className={styles.marqueeSet}>
							{images.map((src, idx) => (
								<div key={`a-${idx}`} className={styles.marqueeItem}>
									<Image
										src={src}
										alt="South Africa Lifestyle"
										fill
										sizes="(max-width: 768px) 85vw, (max-width: 1200px) 45vw, 30vw"
										className={styles.marqueeImg}
									/>
								</div>
							))}
						</div>

						<div className={styles.marqueeSet} aria-hidden="true">
							{images.map((src, idx) => (
								<div key={`b-${idx}`} className={styles.marqueeItem}>
									<Image
										src={src}
										alt="South Africa Lifestyle"
										fill
										sizes="(max-width: 768px) 85vw, (max-width: 1200px) 45vw, 30vw"
										className={styles.marqueeImg}
									/>
								</div>
							))}
						</div>
					</div>
				</div>

				<div className={styles.whyReasonsGrid}>
					{reasons.map((key, index) => (
						<div key={key} className={styles.modernReasonCard}>
							<span className={styles.reasonNumber}>0{index + 1}</span>
							<h3 className={styles.reasonTitle}>{t(`reasons.${key}.title`)}</h3>
							<p className={styles.reasonText}>{t(`reasons.${key}.body`)}</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

/** 4) ABOUT BRIEF SECTION - The "Story Layer" Refactor */
function AboutBriefSection() {
	const t = useTranslations("Home.aboutBrief");
	const tHeroKpi = useTranslations("Home.hero.kpi");

	return (
		<section className={styles.aboutStorySection}>
			<div className={styles.aboutStorySquare}>
				<div className={styles.aboutStoryContainer}>
					<div className={styles.aboutStoryText}>
						<motion.div
							initial={{ opacity: 0, x: -50 }}
							whileInView={{ opacity: 1, x: 0 }}
							transition={{ duration: 0.8 }}
							viewport={{ once: true }}
						>
							<div className={styles.aboutStoryHeaderText}>
								<p className="hero-title">{t("title")}</p>
								<h2 className="hero-subtitle">{t("subtitle")}</h2>
							</div>
						</motion.div>

						<div className={styles.storyBodyCanvas}>
							<p className={styles.storyLead}>{t("subtitle")}</p>
							<p className={styles.storyDetail}>{t("body")}</p>
						</div>

						<div className={styles.storyHighlightStrip}>
							{[0, 1, 2].map((i) => (
								<motion.div
									key={i}
									className={styles.storyGlassPill}
									initial={{ opacity: 0, y: 20 }}
									whileInView={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.2 + i * 0.1 }}
									viewport={{ once: true }}
								>
									{t(`highlights.${i}`)}
								</motion.div>
							))}
						</div>

						<div className={styles.aboutCtaRow}>
							<HomeMagneticCta
								href={siteConfig.aboutHref}
								label={t("cta")}
								className={styles.homeMagneticCtaGoldArrow}
							/>
						</div>
					</div>

					<div className={styles.aboutStoryVisual}>
						<motion.div
							className={styles.visualParallaxFrame}
							initial={{ clipPath: "inset(100% 0% 0% 0%)" }}
							whileInView={{ clipPath: "inset(0% 0% 0% 0%)" }}
							transition={{ duration: 1.2, ease: EASE_OUT }}
							viewport={{ once: true }}
						>
							<Image
								src="/home/about-texture.jpg"
								alt="South Africa Heritage"
								fill
								sizes="(max-width: 768px) 92vw, (max-width: 1200px) 48vw, 36vw"
								className={styles.visualParallaxImg}
							/>

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
						</motion.div>
					</div>
				</div>
			</div>
		</section>
	);
}

/** 6 & 7) SOCIAL PROOF (FAQ & TESTIMONIALS) - One Truth */
function SocialProofSection(props: { faqTop3: { key: string; question: string; answer: string }[] }) {
	const tFaq = useTranslations("Home.faq");
	const tTest = useTranslations("Home.testimonials");

	const [activeFaq, setActiveFaq] = useState<number | null>(0);

	const hasFaq = props.faqTop3.length > 0;

	return (
		<section className={styles.socialProofSection}>
			<div className={styles.socialProofSquare}>
				<div className={`${styles.socialProofGrid} ${!hasFaq ? styles.socialProofGridSingle : ""}`}>
					{/* Left: FAQ Ledger (ONLY if we have items; no fallback translations) */}
					{hasFaq ? (
						<div className={styles.faqLedger}>
							<div className={styles.socialProofHeaderText}>
								<p className="hero-title">{tFaq("title")}</p>
								<h2 className="hero-subtitle">{tFaq("subtitle")}</h2>
							</div>

							<div className={styles.ledgerList}>
								{props.faqTop3.map((item, i) => (
									<div
										key={item.key}
										className={`${styles.ledgerFaqItem} ${activeFaq === i ? styles.active : ""}`}
										onClick={() => setActiveFaq(activeFaq === i ? null : i)}
									>
										<div className={styles.ledgerFaqHeader}>
											<span className={styles.ledgerIndex}>0{i + 1}</span>
											<h3 className={styles.ledgerQuestion}>{item.question}</h3>
											<motion.span className={styles.ledgerPlus} animate={{ rotate: activeFaq === i ? 45 : 0 }}>
												+
											</motion.span>
										</div>

										<AnimatePresence>
											{activeFaq === i && (
												<motion.div
													className={styles.ledgerAnswerWrapper}
													initial={{ height: 0, opacity: 0 }}
													animate={{ height: "auto", opacity: 1 }}
													exit={{ height: 0, opacity: 0 }}
												>
													<p className={styles.ledgerAnswer}>{item.answer}</p>
												</motion.div>
											)}
										</AnimatePresence>
									</div>
								))}
							</div>

							<HomeMagneticCta
								href={siteConfig.faqHref}
								label={tFaq("cta")}
								className={`${styles.homeMagneticCtaSm} ${styles.homeMagneticCtaGoldArrow}`}
							/>
						</div>
					) : null}

					{/* Right: Testimonials */}
					<div className={styles.testimonialShowcase}>
						<div className={styles.socialProofHeaderText}>
							<p className="hero-title">{tTest("title")}</p>
							<h2 className="hero-subtitle">{tTest("subtitle")}</h2>
						</div>

						<div className={styles.testimonialStack}>
							{[0, 1].map((i) => (
								<motion.figure
									key={i}
									className={styles.editorialQuote}
									initial={{ opacity: 0, x: 20 }}
									whileInView={{ opacity: 1, x: 0 }}
									viewport={{ once: true }}
									transition={{ delay: i * 0.2 }}
								>
									<div className={styles.quoteMark}>“</div>
									<blockquote className={styles.quoteText}>{tTest(`items.${i}.quote`)}</blockquote>
									<figcaption className={styles.quoteAuthor}>
										<div className={styles.authorLine} />
										<div className={styles.authorInfo}>
											<span className={styles.authorName}>{tTest(`items.${i}.name`)}</span>
											<span className={styles.authorCountry}>{tTest(`items.${i}.country`)}</span>
										</div>
									</figcaption>
								</motion.figure>
							))}
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

/** 8) FINAL CTA SECTION - One Truth (scales via container queries) */
function FinalCtaSection() {
	const t = useTranslations("Home.finalCta");

	return (
		<section className={styles.finaleSection}>
			<div className={styles.finaleBgWrapper} aria-hidden="true">
				<Image
					src="/home/cta-landscape.jpg"
					alt="South Africa Golden Hour"
					fill
					priority
					className={styles.finaleImg}
					sizes="100svw"
				/>
				<div className={styles.finaleOverlay} />
			</div>

			<div className={styles.finaleWatermark} aria-hidden="true">
				{t("watermark")}
			</div>

			<div className={styles.finaleContentSquare}>
				<motion.div
					className={`${styles.finalePortal} glass-vessel`}
					initial={{ opacity: 0, y: 18 }}
					whileInView={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
					viewport={{ once: true, amount: 0.35 }}
				>
					<div className={styles.finaleHeaderText}>
						<p className="hero-title">{t("title")}</p>
						<h2 className="hero-subtitle">{t("subtitle")}</h2>
					</div>

					<div className={styles.finaleGrid}>
						<div className={styles.finaleInfoSide}>
							<p className={styles.finaleLead}>{t("body")}</p>
						</div>

						<div className={styles.finaleActionSide}>
							<HomeMagneticCta
								href={siteConfig.contactHref}
								label={t("primaryCta")}
								className={styles.homeMagneticCtaGoldArrow}
							/>
						</div>
					</div>
				</motion.div>
			</div>
		</section>
	);
}
