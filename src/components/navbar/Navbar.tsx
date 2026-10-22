// src/components/Navbar.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { siteConfig } from "@/config/siteConfig";
import styles from "./Navbar.module.css";

import LocaleSwitcher from "../LocaleSwitcher";
import LogoutButton from "../LogoutButton";

type NavItemKey = "home" | "about" | "services" | "news" | "faq" | "contact";

const PUBLIC_NAV_KEYS: readonly NavItemKey[] = [
	"home",
	"about",
	"services",
	"news",
	"faq",
	"contact",
] as const;

type ServicesSubKey = "immigration" | "emigration" | "visaTypes" | "additionalSupport";

const SERVICES_SUB_KEYS: readonly ServicesSubKey[] = [
	"immigration",
	"emigration",
	"visaTypes",
	"additionalSupport",
] as const;

type LinkHref = React.ComponentProps<typeof Link>["href"];

interface NavbarProps {
	user?: any;
	profileHref?: LinkHref;
}

type NavbarHrefs = {
	public?: Partial<Record<NavItemKey, string>>;
	servicesMenu?: Partial<Record<ServicesSubKey, string>>;
	profile?: {
		admin?: {
			dashboard?: string;
			applications?: string;
			documents?: string;
			clientProfiles?: string;
		};
		client?: {
			dashboard?: string;
			profile?: string;
			applications?: string;
		};
	};
};

function safeRaw<T>(t: ReturnType<typeof useTranslations>, key: string, fallback: T): T {
	try {
		return t.raw(key) as T;
	} catch {
		return fallback;
	}
}

function useMediaQuery(query: string): boolean | null {
	const [matches, setMatches] = useState<boolean | null>(null);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const mql: MediaQueryList = window.matchMedia(query);
		const onChange = () => setMatches(mql.matches);

		// Set immediately on mount (before paint where possible)
		onChange();

		const hasModern = typeof (mql as any).addEventListener === "function";
		if (hasModern) {
			(mql as any).addEventListener("change", onChange);
			return () => (mql as any).removeEventListener("change", onChange);
		}

		if (typeof (mql as any).addListener === "function") {
			(mql as any).addListener(onChange);
			return () => (mql as any).removeListener(onChange);
		}

		return;
	}, [query]);

	return matches;
}

function getFocusable(container: HTMLElement): HTMLElement[] {
	const selectors = [
		'a[href]:not([tabindex="-1"])',
		'button:not([disabled]):not([tabindex="-1"])',
		'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
		'select:not([disabled]):not([tabindex="-1"])',
		'textarea:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
		'[tabindex]:not([tabindex="-1"])',
	].join(",");

	return Array.from(container.querySelectorAll<HTMLElement>(selectors)).filter((el) => {
		const style = window.getComputedStyle(el);
		return style.visibility !== "hidden" && style.display !== "none";
	});
}

type MobileView = "main" | "services";

function normalizePathForActiveCheck(input: string): string {
	const stripQueryHash = (p: string) => p.split("?")[0].split("#")[0];
	const stripTrailingSlash = (p: string) => (p === "/" ? "/" : p.replace(/\/+$/, ""));

	// Minimal locale strip: only EN/RU (matches your current supported set).
	// This avoids brittle regex logic and keeps behavior predictable.
	const stripLocalePrefix = (p: string) => {
		const path = stripTrailingSlash(stripQueryHash(p));
		const m = path.match(/^\/(en|ru)(\/|$)/);
		if (!m) return path;

		const rest = path.slice(m[0].length - (m[2] === "/" ? 1 : 0));
		return rest === "" ? "/" : rest;
	};

	return stripLocalePrefix(input);
}

function hrefToPathname(href: LinkHref): string {
	if (typeof href === "string") return href;

	// next-intl typed href object: { pathname, params, query? }
	// We only need pathname for active checks.
	const pathname = (href as any)?.pathname;
	return typeof pathname === "string" ? pathname : "/";
}

