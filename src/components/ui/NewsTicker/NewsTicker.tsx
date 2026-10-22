/*
DOC NAME: NewsTicker.tsx
LOCATION: /src/components/ui/NewsTicker/NewsTicker.tsx
SCOPE: Client-side marquee ticker for headlines (pauses off-screen, respects reduced motion). Reusable on Home + News.
STATUS: UNLOCKED (lock after verified)
*/

"use client";

import * as React from "react";

import { Link } from "@/i18n/navigation";

import styles from "./NewsTicker.module.css";

/**
 * IMPORTANT:
 * - This component uses next-intl typed <Link/>.
 * - For dynamic routes, prefer passing the object href form: { pathname, params }.
 * - To avoid "pathname is undefined" class issues, we type href to match <Link />.
 */
type LinkHref = React.ComponentProps<typeof Link>["href"];

export type NewsTickerItem = {
	key: string;
	headline: string;
	href?: LinkHref;
};

type Props = {
	eyebrow: string;
	items: NewsTickerItem[];
};

export default function NewsTicker({ eyebrow, items }: Props) {
	const trackRef = React.useRef<HTMLDivElement | null>(null);
	const setARef = React.useRef<HTMLDivElement | null>(null);
	const wrapRef = React.useRef<HTMLDivElement | null>(null);

	const [isDragging, setIsDragging] = React.useState(false);

	const loopItems = React.useMemo(() => {
		if (!items || items.length === 0) return [];

		// Ensure the ticker never looks "empty" with too-few items (e.g., 1–2 rows).
		// When you add more news, this naturally collapses back to a single pass.
		const MIN_ITEMS = 8;
		const repeats = items.length >= MIN_ITEMS ? 1 : Math.ceil(MIN_ITEMS / items.length);
		const out: NewsTickerItem[] = [];

		for (let i = 0; i < items.length * repeats; i += 1) {
			out.push(items[i % items.length]!);
		}

		return out;
	}, [items]);

	React.useEffect(() => {
		const track = trackRef.current;
		const setA = setARef.current;
		const wrap = wrapRef.current;
		if (!track || !setA || !wrap) return;

		const prefersReduced =
			window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;

		// We drive transform ourselves (for swipe + inertia), so disable the CSS keyframes.
		track.style.animation = "none";

		// ---- Measurements (loop distance = one full set width) ----
		let distance = 0;

		const measure = () => {
			const d = Math.ceil(setA.getBoundingClientRect().width);
			if (!d || !Number.isFinite(d)) return;

			distance = d;
			track.style.setProperty("--ticker-distance", `${distance}px`);
		};

		let rafMeasure = 0;
		const scheduleMeasure = () => {
			cancelAnimationFrame(rafMeasure);
			rafMeasure = requestAnimationFrame(measure);
		};

		scheduleMeasure();

		const ro = new ResizeObserver(scheduleMeasure);
		ro.observe(setA);

		// ---- Animation state ----
		let offsetPx = 0;

		// Extra velocity injected by swipe “fling” (px/sec); decays over time.
		let flingVel = 0;

		// Base auto-scroll speed (px/sec) — matches your previous feel (55px/sec).
		const BASE_PX_PER_SEC = 55;

		// Active/offscreen gate
		let isActive = false;

		// Pause gate for hover/focus-within (same intent as your previous CSS pause)
		let isUiPaused = false;

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
			rafAnim = requestAnimationFrame(step);

			if (!isActive) {
				lastT = now;
				return;
			}

			const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
			lastT = now;

			// Reduced motion: no auto motion, but still allow drag updates.
			if (prefersReduced) {
				applyTransform();
				return;
			}

			// Pause on hover / focus-within (like your previous CSS).
			if (isUiPaused) {
				applyTransform();
				return;
			}

			// During drag, offset is driven by pointermove (no auto step).
			if (!drag.isDragging) {
				offsetPx += (BASE_PX_PER_SEC + flingVel) * dt;

				// Exponential decay for fling
				const decay = Math.exp(-6 * dt);
				flingVel *= decay;

				if (Math.abs(flingVel) < 2) flingVel = 0;

				applyTransform();
			}
		};

		// ---- Pointer swipe handling ----
		const drag = {
			isDragging: false,
			pointerId: -1,
			startX: 0,
			startOffset: 0,
			lastX: 0,
			lastTime: 0,
			velX: 0, // px/sec
		};

		const onPointerDown = (e: PointerEvent) => {
			if (e.pointerType === "mouse" && e.button !== 0) return;
			if (!distance) return;

			drag.isDragging = true;
			drag.pointerId = e.pointerId;
			drag.startX = e.clientX;
			drag.startOffset = offsetPx;
			drag.lastX = e.clientX;
			drag.lastTime = performance.now();
			drag.velX = 0;

			// Kill any running fling so swipe feels 1:1.
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

			// Velocity estimate
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

			// Clamp fling so fast swipes don’t “teleport”
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

		// ---- Hover / focus pause (matches your previous CSS pause intent) ----
		const onMouseEnter = () => {
			isUiPaused = true;
		};

		const onMouseLeave = () => {
			isUiPaused = false;
		};

		const onFocusIn = () => {
			isUiPaused = true;
		};

		const onFocusOut = () => {
			isUiPaused = false;
		};

		wrap.addEventListener("mouseenter", onMouseEnter);
		wrap.addEventListener("mouseleave", onMouseLeave);
		wrap.addEventListener("focusin", onFocusIn);
		wrap.addEventListener("focusout", onFocusOut);

		// Bind pointer handlers on the wrapper so the whole ticker is swipeable.
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

			wrap.removeEventListener("mouseenter", onMouseEnter);
			wrap.removeEventListener("mouseleave", onMouseLeave);
			wrap.removeEventListener("focusin", onFocusIn);
			wrap.removeEventListener("focusout", onFocusOut);

			wrap.removeEventListener("pointerdown", onPointerDown);
			wrap.removeEventListener("pointermove", onPointerMove);
			wrap.removeEventListener("pointerup", onPointerUp);
			wrap.removeEventListener("pointercancel", onPointerCancel);

			if (io) io.disconnect();
			ro.disconnect();
		};
	}, [loopItems.length]);

	if (!loopItems || loopItems.length === 0) return null;

	const renderItem = (item: NewsTickerItem, idx: number) => {
		const inner = (
			<>
				<span className="news-ticker-category">{eyebrow}</span>
				<span className="news-ticker-headline">{item.headline}</span>
				<span className="news-ticker-divider" aria-hidden="true">
					/
				</span>
			</>
		);

		return (
			<div key={`${item.key}__${idx}`} className={styles.item}>
				{item.href ? (
					<Link href={item.href} className={styles.itemLink}>
						{inner}
					</Link>
				) : (
					inner
				)}
			</div>
		);
	};

	return (
		<div
			ref={wrapRef}
			className={`${styles.wrapper} news-ticker${isDragging ? ` ${styles.wrapperDragging}` : ""}`}
			aria-label={eyebrow}
		>
			<div ref={trackRef} className={styles.track}>
				<div ref={setARef} className={styles.set}>
					{loopItems.map(renderItem)}
				</div>

				<div className={styles.set} aria-hidden="true">
					{loopItems.map(renderItem)}
				</div>
			</div>

			<div className={`${styles.overlayLeft} news-ticker-overlay-left`} aria-hidden="true" />
			<div className={`${styles.overlayRight} news-ticker-overlay-right`} aria-hidden="true" />
		</div>
	);
}
