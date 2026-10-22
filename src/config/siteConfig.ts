/*
DOC NAME: siteConfig.ts
LOCATION: /src/config/siteConfig.ts
SCOPE: Centralized site configuration (brand + contact/social + typed route helpers).
STATUS: UNLOCKED (lock after verified)
AUDIT:
- Option A routing: prefers typed href objects for next-intl <Link>.
- Avoids template-string URL building in components/pages.
- Dynamic segments standardized to [id] based on folder structure.
*/

export const siteConfig = {
	/* ---------------------------------------------------------------------- */
	/* Brand                                                                  */
	/* ---------------------------------------------------------------------- */
	brandName: "SA Immi Consult",

	/* ---------------------------------------------------------------------- */
	/* Public routes                                                          */
	/* ---------------------------------------------------------------------- */
	rootPath: "/" as const,
	rootHref: { pathname: "/" } as const,

	homePath: "/home" as const,
	homeHref: { pathname: "/home" } as const,

	aboutPath: "/about" as const,
	aboutHref: { pathname: "/about" } as const,

	servicesPath: "/services" as const,
	servicesHref: { pathname: "/services" } as const,

	newsPath: "/news" as const,
	newsHref: { pathname: "/news" } as const,

	faqPath: "/faq" as const,
	faqHref: { pathname: "/faq" } as const,

	contactPath: "/contact" as const,
	contactHref: { pathname: "/contact" } as const,

	/* ---------------------------------------------------------------------- */
	/* Service sub-routes                                                     */
	/* ---------------------------------------------------------------------- */
	servicesImmigrationPath: "/services/immigration" as const,
	servicesImmigrationHref: { pathname: "/services/immigration" } as const,

	servicesEmigrationPath: "/services/emigration" as const,
	servicesEmigrationHref: { pathname: "/services/emigration" } as const,

	servicesVisaTypesPath: "/services/visa-types" as const,
	servicesVisaTypesHref: { pathname: "/services/visa-types" } as const,

	servicesAdditionalSupportPath: "/services/additional-support" as const,
	servicesAdditionalSupportHref: { pathname: "/services/additional-support" } as const,

	/* ---------------------------------------------------------------------- */
	/* News dynamic route                                                     */
	/* ---------------------------------------------------------------------- */
	newsArticleRoute: "/news/[slug]" as const,
	newsArticlePath: (slug: string) => `/news/${slug}` as const,
	newsArticleHref: (slug: string) =>
		({ pathname: "/news/[slug]", params: { slug } } as const),

	/* ---------------------------------------------------------------------- */
	/* Auth routes                                                            */
	/* ---------------------------------------------------------------------- */
	loginPath: "/login" as const,
	loginHref: { pathname: "/login" } as const,

	signupPath: "/signup" as const,
	signupHref: { pathname: "/signup" } as const,

	authSuccessPath: "/auth/success" as const,
	authSuccessHref: { pathname: "/auth/success" } as const,

	/* ---------------------------------------------------------------------- */
	/* Password flows                                                         */
	/* ---------------------------------------------------------------------- */
	forgotPasswordPath: "/password/forgot" as const,
	forgotPasswordHref: { pathname: "/password/forgot" } as const,

	resetPasswordPath: "/password/reset" as const,
	resetPasswordHref: { pathname: "/password/reset" } as const,

	changePasswordPath: "/password/change" as const,
	changePasswordHref: { pathname: "/password/change" } as const,

	/* ---------------------------------------------------------------------- */
	/* Client area                                                            */
	/* ---------------------------------------------------------------------- */
	clientAccountPath: "/client/account" as const,
	clientAccountHref: { pathname: "/client/account" } as const,

	clientDashboardPath: "/client/dashboard" as const,
	clientDashboardHref: { pathname: "/client/dashboard" } as const,

	// cases
	clientCasesPath: "/client/cases" as const,
	clientCasesHref: { pathname: "/client/cases" } as const,

	clientNewCasePath: "/client/cases/new" as const,
	clientNewCaseHref: { pathname: "/client/cases/new" } as const,

	clientCaseDetailsRoute: "/client/cases/[id]" as const,
	clientCaseDetailsPath: (id: string) => `/client/cases/${id}` as const,
	clientCaseDetailsHref: (id: string) =>
		({ pathname: "/client/cases/[id]", params: { id } } as const),

	// documents
	clientDocumentsPath: "/client/documents" as const,
	clientDocumentsHref: { pathname: "/client/documents" } as const,

	// applications
	clientApplicationsPath: "/client/applications" as const,
	clientApplicationsHref: { pathname: "/client/applications" } as const,

	clientNewApplicationPath: "/client/applications/new" as const,
	clientNewApplicationHref: { pathname: "/client/applications/new" } as const,

	clientApplicationDetailsRoute: "/client/applications/[id]" as const,
	clientApplicationDetailsPath: (id: string) => `/client/applications/${id}` as const,
	clientApplicationDetailsHref: (id: string) =>
		({ pathname: "/client/applications/[id]", params: { id } } as const),

	/* ---------------------------------------------------------------------- */
	/* Admin area                                                             */
	/* ---------------------------------------------------------------------- */
	adminAccountPath: "/admin/account" as const,
	adminAccountHref: { pathname: "/admin/account" } as const,

	adminDashboardPath: "/admin/dashboard" as const,
	adminDashboardHref: { pathname: "/admin/dashboard" } as const,

	// cases
	adminCasesPath: "/admin/cases" as const,
	adminCasesHref: { pathname: "/admin/cases" } as const,

	adminCaseDetailsRoute: "/admin/cases/[id]" as const,
	adminCaseDetailsPath: (id: string) => `/admin/cases/${id}` as const,
	adminCaseDetailsHref: (id: string) =>
		({ pathname: "/admin/cases/[id]", params: { id } } as const),

	// applications
	adminApplicationsPath: "/admin/applications" as const,
	adminApplicationsHref: { pathname: "/admin/applications" } as const,

	adminApplicationDetailsRoute: "/admin/applications/[id]" as const,
	adminApplicationDetailsPath: (id: string) => `/admin/applications/${id}` as const,
	adminApplicationDetailsHref: (id: string) =>
		({ pathname: "/admin/applications/[id]", params: { id } } as const),

	// documents
	adminDocumentsPath: "/admin/documents" as const,
	adminDocumentsHref: { pathname: "/admin/documents" } as const,

	// client profiles
	adminClientProfilesPath: "/admin/clientprofiles" as const,
	adminClientProfilesHref: { pathname: "/admin/clientprofiles" } as const,

	adminClientProfileDetailsRoute: "/admin/clientprofiles/[id]" as const,
	adminClientProfileDetailsPath: (id: string) => `/admin/clientprofiles/${id}` as const,
	adminClientProfileDetailsHref: (id: string) =>
		({ pathname: "/admin/clientprofiles/[id]", params: { id } } as const),

	// content admin
	adminContentPath: "/admin/content" as const,
	adminContentHref: { pathname: "/admin/content" } as const,

	/* ---------------------------------------------------------------------- */
	/* Admin list filters (avoids `${path}?status=...` all over the place)     */
	/* ---------------------------------------------------------------------- */
	adminCasesByStatusHref: (status: string) =>
		({ pathname: "/admin/cases", query: { status } } as const),

	adminApplicationsByStatusHref: (status: string) =>
		({ pathname: "/admin/applications", query: { status } } as const),

	/* ---------------------------------------------------------------------- */
	/* Contact                                                                */
	/* ---------------------------------------------------------------------- */
	email: "info@saimmiconsult.com" as const,

	phoneRuDisplay: "+7 993 617 7697" as const,
	phoneRuTel: "+79936177697" as const,

	phoneZaDisplay: "+27 72 566 0653" as const,
	phoneZaTel: "+27725660653" as const,

	/* ---------------------------------------------------------------------- */
	/* Messaging links                                                        */
	/* ---------------------------------------------------------------------- */
	whatsappPhone: "+27725560653" as const,
	whatsappUrl: "https://wa.me/27725660653" as const,

	telegramPhone: "+27725560653" as const,
	telegramPhoneUrl: "https://t.me/IraSAImmi" as const,

	/* ---------------------------------------------------------------------- */
	/* Social                                                                 */
	/* ---------------------------------------------------------------------- */
	telegramUrl: "https://t.me/sa_immigration" as const,
	instagramUrl: "https://www.instagram.com/saimmiconsult" as const,
	facebookUrl: "https://www.facebook.com/saimmiconsultants/" as const,
	vkUrl: "https://vk.com/public213273428" as const,
} as const;