function pathnameToHref(pathname: string): LinkHref {
	// Link's href type is a union (string | object). In this project, the object form is
	// only safe when its pathname is from the typed union. Translation overrides are plain strings.
	return pathname as unknown as LinkHref;
}

export default function Navbar({
	user = null,
	profileHref = siteConfig.clientAccountHref,
}: NavbarProps) {
	const pathname = usePathname();
	const t = useTranslations("Navbar");

	const hrefs = safeRaw<NavbarHrefs>(t, "hrefs", {});
	const navRef = useRef<HTMLElement | null>(null);

	// Desktop services hover dropdown (LOCKED behavior)
	const [servicesOpen, setServicesOpen] = useState(false);
	const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Mobile drawer state
	const [menuOpen, setMenuOpen] = useState(false);
	const [mobileView, setMobileView] = useState<MobileView>("main");

	const isMobile = useMediaQuery("(max-width: 970px)");
	const isResponsiveReady = isMobile !== null;
	
	useEffect(() => {
		if (!isResponsiveReady) return;
		// When we finally know desktop vs mobile, ensure nav is visible.
		setIsVisible(true);
		lastScrollY.current = window.scrollY;
	}, [isResponsiveReady]);

	// unique IDs (desktop vs mobile)
	const drawerDesktopId = "nav-drawer-desktop";
	const drawerMobileId = "nav-drawer-mobile";
	const drawerTitleId = "nav-drawer-title";

	// Refs for a11y focus management
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const mobileDrawerRef = useRef<HTMLDivElement | null>(null);
	const lastFocusedRef = useRef<HTMLElement | null>(null);

	const openServicesDesktop = () => {
		if (closeTimeout.current) clearTimeout(closeTimeout.current);
		setServicesOpen(true);
	};

	const closeServicesDesktop = () => {
		closeTimeout.current = setTimeout(() => {
			setServicesOpen(false);
		}, 150);
	};

	const [isVisible, setIsVisible] = useState(true);
	const lastScrollY = useRef(0);
	const scrollTicking = useRef(false);

	useEffect(() => {
		const el = navRef.current;
		if (!el) return;

		const setVar = () => {
			const h = el.getBoundingClientRect().height;
			document.documentElement.style.setProperty("--nav-height", `${Math.ceil(h)}px`);
		};

		setVar();

		const ro = new ResizeObserver(() => setVar());
		ro.observe(el);

		window.addEventListener("resize", setVar);

		return () => {
			ro.disconnect();
			window.removeEventListener("resize", setVar);
		};
	}, []);

	useEffect(() => {
		const onScroll = () => {
			if (scrollTicking.current) return;
			scrollTicking.current = true;
	
			window.requestAnimationFrame(() => {
				scrollTicking.current = false;
	
				const currentScrollY = window.scrollY;
	
				// Never auto-hide while the mobile drawer is open
				if (menuOpen) {
					lastScrollY.current = currentScrollY;
					return;
				}
	
				// Always show when near the top
				if (currentScrollY <= 10) {
					setIsVisible(true);
					lastScrollY.current = currentScrollY;
					return;
				}
	
				// Same thresholds as desktop behavior
				if (currentScrollY > lastScrollY.current && currentScrollY > 70) {
					setIsVisible(false);
				} else if (currentScrollY < lastScrollY.current) {
					setIsVisible(true);
				}
	
				lastScrollY.current = currentScrollY;
			});
		};
	
		// Initialize baseline on mount
		lastScrollY.current = window.scrollY;
	
		window.addEventListener("scroll", onScroll, { passive: true });
	
		return () => {
			window.removeEventListener("scroll", onScroll);
			if (closeTimeout.current) clearTimeout(closeTimeout.current);
		};
	}, [menuOpen]);
	

	useEffect(() => {
		const root = document.documentElement;

		if (menuOpen) {
			document.body.classList.add("no-scroll");
			root.classList.add("no-scroll");
		} else {
			document.body.classList.remove("no-scroll");
			root.classList.remove("no-scroll");
		}

		return () => {
			document.body.classList.remove("no-scroll");
			root.classList.remove("no-scroll");
		};
	}, [menuOpen]);

	// Close drawer on route change
	useEffect(() => {
		setMenuOpen(false);
		setMobileView("main");
	}, [pathname]);

	// If opening while already inside /services, jump to services view (mobile only)
	useEffect(() => {
		if (!menuOpen) return;
		if (isMobile !== true) return;
	
		if (pathname && pathname.startsWith(siteConfig.servicesPath)) {
			setMobileView("services");
		}
	}, [menuOpen, isMobile, pathname]);

	const isActive = useCallback(
		(href: LinkHref) => {
			if (!pathname) return false;

			const current = normalizePathForActiveCheck(pathname);
			const target = normalizePathForActiveCheck(hrefToPathname(href));

			if (current === target) return true;
			if (target !== "/" && current.startsWith(`${target}/`)) return true;

			return false;
		},
		[pathname]
	);

	const isAdminUser = useMemo(() => {
		if (!user) return false;
		const role = String(user?.app_metadata?.role || "");
		return role === "admin" || role === "super_admin";
	}, [user]);

	const getPublicHref = (key: NavItemKey): LinkHref => {
		// Never allow translations to override "home"
		if (key === "home") return siteConfig.homeHref;

		const fromDict = hrefs.public?.[key];
		if (fromDict) return pathnameToHref(fromDict);

		if (key === "about") return siteConfig.aboutHref;
		if (key === "services") return siteConfig.servicesHref;
		if (key === "news") return siteConfig.newsHref;
		if (key === "faq") return siteConfig.faqHref;
		return siteConfig.contactHref;
	};

	const getServiceHref = (key: ServicesSubKey): LinkHref => {
		const fromDict = hrefs.servicesMenu?.[key];
		if (fromDict) return pathnameToHref(fromDict);

		if (key === "immigration") return siteConfig.servicesImmigrationHref;
		if (key === "emigration") return siteConfig.servicesEmigrationHref;
		if (key === "visaTypes") return siteConfig.servicesVisaTypesHref;
		return siteConfig.servicesAdditionalSupportHref;
	};

	const adminProfileLinks = useMemo(
		() => [
			{ href: siteConfig.adminAccountHref, label: t("profile.admin.account") },
			{ href: siteConfig.adminDashboardHref, label: t("profile.admin.dashboard") },
			{ href: siteConfig.adminCasesHref, label: t("profile.admin.cases") },
			{ href: siteConfig.adminApplicationsHref, label: t("profile.admin.applications") },
			{ href: siteConfig.adminClientProfilesHref, label: t("profile.admin.clients") },
			{ href: siteConfig.adminContentHref, label: t("profile.admin.content") },
		],
		[t]
	);

	const clientProfileLinks = useMemo(
		() => [
			{ href: siteConfig.clientDashboardHref, label: t("profile.client.dashboard") },
			{ href: siteConfig.clientAccountHref, label: t("profile.client.myAccount") },
			{ href: siteConfig.clientCasesHref, label: t("profile.client.myCases") },
			{ href: siteConfig.clientApplicationsHref, label: t("profile.client.myApplications") },
		],
		[t]
	);

	const profileLabel = user ? String(user.email || "").split("@")[0] : "";

	// Mobile drawer: focus trap + Escape + focus return
	useEffect(() => {
		if (isMobile !== true) return;
		if (!menuOpen) return;

		lastFocusedRef.current = document.activeElement as HTMLElement | null;

		const drawerEl = mobileDrawerRef.current;
		if (drawerEl) {
			window.requestAnimationFrame(() => {
				const focusables = getFocusable(drawerEl);
				if (focusables.length > 0) {
					focusables[0].focus();
				} else {
					drawerEl.focus();
				}
			});
		}

		const onKeyDown = (e: KeyboardEvent) => {
			if (!menuOpen) return;

			if (e.key === "Escape") {
				e.preventDefault();
				setMenuOpen(false);
				return;
			}

			if (e.key !== "Tab") return;

			const root = mobileDrawerRef.current;
			if (!root) return;

			const focusables = getFocusable(root);
			if (focusables.length === 0) {
				e.preventDefault();
				return;
			}

			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			const active = document.activeElement as HTMLElement | null;

			if (!e.shiftKey && active === last) {
				e.preventDefault();
				first.focus();
			} else if (e.shiftKey && active === first) {
				e.preventDefault();
				last.focus();
			}
		};

		document.addEventListener("keydown", onKeyDown);

		return () => {
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [menuOpen, isMobile]);

	useEffect(() => {
		if (isMobile !== true) return;
	
		if (!menuOpen) {
			const last = lastFocusedRef.current;
			if (last && typeof last.focus === "function") {
				window.requestAnimationFrame(() => last.focus());
			} else if (triggerRef.current) {
				window.requestAnimationFrame(() => triggerRef.current?.focus());
			}
			setMobileView("main");
		}
	}, [menuOpen, isMobile]);

	const closeMobileDrawer = () => setMenuOpen(false);
	const openServicesMobile = () => setMobileView("services");
	const backToMainMobile = () => setMobileView("main");

	return (
		<>
			<div
				className={`${styles.scrim} ${menuOpen && isMobile === true ? styles.scrimVisible : ""}`}
				onClick={() => closeMobileDrawer()}
				aria-hidden="true"
			/>

			<nav
				ref={navRef}
				className={`${styles.navbar} nav-surface ${!isVisible ? styles.navbarHidden : ""} ${
					isResponsiveReady ? styles.responsiveReady : styles.responsivePending
				}`}
			>
				<div className={styles.navContainer}>
					<Link
						href={siteConfig.homeHref}
						className={styles.brandLink}
						aria-label={t("aria.brand")}
					>
						<Image
							src="/pnglogo_black.png"
							alt={t("aria.brand")}
							width={260}
							height={84}
							className={styles.brandLogo}
							priority
							sizes="(max-width: 970px) 170px, 240px"
						/>
					</Link>

					{isResponsiveReady && isMobile === true && (
						<div className={styles.mobileTopRight}>
							<button
								ref={triggerRef}
								className={styles.mobileToggle}
								onClick={() => setMenuOpen((v) => !v)}
								aria-label={t("aria.toggleMenu")}
								aria-expanded={menuOpen}
								aria-controls={drawerMobileId}
								type="button"
							>
								<div className={`${styles.hamburger} ${menuOpen ? styles.hamburgerActive : ""}`}>
									<span aria-hidden="true"></span>
									<span aria-hidden="true"></span>
									<span aria-hidden="true"></span>
								</div>
							</button>
						</div>
					)}

					{isResponsiveReady && isMobile === false && (
						<ul id={drawerDesktopId} className={styles.navLinks}>
							{PUBLIC_NAV_KEYS.map((key) => {
								const href = getPublicHref(key);
								const active = isActive(href);

								if (key === "services") {
									return (
										<li
											key={key}
											className={styles.navItem}
											onMouseEnter={openServicesDesktop}
											onMouseLeave={closeServicesDesktop}
										>
											<div className={styles.servicesRow}>
												<Link
													href={href}
													data-text={t(key)}
													className={`nav-pill ${styles.link} ${
														active ? `nav-pillActive ${styles.linkActive}` : ""
													}`}
													aria-current={active ? "page" : undefined}
												>
													{t(key)}
												</Link>
											</div>

											<div
												id="nav-services"
												className={`${styles.servicesDropdown} ${
													servicesOpen ? styles.servicesDropdownOpen : ""
												}`}
											>
												<div className={`${styles.servicesDropdownInner} nav-panel`}>
													<div className={styles.servicesGrid}>
														{SERVICES_SUB_KEYS.map((subKey) => {
															const subHref = getServiceHref(subKey);
															const subActive = isActive(subHref);

															return (
																<Link
																	key={subKey}
																	href={subHref}
																	className={`nav-dropdownLink ${
																		subActive ? "nav-dropdownLink-active" : ""
																	}`}
																	aria-current={subActive ? "page" : undefined}
																	onClick={() => setServicesOpen(false)}
																>
																	<span className="nav-dropdownTitle">
																		{t(`servicesMenu.${subKey}`)}
																	</span>
																	<span className="nav-dropdownDesc">
																		{t(`servicesMenu.${subKey}Desc`)}
																	</span>
																</Link>
															);
														})}
													</div>
												</div>
											</div>
										</li>
									);
								}

								return (
									<li key={key} className={styles.navItem}>
										<Link
											href={href}
											data-text={t(key)}
											className={`nav-pill ${styles.link} ${
												active ? `nav-pillActive ${styles.linkActive}` : ""
											}`}
											aria-current={active ? "page" : undefined}
										>
											{t(key)}
										</Link>
									</li>
								);
							})}
						</ul>
					)}

				{isResponsiveReady && isMobile === false && (
					<div className={styles.rightControlsDesktop}>
						<LocaleSwitcher variant="header" />
						{user ? (
							<div className={styles.desktopProfileWrap}>
								<button type="button" className="button button-primary" aria-label={t("aria.profileMenu")}>
									{profileLabel}
									<span aria-hidden="true">▼</span>
								</button>

								<div className={styles.desktopProfileDropdown}>
									<div className={`nav-panel ${styles.desktopProfileDropdownInner}`}>
										<div className={styles.desktopProfileList}>
											{(isAdminUser ? adminProfileLinks : clientProfileLinks).map((item) => {
												const active = isActive(item.href);

												return (
													<Link
														key={hrefToPathname(item.href)}
														href={item.href}
														className={`nav-pill ${styles.desktopProfileLink} ${
															active ? `nav-pillActive ${styles.linkActive}` : ""
														}`}
														aria-current={active ? "page" : undefined}
													>
														{item.label}
													</Link>
												);
											})}
										</div>

										<div className={styles.desktopLogout}>
											<LogoutButton />
										</div>
									</div>
								</div>
							</div>
						) : (
							<Link href={siteConfig.loginHref} className="button button-primary">
								{t("login")}
							</Link>
						)}
					</div>
				)}
				</div>

				{isResponsiveReady && isMobile === true && (
					<div
						id={drawerMobileId}
						ref={mobileDrawerRef}
						className={`${styles.mobilePanel} ${menuOpen ? styles.mobilePanelOpen : ""} nav-sheet`}
						role="dialog"
						aria-modal="true"
						aria-labelledby={drawerTitleId}
						tabIndex={-1}
					>
						<h2 id={drawerTitleId} className={styles.srOnly}>
							{t("aria.mobileMenuTitle")}
						</h2>

						<div className={styles.mobilePanelBody}>
							<div className={styles.mobileScroller}>
								<div className={styles.mobileViewport} data-view={mobileView}>
									<section className={styles.mobileView} aria-label={t("sections.publicSite")}>
										<div className={styles.mobileLocaleSpacer}>
											<LocaleSwitcher variant="drawer" />
										</div>

										<div className={styles.mobileSectionTitle}>
											<span className={styles.drawerSectionLabel}>{t("sections.publicSite")}</span>
										</div>

										<ul className={styles.mobileList}>
											{PUBLIC_NAV_KEYS.map((key) => {
												const href = getPublicHref(key);
												const active = isActive(href);

												if (key === "services") {
													return (
														<li key={key} className={styles.mobileListItem}>
															<button
																type="button"
																className={`${styles.mobileRowButton} nav-pill ${styles.link} ${
																	active ? `nav-pillActive ${styles.linkActive}` : ""
																}`}
																onClick={openServicesMobile}
																aria-expanded={mobileView === "services"}
																aria-controls="mobile-services-view"
															>
																<span className={styles.mobileRowLabel}>{t(key)}</span>
																<span className={styles.mobileRowChevron} aria-hidden="true">
																	›
																</span>
															</button>
														</li>
													);
												}

												return (
													<li key={key} className={styles.mobileListItem}>
														<Link
															href={href}
															className={`nav-pill ${styles.link} ${
																active ? `nav-pillActive ${styles.linkActive}` : ""
															}`}
															aria-current={active ? "page" : undefined}
															onClick={closeMobileDrawer}
														>
															{t(key)}
														</Link>
													</li>
												);
											})}
										</ul>

										{user && (
											<>
												<div className={styles.mobileSectionTitle}>
													<span className={styles.drawerSectionLabel}>{t("sections.profile")}</span>
												</div>

												<div className={`nav-panel ${styles.mobilePanelCard}`}>
													<div className={styles.mobilePanelInner}>
														{(isAdminUser ? adminProfileLinks : clientProfileLinks).map((item) => {
															const active = isActive(item.href);

															return (
																<Link
																	key={hrefToPathname(item.href)}
																	href={item.href}
																	className={`nav-pill ${styles.link} ${
																		active ? `nav-pillActive ${styles.linkActive}` : ""
																	}`}
																	aria-current={active ? "page" : undefined}
																	onClick={closeMobileDrawer}
																>
																	{item.label}
																</Link>
															);
														})}

														<div className="nav-divider" />

														<div className={styles.logoutWrapper}>
															<LogoutButton />
														</div>
													</div>
												</div>
											</>
										)}

										<div className={styles.mobileFooter}>
											<div className="nav-divider" />

											{!user && (
												<div className={styles.authSection}>
													<Link
														href={siteConfig.loginHref}
														className="button button-primary"
														onClick={closeMobileDrawer}
													>
														{t("login")}
													</Link>
												</div>
											)}
										</div>
									</section>

									<section
										id="mobile-services-view"
										className={styles.mobileView}
										aria-label={t("services")}
									>
										<div className={styles.mobileSectionTitle}>
											<div className={styles.mobileServicesHeaderRow}>
												<button
													type="button"
													className={styles.mobileBackPill}
													onClick={backToMainMobile}
													aria-label={t("aria.backToMenu")}
												>
													<span aria-hidden="true">‹</span>
													<span>{t("aria.back")}</span>
												</button>

												<span className={styles.drawerSectionLabel}>{t("services")}</span>
											</div>
										</div>

										<ul className={styles.mobileList}>
											<li className={styles.mobileListItem}>
												<Link
													href={siteConfig.servicesHref}
													className={`nav-pill ${styles.link} ${
														isActive(siteConfig.servicesHref)
															? `nav-pillActive ${styles.linkActive}`
															: ""
													}`}
													onClick={closeMobileDrawer}
												>
													{t("services")}
												</Link>
											</li>

											{SERVICES_SUB_KEYS.map((subKey) => {
												const subHref = getServiceHref(subKey);
												const subActive = isActive(subHref);

												return (
													<li key={subKey} className={styles.mobileListItem}>
														<Link
															href={subHref}
															className={`nav-pill ${styles.link} ${styles.servicesSubPill} ${
																subActive ? `nav-pillActive ${styles.linkActive}` : ""
															}`}
															aria-current={subActive ? "page" : undefined}
															onClick={closeMobileDrawer}
														>
															<span className={styles.servicesSubTitle}>
																{t(`servicesMenu.${subKey}`)}
															</span>
															<span className={styles.servicesSubDesc}>
																{t(`servicesMenu.${subKey}Desc`)}
															</span>
														</Link>
													</li>
												);
											})}
										</ul>

										<div className={styles.mobileFooter}>
											<div className="nav-divider" />
										</div>
									</section>
								</div>
							</div>
						</div>
					</div>
				)}
			</nav>
		</>
	);
}
