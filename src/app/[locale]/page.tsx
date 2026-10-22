/* /src/app/[locale] */

import { redirect } from "next/navigation";
import { siteConfig } from "@/config/siteConfig";

export default async function LocaleIndexPage({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	redirect(`/${locale}${siteConfig.homePath}`);
}
