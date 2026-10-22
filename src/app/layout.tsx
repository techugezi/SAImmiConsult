/*
DOC NAME: layout.tsx
LOCATION: /src/app/layout.tsx
SCOPE: Required App Router root layout wrapper for /app/page.tsx redirect entry.
STATUS: UNLOCKED
*/

import type { ReactNode } from "react";
import { getLocale } from "next-intl/server";

import "./[locale]/globals.css";


export default async function RootLayout({ children }: { children: ReactNode }) {
	const locale = await getLocale();

	return (
		<html lang={locale} suppressHydrationWarning>
			<body>{children}</body>
		</html>
	);
}
