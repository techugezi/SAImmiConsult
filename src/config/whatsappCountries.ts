/* DOC NAME: WhatsApp Countries Config
   LOCATION: src/config/whatsappCountries.ts
   SCOPE: Defines supported WhatsApp country options (ISO2 + calling code)
   STATUS: ACTIVE
*/

export type WhatsAppCountryOption = {
	iso2: string; // ISO 3166-1 alpha-2
	callingCode: string; // digits only, no +
};

export const WHATSAPP_COUNTRY_OPTIONS: readonly WhatsAppCountryOption[] = [
	// North America
	{ iso2: "US", callingCode: "1" }, // United States
	{ iso2: "CA", callingCode: "1" }, // Canada
	{ iso2: "MX", callingCode: "52" }, // Mexico
	
	// Europe
	{ iso2: "GB", callingCode: "44" }, // United Kingdom
	{ iso2: "DE", callingCode: "49" }, // Germany
	{ iso2: "FR", callingCode: "33" }, // France
	{ iso2: "IT", callingCode: "39" }, // Italy
	{ iso2: "ES", callingCode: "34" }, // Spain
	{ iso2: "PT", callingCode: "351" }, // Portugal
	{ iso2: "NL", callingCode: "31" }, // Netherlands
	{ iso2: "BE", callingCode: "32" }, // Belgium
	{ iso2: "CH", callingCode: "41" }, // Switzerland
	{ iso2: "AT", callingCode: "43" }, // Austria
	{ iso2: "IE", callingCode: "353" }, // Ireland
	{ iso2: "SE", callingCode: "46" }, // Sweden
	{ iso2: "NO", callingCode: "47" }, // Norway
	{ iso2: "DK", callingCode: "45" }, // Denmark
	{ iso2: "FI", callingCode: "358" }, // Finland
	{ iso2: "PL", callingCode: "48" }, // Poland
	{ iso2: "CZ", callingCode: "420" }, // Czech Republic
	{ iso2: "SK", callingCode: "421" }, // Slovakia
	{ iso2: "HU", callingCode: "36" }, // Hungary
	{ iso2: "RO", callingCode: "40" }, // Romania
	{ iso2: "BG", callingCode: "359" }, // Bulgaria
	{ iso2: "GR", callingCode: "30" }, // Greece
	{ iso2: "RU", callingCode: "7" }, // Russia
	{ iso2: "UA", callingCode: "380" }, // Ukraine
	{ iso2: "BY", callingCode: "375" }, // Belarus
	
	// Middle East
	{ iso2: "TR", callingCode: "90" }, // Turkey
	{ iso2: "SA", callingCode: "966" }, // Saudi Arabia
	{ iso2: "AE", callingCode: "971" }, // United Arab Emirates
	{ iso2: "QA", callingCode: "974" }, // Qatar
	{ iso2: "OM", callingCode: "968" }, // Oman
	{ iso2: "KW", callingCode: "965" }, // Kuwait
	{ iso2: "BH", callingCode: "973" }, // Bahrain
	{ iso2: "IL", callingCode: "972" }, // Israel
	{ iso2: "JO", callingCode: "962" }, // Jordan
	{ iso2: "LB", callingCode: "961" }, // Lebanon
	
	// Asia (excluding Taiwan as requested)
	{ iso2: "CN", callingCode: "86" }, // China
	{ iso2: "HK", callingCode: "852" }, // Hong Kong SAR China
	{ iso2: "MO", callingCode: "853" }, // Macao SAR China
	{ iso2: "JP", callingCode: "81" }, // Japan
	{ iso2: "KR", callingCode: "82" }, // South Korea
	{ iso2: "SG", callingCode: "65" }, // Singapore
	{ iso2: "MY", callingCode: "60" }, // Malaysia
	{ iso2: "TH", callingCode: "66" }, // Thailand
	{ iso2: "ID", callingCode: "62" }, // Indonesia
	{ iso2: "PH", callingCode: "63" }, // Philippines
	{ iso2: "VN", callingCode: "84" }, // Vietnam
	{ iso2: "IN", callingCode: "91" }, // India
	{ iso2: "PK", callingCode: "92" }, // Pakistan
	{ iso2: "BD", callingCode: "880" }, // Bangladesh
	{ iso2: "LK", callingCode: "94" }, // Sri Lanka
	{ iso2: "NP", callingCode: "977" }, // Nepal
	{ iso2: "MM", callingCode: "95" }, // Myanmar
	{ iso2: "MN", callingCode: "976" }, // Mongolia
	{ iso2: "KZ", callingCode: "7" }, // Kazakhstan
	
	// Africa
	{ iso2: "ZA", callingCode: "27" }, // South Africa
	{ iso2: "NG", callingCode: "234" }, // Nigeria
	{ iso2: "KE", callingCode: "254" }, // Kenya
	{ iso2: "GH", callingCode: "233" }, // Ghana
	{ iso2: "ET", callingCode: "251" }, // Ethiopia
	{ iso2: "TZ", callingCode: "255" }, // Tanzania
	{ iso2: "UG", callingCode: "256" }, // Uganda
	{ iso2: "CM", callingCode: "237" }, // Cameroon
	{ iso2: "CI", callingCode: "225" }, // Ivory Coast
	{ iso2: "SN", callingCode: "221" }, // Senegal
	{ iso2: "MA", callingCode: "212" }, // Morocco
	{ iso2: "DZ", callingCode: "213" }, // Algeria
	{ iso2: "TN", callingCode: "216" }, // Tunisia
	{ iso2: "EG", callingCode: "20" }, // Egypt
	
	// South America
	{ iso2: "BR", callingCode: "55" }, // Brazil
	{ iso2: "AR", callingCode: "54" }, // Argentina
	{ iso2: "CO", callingCode: "57" }, // Colombia
	{ iso2: "PE", callingCode: "51" }, // Peru
	{ iso2: "CL", callingCode: "56" }, // Chile
	{ iso2: "VE", callingCode: "58" }, // Venezuela
	{ iso2: "EC", callingCode: "593" }, // Ecuador
	{ iso2: "BO", callingCode: "591" }, // Bolivia
	{ iso2: "PY", callingCode: "595" }, // Paraguay
	{ iso2: "UY", callingCode: "598" }, // Uruguay
	
	// Oceania
	{ iso2: "AU", callingCode: "61" }, // Australia
	{ iso2: "NZ", callingCode: "64" }, // New Zealand
];
