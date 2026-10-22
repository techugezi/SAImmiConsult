// src/components/journey/JourneyTracker.tsx
// Client-facing journey card: header (status badge) + 5-stage stepper + "what's next".
// Presentational: the page resolves the status string and hrefs.
// Works in server components (next-intl's useTranslations is supported there).

import type { ComponentProps } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { STAGES, getJourney } from "@/lib/workflow/journey";

import styles from "./journey.module.css";

type Href = ComponentProps<typeof Link>["href"];

type Props = {
	/** Effective status: case status, application status, or a pseudo status. */
	status: string;
	/** Existing status badge (label + global badge classes) from statuses config. */
	badge: { label: string; className: string };
	/** Where the client's primary button goes (only pass when it's the client's turn). */
	primaryHref?: Href | null;
	/** Secondary "view details" link (translated label). */
	details?: { href: Href; label: string } | null;
	/** Arrow glyph, e.g. tGlobal("Common.symbols.arrowRight"). */
	arrow: string;
	/** Body shown only if the status isn't in the journey map. */
	fallbackBody?: string;
	/** Pass the dashboard card class so the shell matches the other cards. */
	className?: string;
};

function Check() {
	return (
		<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
			<path d="M4.5 10.5l3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

function Cross() {
	return (
		<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
			<path d="M5.5 5.5l9 9M14.5 5.5l-9 9" strokeLinecap="round" />
		</svg>
	);
}

export default function JourneyTracker({
	status,
	badge,
	primaryHref,
	details,
	arrow,
	fallbackBody,
	className,
}: Props) {
	const t = useTranslations("Journey");
	const journey = getJourney(status);

	const header = (
		<div className={styles.header}>
			<h2 className="panel-title">{t("title")}</h2>
			<span className={badge.className}>{badge.label}</span>
		</div>
	);

	const detailsLink = details ? (
		<Link href={details.href} className={styles.details}>
			<span>{details.label}</span>
			<span className={styles.detailsArrow} aria-hidden="true">
				{arrow}
			</span>
		</Link>
	) : null;

	// Unmapped status: degrade to the old behaviour (badge + description + link).
	if (!journey) {
		return (
			<article className={className}>
				{header}
				{fallbackBody ? <p className="text-sm text-muted">{fallbackBody}</p> : null}
				{detailsLink}
			</article>
		);
	}

	const { stage, actor, terminal, complete } = journey;
	const total = STAGES.length;
	// A "complete" status ticks its own stage and highlights the next one.
	const current = complete ? Math.min(stage + 1, total) : stage;
	const allDone = terminal === "done";

	const turn =
		terminal === "done"
			? { key: "badge.completed", cls: "" }
			: terminal === "stopped"
				? { key: "badge.stopped", cls: "" }
				: actor === "client"
					? { key: "badge.yourTurn", cls: styles.turnYou }
					: { key: "badge.waitingConsultant", cls: "" };

	return (
		<article className={className}>
			{header}

			<div className={styles.journey}>
				<ol className={styles.steps} aria-label={t("aria.tracker")}>
					{STAGES.map((n) => {
						const isDone = allDone || n < current;
						const isCurrent = !allDone && n === current;
						const isStopped = isCurrent && terminal === "stopped";
						const state = isStopped ? styles.stopped : isDone ? styles.done : isCurrent ? styles.current : "";

						return (
							<li key={n} className={`${styles.step} ${state}`} aria-current={isCurrent ? "step" : undefined}>
								<span className={styles.marker}>
									{isStopped ? <Cross /> : isDone ? <Check /> : n}
								</span>
								<span className={styles.label}>
									{t(`stages.${n}`)}
									<span className={styles.srOnly}>
										{" "}
										{isDone ? t("aria.done") : isCurrent ? t("aria.current") : t("aria.upcoming")}
									</span>
								</span>
							</li>
						);
					})}
				</ol>

				<div className={styles.now}>
					<p className={styles.stepLine}>{t("stepOf", { current, total, stage: t(`stages.${current}`) })}</p>
					<p className={`${styles.turn} ${turn.cls}`}>{t(turn.key)}</p>

					<h3 className={styles.nowTitle}>{t(`client.${journey.status}.title`)}</h3>
					<p className={styles.nowBody}>{t(`client.${journey.status}.body`)}</p>

					{primaryHref ? (
						<div className={styles.actions}>
							<Link href={primaryHref} className="button button-primary">
								{t(`client.${journey.status}.cta`)}
							</Link>
						</div>
					) : null}

					{detailsLink}
				</div>
			</div>
		</article>
	);
}
