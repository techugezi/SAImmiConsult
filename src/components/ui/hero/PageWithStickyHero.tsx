"use client";

import React from "react";
import { PageShell } from "@/components/ui/layout/PageShell";
import { MainColumn } from "@/components/ui/layout/MainColumn";
import styles from "./PageWithStickyHero.module.css";
import type { CSSProperties } from "react";

type PageWithStickyHeroProps = {
	title: React.ReactNode;
	subtitle?: React.ReactNode;
	description?: React.ReactNode;
	imageSrc: string;
	actions?: React.ReactNode;
	children: React.ReactNode;
	heroClassName?: string;
	heroInnerClassName?: string;
	descriptionOnImageRole?: boolean;
	style?: CSSProperties;
	overlap?: boolean;
};

export function PageWithStickyHero({
	title,
	subtitle,
	description,
	imageSrc,
	actions,
	children,
	heroClassName,
	heroInnerClassName,
	descriptionOnImageRole = true,
	style,
	overlap = true,
}: PageWithStickyHeroProps) {
	const heroShellClasses = ["hero-shell", styles.heroShellWithImage];
	if (heroClassName) heroShellClasses.push(heroClassName);

	const heroInnerClasses = ["hero-inner", styles.heroInnerOnImage];
	if (heroInnerClassName) heroInnerClasses.push(heroInnerClassName);

	const descClasses = ["hero-desc"];
	if (descriptionOnImageRole) descClasses.push("hero-desc--onImage");

	return (
		<PageShell>
			<div
				className={styles.pageScope}
				style={
					{
						...(style ?? {}),
						["--sticky-hero-image" as any]: `url("${imageSrc}")`,
					} as CSSProperties
				}
			>
				{/* FIX: fixed background must NOT live inside an isolated header stacking context */}
				<div className={styles.fixedHeroBg} aria-hidden="true" />

				<header className={heroShellClasses.join(" ")}>
					{/* Overlay + filters */}
					<div className={styles.heroOverlay} aria-hidden="true" />

					<div className={heroInnerClasses.join(" ")}>
						<div className="fx-heroScrim">
							<h1 className="hero-title fx-textGlow">{title}</h1>

							{subtitle ? <p className="hero-subtitle fx-textStroke fx-textGlowStrong">{subtitle}</p> : null}

							{description ? <p className={descClasses.join(" ")}>{description}</p> : null}

							{actions ? <div className="hero-actions">{actions}</div> : null}
						</div>
					</div>
				</header>

				<div className={styles.mainStage}>
					<MainColumn className={overlap ? styles.mainOverlap : styles.mainAbove}>{children}</MainColumn>
				</div>
			</div>
		</PageShell>
	);
}
