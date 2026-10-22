/*
DOC NAME: FormField.tsx
LOCATION: /src/components/ui/forms/FormField.tsx
SCOPE: Global primitive wrapper for a form field (label + control + optional hint). Layout only.
STATUS: UNLOCKED (lock after approved)
*/

"use client";

import type React from "react";

import styles from "./FormField.module.css";

type Props = {
	label: React.ReactNode;
	htmlFor: string;
	children: React.ReactNode;
	hint?: React.ReactNode;
	fullWidth?: boolean;
};

export default function FormField({ label, htmlFor, children, hint, fullWidth }: Props) {
	return (
		<div className={`${styles.field}${fullWidth ? ` ${styles.full}` : ""}`}>
			<label className="form-label" htmlFor={htmlFor}>
				{label}
			</label>

			{children}

			{hint ? (
				<p className="text-sm text-muted" style={{ margin: 0 }}>
					{hint}
				</p>
			) : null}
		</div>
	);
}
