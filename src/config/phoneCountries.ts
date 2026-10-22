/*
DOC NAME: phoneCountries.ts
LOCATION: /src/config/phoneCountries.ts
SCOPE: Phone/WhatsApp country dropdown behavior (ordering + defaults). No country names (UI builds labels).
STATUS: UNLOCKED
*/

export const DEFAULT_WHATSAPP_COUNTRY_ISO2 = "ZA";

export const EXCLUDED_PHONE_COUNTRIES_ISO2 = ["TW"] as const;

export const WHATSAPP_COUNTRY_GROUPS = [
	{
		groupKey: "northAmerica",
		iso2: ["US", "CA", "MX"],
	},
	{
		groupKey: "europe",
		iso2: [
			"GB",
			"DE",
			"FR",
			"IT",
			"ES",
			"PT",
			"NL",
			"BE",
			"CH",
			"AT",
			"IE",
			"SE",
			"NO",
			"DK",
			"FI",
			"PL",
			"CZ",
			"SK",
			"HU",
			"RO",
			"BG",
			"GR",
			"RU",
			"UA",
			"BY",
		],
	},
	{
		groupKey: "middleEast",
		iso2: ["TR", "SA", "AE", "QA", "OM", "KW", "BH", "IL", "JO", "LB"],
	},
	{
		groupKey: "asia",
		iso2: [
			"CN",
			"HK",
			"MO",
			"JP",
			"KR",
			"SG",
			"MY",
			"TH",
			"ID",
			"PH",
			"VN",
			"IN",
			"PK",
			"BD",
			"LK",
			"NP",
			"MM",
			"MN",
			"KZ",
		],
	},
	{
		groupKey: "africa",
		iso2: ["ZA", "NG", "KE", "GH", "ET", "TZ", "UG", "CM", "CI", "SN", "MA", "DZ", "TN", "EG"],
	},
	{
		groupKey: "southAmerica",
		iso2: ["BR", "AR", "CO", "PE", "CL", "VE", "EC", "BO", "PY", "UY"],
	},
	{
		groupKey: "oceania",
		iso2: ["AU", "NZ"],
	},
] as const;

 // export const PRIORITY_PHONE_COUNTRIES_ISO2 = [
	// // North America
	// "US", // United States
	// "CA", // Canada
	// "MX", // Mexico
		// // Europe
	// "GB", // United Kingdom
	// "DE", // Germany
	// "FR", // France
	// "IT", // Italy
	// "ES", // Spain
	// "PT", // Portugal
	// "NL", // Netherlands
	// "BE", // Belgium
	// "CH", // Switzerland
	// "AT", // Austria
	// "IE", // Ireland
	// "SE", // Sweden
	// "NO", // Norway
	// "DK", // Denmark
	// "FI", // Finland
	// "PL", // Poland
	// "CZ", // Czech Republic
	// "SK", // Slovakia
	// "HU", // Hungary
	// "RO", // Romania
	// "BG", // Bulgaria
	// "GR", // Greece
	// "RU", // Russia
	// "UA", // Ukraine
	// "BY", // Belarus
		// // Middle East
	// "TR", // Turkey
	// "SA", // Saudi Arabia
	// "AE", // United Arab Emirates
	// "QA", // Qatar
	// "OM", // Oman
	// "KW", // Kuwait
	// "BH", // Bahrain
	// "IL", // Israel
	// "JO", // Jordan
	// "LB", // Lebanon
		// // Asia (excluding Taiwan as requested)
	// "CN", // China
	// "HK", // Hong Kong SAR China
	// "MO", // Macao SAR China
	// "JP", // Japan
	// "KR", // South Korea
	// "SG", // Singapore
	// "MY", // Malaysia
	// "TH", // Thailand
	// "ID", // Indonesia
	// "PH", // Philippines
	// "VN", // Vietnam
	// "IN", // India
	// "PK", // Pakistan
	// "BD", // Bangladesh
	// "LK", // Sri Lanka
	// "NP", // Nepal
	// "MM", // Myanmar
	// "MN", // Mongolia
	// "KZ", // Kazakhstan
		// // Africa
	// "ZA", // South Africa
	// "NG", // Nigeria
	// "KE", // Kenya
	// "GH", // Ghana
	// "ET", // Ethiopia
	// "TZ", // Tanzania
	// "UG", // Uganda
	// "CM", // Cameroon
	// "CI", // Ivory Coast
	// "SN", // Senegal
	// "MA", // Morocco
	// "DZ", // Algeria
	// "TN", // Tunisia
	// "EG", // Egypt
		// // South America
	// "BR", // Brazil
	// "AR", // Argentina
	// "CO", // Colombia
	// "PE", // Peru
	// "CL", // Chile
	// "VE", // Venezuela
	// "EC", // Ecuador
	// "BO", // Bolivia
	// "PY", // Paraguay
	// "UY", // Uruguay
		// // Oceania
	// "AU", // Australia
	// "NZ", // New Zealand
