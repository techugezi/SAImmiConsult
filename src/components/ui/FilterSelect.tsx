/*
DOC NAME: FilterSelect.tsx
LOCATION: /src/components/ui/FilterSelect.tsx
SCOPE: Client-side URL param filter control (select)
STATUS: LOCKED
APPLIES TO: Any page panel filters using querystring params (Admin/Client lists)
NOTES:
- Uses App Router navigation (useRouter/usePathname/useSearchParams).
- “all” is a sentinel value; when selected, the param is removed to keep URLs clean.
- No hardcoded UI strings; labels/options are passed in from pages via i18n.
- action is accepted for compatibility/future-proofing, but submit is prevented (client-driven).
CONTENT:
*/

"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import styles from "./FilterSelect.module.css";

type Option = {
	value: string;
	label: string;
};

type Props = {
	action?: string;
	label: string;
	name: string;
	defaultValue?: string;
	options: Option[];
};

export default function FilterSelect({
	action,
	label,
	name,
	defaultValue,
	options,
}: Props) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const currentValue = useMemo(() => {
		return searchParams.get(name) ?? defaultValue ?? "all";
	}, [searchParams, name, defaultValue]);

	return (
		<form
			action={action}
			className={`${styles.form} stack`}
			onSubmit={(e) => e.preventDefault()}
		>
			<label htmlFor={name} className="form-label">
				{label}
			</label>

			<select
				id={name}
				name={name}
				className="form-control"
				value={currentValue}
				onChange={(e) => {
					const next = e.target.value;
					const params = new URLSearchParams(searchParams.toString());

					if (next === "all") params.delete(name);
					else params.set(name, next);

					const qs = params.toString();
					router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
				}}
			>
				{options.map((o) => (
					<option key={o.value} value={o.value}>
						{o.label}
					</option>
				))}
			</select>
		</form>
	);
}
