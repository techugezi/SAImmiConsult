// next.config.ts

// Import the Next.js configuration type for TypeScript validation.
// This ensures our config object adheres to Next.js' expected shape.
import { NextConfig } from 'next';

// Import the Next-Intl plugin, which integrates internationalization
// into Next.js (App Router) by automatically wiring translation loading,
// routing, and server context utilities.
import createNextIntlPlugin from 'next-intl/plugin';


// Define our core Next.js configuration.
// The NextConfig type ensures proper structure and autocompletion.
const nextConfig: NextConfig = {
	// Enables React Strict Mode during development.
	// This activates extra checks to detect side effects and potential issues.
	reactStrictMode: true,

	experimental: {
		// Enables React Server Actions (stable in Next.js App Router).
		// Allows calling server-side functions directly from client components
		// without needing API routes.

		// FIXED: Next.js 16 requires serverActions to be an object, not a boolean
		serverActions: {
			bodySizeLimit: "10mb",
		},
	},

	// Allow dev assets (/_next/*) to be requested from these origins on your LAN
	allowedDevOrigins: [
		'localhost',
		'127.0.0.1',
		'192.168.50.254',
		// Add the PC IP you open from your phone if different, e.g. '192.168.50.10'
	],
	
	// (If you have other config values, keep them here)

};



// Create the Next-Intl plugin instance.
// With no options passed, it automatically uses:
//   - ./src/i18n/request.ts  → For server-side message loading
//   - ./src/i18n/messages/   → For translation files
//
// The plugin returns a function that wraps and enhances our Next.js config.
const withNextIntl = createNextIntlPlugin();


// Export the final config, wrapped by the Next-Intl plugin.
//
// This merges the plugin’s i18n behavior with our own configuration,
// enabling localized routing, server translations, and locale detection.
export default withNextIntl(nextConfig);
