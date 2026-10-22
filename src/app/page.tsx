/* /src/app/ */

import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";
import { siteConfig } from "@/config/siteConfig";

export default function RootIndexPage() {
	const defaultLocale = routing.defaultLocale ?? routing.locales[0];
	redirect(`/${defaultLocale}${siteConfig.homePath}`);
}