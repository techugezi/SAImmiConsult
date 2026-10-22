/*
DOC NAME: SearchField.tsx
LOCATION: /src/components/ui/SearchField/SearchField.tsx
SCOPE: Reusable search form (input + clear button + search button). Markup matches admin/clientprofiles search.
STATUS: UNLOCKED (lock after approved)
*/

"use client";

import type React from "react";
import { Link } from "@/i18n/navigation";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useEffect, useId, useRef } from "react";

import styles from "./SearchField.module.css";

type HiddenField = { name: string; value: string };

type Props = {
	action: string;

	/** Query string param name (default: "q") */
	name?: string;

	/** Initial value (server-side defaultValue) */
	defaultValue?: string;

	/** Optional hidden fields to preserve other filters (e.g., sort/status) */
	hiddenFields?: HiddenField[];

	/** Href for the clear button (removes q, preserves other params) */
	clearHref:
		| { pathname: string; query?: Record<string, string> }
		| { pathname: string; query?: never };

	/** a11y + UX strings (no hardcoded copy inside component) */
	srLabel: string;
	placeholder: string;
	clearLabel: string;
	searchLabel: string;
};

export default function SearchField({
	action,
	name = "q",
	defaultValue = "",
	hiddenFields = [],
	clearHref,

	srLabel,
	placeholder,
	clearLabel,
	searchLabel,
}: Props) {
	const router = useRouter();
	const pathname = usePathname();

	const inputId = useId();
	const inputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		const focusId =
			typeof window !== "undefined" ? window.sessionStorage.getItem("sf:focus") : null;

		if (focusId && focusId === inputId) {
			window.sessionStorage.removeItem("sf:focus");
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [inputId]);
	
	const searchParams = useSearchParams();
	const currentValue = searchParams.get(name) ?? "";

	return (
		<form
			className={styles.searchForm}
			method="get"
			action={action}
			onSubmit={(e) => {
				e.preventDefault();

				const form = e.currentTarget;
				const fd = new FormData(form);

				const params = new URLSearchParams();
				fd.forEach((value, key) => {
					const v = String(value ?? "").trim();
					if (v) params.set(key, v);
				});

				window.sessionStorage.setItem("sf:focus", inputId);

				const qs = params.toString();
				const nextUrl = qs ? `${pathname}?${qs}` : pathname;

				router.replace(nextUrl, { scroll: false });
			}}
		>

			{hiddenFields.map((f) => (
				<input key={f.name} type="hidden" name={f.name} value={f.value} />
			))}

			<label className={styles.srOnly} htmlFor={inputId}>
				{srLabel}
			</label>

			<div className={styles.searchField}>
				<input
					key={`${name}:${currentValue}`}
					id={inputId}
					ref={inputRef}
					name={name}
					defaultValue={defaultValue}
					className={`form-control ${styles.searchInput}`}
					placeholder={placeholder}
					autoComplete="on"
				/>

				<Link
					href={clearHref as any}
					scroll={false}
					className={`button button-ghost ${styles.clearIconButton}`}
					aria-label={clearLabel}
					title={clearLabel}
				>
					<svg className={styles.clearIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
						<path
							d="M18 6L6 18M6 6l12 12"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
						/>
					</svg>
				</Link>
			</div>

			<button
				className={`button button-primary ${styles.searchButton}`}
				type="submit"
				aria-label={searchLabel}
				title={searchLabel}
			>
				<svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
					<path d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" stroke="currentColor" strokeWidth="2" />
					<path
						d="M21 21l-4.35-4.35"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
					/>
				</svg>
			</button>
		</form>
	);
}
