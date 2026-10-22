/*
DOC NAME: PortalSubNav.tsx
LOCATION: /src/components/PortalSubNav.tsx
SCOPE: Portal context sub-navigation (client/admin). Structure only; styling in module CSS.
STATUS: UNLOCKED
NOTES:
- No hardcoded English UI strings; all user-facing text via i18n.
*/

"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

import styles from "./PortalSubNav.module.css";

export type PortalMode = "client" | "admin";

export type PortalNavItem = {
	// next-intl Link expects a typed href union; callers may supply plain strings.
	// Keep the API flexible here and cast at the call-site (UI-only component).
	href: string;
	label: string;
};

type PortalSubNavProps = {
	mode: PortalMode;
	items: PortalNavItem[];
};

export function PortalSubNav({ mode, items }: PortalSubNavProps) {
	const pathname = usePathname();
	const t = useTranslations("PortalSubNav");

	const isActive = React.useCallback(
		(href: string) => {
			if (!pathname) return false;
			return pathname === href || pathname.startsWith(`${href}/`) || pathname.endsWith(href);
		},
		[pathname]
	);

	const label = mode === "client" ? t("label.client") : t("label.admin");

	return (
		<div className={`${styles.bar} subnav-bar`}>
			<div className={`${styles.inner} subnav-inner`}>
				<span className={`${styles.label} subnav-label`}>{label}</span>

				<nav className={`${styles.pills} subnav-pills`} aria-label={label}>
					{items.map((item) => {
						const active = isActive(item.href);

						return (
							<Link
								key={item.href}
								href={item.href as unknown as React.ComponentProps<typeof Link>["href"]}
								className={`${styles.pill} nav-pill ${active ? `nav-pillActive ${styles.pillActive}` : ""}`}
							>
								{item.label}
							</Link>
						);
					})}
				</nav>
			</div>
		</div>
	);
}
