/*
DOC NAME: navigation.ts
LOCATION: /src/i18n/navigation.ts
SCOPE: next-intl navigation helpers (Link/redirect/hooks) bound to routing config.
STATUS: UNLOCKED (lock after verified)
AUDIT:
- No functional changes; kept canonical next-intl createNavigation(routing) binding.
- Ensures all navigation helpers remain locale-aware via a single routing source of truth.
- Style-only: consistent quotes/formatting; no behavior changes introduced.
*/

import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter, getPathname } =
	createNavigation(routing);