// ] as const;

//	export const PRIORITY_PHONE_COUNTRIES_ISO2 = [
//		// North America
//		"United States - US",
//		"Canada - CA",
//		"Mexico - MX",
//		
//		// Europe
//		"United Kingdom - GB",
//		"Germany - DE",
//		"France - FR",
//		"Italy - IT",
//		"Spain - ES",
//		"Portugal - PT",
//		"Netherlands - NL",
//		"Belgium - BE",
//		"Switzerland - CH",
//		"Austria - AT",
//		"Ireland - IE",
//		"Sweden - SE",
//		"Norway - NO",
//		"Denmark - DK",
//		"Finland - FI",
//		"Poland - PL",
//		"Czech Republic - CZ",
//		"Slovakia - SK",
//		"Hungary - HU",
//		"Romania - RO",
//		"Bulgaria - BG",
//		"Greece - GR",
//		"Russia - RU",
//		"Ukraine - UA",
//		"Belarus - BY",
//		
//		// Middle East
//		"Turkey - TR",
//		"Saudi Arabia - SA",
//		"United Arab Emirates - AE",
//		"Qatar - QA",
//		"Oman - OM",
//		"Kuwait - KW",
//		"Bahrain - BH",
//		"Israel - IL",
//		"Jordan - JO",
//		"Lebanon - LB",
//		
//		// Asia (excluding Taiwan as requested)
//		"China - CN",
//		"Hong Kong SAR China - HK",
//		"Macao SAR China - MO",
//		"Japan - JP",
//		"South Korea - KR",
//		"Singapore - SG",
//		"Malaysia - MY",
//		"Thailand - TH",
//		"Indonesia - ID",
//		"Philippines - PH",
//		"Vietnam - VN",
//		"India - IN",
//		"Pakistan - PK",
//		"Bangladesh - BD",
//		"Sri Lanka - LK",
//		"Nepal - NP",
//		"Myanmar - MM",
//		"Mongolia - MN",
//		"Kazakhstan - KZ",
//		
//		// Africa
//		"South Africa - ZA",
//		"Nigeria - NG",
//		"Kenya - KE",
//		"Ghana - GH",
//		"Ethiopia - ET",
//		"Tanzania - TZ",
//		"Uganda - UG",
//		"Cameroon - CM",
//		"Ivory Coast - CI",
//		"Senegal - SN",
//		"Morocco - MA",
//		"Algeria - DZ",
//		"Tunisia - TN",
//		"Egypt - EG",
//		
//		// South America
//		"Brazil - BR",
//		"Argentina - AR",
//		"Colombia - CO",
//		"Peru - PE",
//		"Chile - CL",
//		"Venezuela - VE",
//		"Ecuador - EC",
//		"Bolivia - BO",
//		"Paraguay - PY",
//		"Uruguay - UY",
//		
//		// Oceania
//		"Australia - AU",
//		"New Zealand - NZ",
//	] as const;