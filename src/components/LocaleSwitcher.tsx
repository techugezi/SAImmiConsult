/*
DOC NAME: LocaleSwitcher.tsx
LOCATION: /src/components/LocaleSwitcher.tsx
SCOPE: Locale toggle (EN/RU) used in navbar (header + drawer). Visual-only.
STATUS: UNLOCKED
*/

"use client";

import * as React from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { ComponentProps } from "react";

import { useParams } from "next/navigation";

import styles from "./LocaleSwitcher.module.css";

type LocaleSwitcherProps = {
	variant?: "header" | "drawer";
};

export default function LocaleSwitcher({ variant = "header" }: LocaleSwitcherProps) {
	const locale = useLocale();
	const t = useTranslations("GlobalForm");
	const router = useRouter();
	const pathname = usePathname();
	const params = useParams();
	
	const routeParams = React.useMemo(() => {
		const out: Record<string, string> = {};
		if (!params) return out;
	
		for (const [k, v] of Object.entries(params)) {
			if (typeof v === "string") out[k] = v;
			else if (Array.isArray(v) && typeof v[0] === "string") out[k] = v[0];
		}
		return out;
	}, [params]);
	

	const isEn = locale === "en";
	const nextLocale = isEn ? "ru" : "en";

	const onToggle = React.useCallback(() => {
		const targetPath = typeof pathname === "string" && pathname.length > 0 ? pathname : "/";
	
		// If next-intl gave us a dynamic template (e.g. "/admin/.../[id]"),
		// we must pass the current params or it will throw.
		if (targetPath.includes("[")) {

		type Router = ReturnType<typeof useRouter>;
		type AppHref = Parameters<Router["replace"]>[0];

		const href = {
			pathname: targetPath,
			params: routeParams,
		} as unknown as AppHref;
	
		router.replace(href, { locale: nextLocale });
		return;
	}

		// Static/unknown route: route types may not include bracket templates (e.g. "/news/[slug]"),
		// so cast through the router's href type to satisfy TS.
		type Router = ReturnType<typeof useRouter>;
		type AppHref = Parameters<Router["replace"]>[0];
		router.replace(targetPath as unknown as AppHref, { locale: nextLocale });
 	}, [router, pathname, routeParams, nextLocale]);
	

	const containerClass = variant === "drawer" ? styles.containerDrawer : styles.containerHeader;

	const ariaLabel = isEn ? t("labels.switchToRu") : t("labels.switchToEn");

	return (
		<div className={`${styles.container} ${containerClass}`}>
			{/* EN label (left) */}
			<span className={`${styles.langLabel} ${isEn ? styles.langActive : styles.langInactive}`}>
				{t("labels.en")}
			</span>

			{/* Flag pill + porcelain knob */}
			<button
				type="button"
				onClick={onToggle}
				className={styles.toggle}
				aria-label={ariaLabel}
				title={ariaLabel}
				aria-pressed={!isEn}
			>
				<span
					className={`${styles.track} ${isEn ? styles.trackEn : styles.trackRu}`}
					aria-hidden="true"
				>
					<Image
						key={isEn ? "flag-en" : "flag-ru"}
						src={isEn ? "/flags/uk.png" : "/flags/ru.png"}
						alt=""
						fill
						sizes="72px"
						className={styles.flag}
						priority={false}
					/>
				</span>
			</button>

			{/* RU label (right) */}
			<span className={`${styles.langLabel} ${!isEn ? styles.langActive : styles.langInactive}`}>
				{t("labels.ru")}
			</span>
		</div>
	);
}
