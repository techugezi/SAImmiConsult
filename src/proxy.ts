// src/proxy.ts

// NOTE: This is NOT Next.js middleware unless explicitly wired as /middleware.ts - currently only a wrapper.

import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match everything except:
  // - /api, /trpc, /_next, /_vercel
  // - static assets with a dot in the path
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)'
};
