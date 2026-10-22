/*
DOC NAME: clientProfileFormConfig.ts
LOCATION: /src/config/clientProfileFormConfig.ts
SCOPE: Client profile form config (sections + select options + contact preference options). No UI strings.
STATUS: UNLOCKED
*/

export const CLIENT_PROFILE_SECTIONS = [
	{
		id: "personal",
		titleKey: "sections.personal.title",
		subtitleKey: "sections.personal.subtitle",
	},
	{ id: "residence", titleKey: "sections.residence.title" },
	{ id: "familyFinances", titleKey: "sections.familyFinances.title" },
	{ id: "travelHistory", titleKey: "sections.travelHistory.title" },
	{ id: "passportPlans", titleKey: "sections.passportPlans.title" },
	{ id: "language", titleKey: "sections.language.title" },
] as const;

export const MARITAL_STATUS_OPTIONS = [
	{ value: "single", labelKey: "fields.maritalStatus.options.single" },
	{ value: "married", labelKey: "fields.maritalStatus.options.married" },
	{ value: "divorced", labelKey: "fields.maritalStatus.options.divorced" },
	{ value: "widowed", labelKey: "fields.maritalStatus.options.widowed" },
	{ value: "other", labelKey: "fields.maritalStatus.options.other" },
] as const;

export const YES_NO_UNSPECIFIED_OPTIONS = [
	{ value: "yes", labelKey: "options.yes" },
	{ value: "no", labelKey: "options.no" },
	{ value: "unspecified", labelKey: "options.unspecified" },
] as const;

export const ENGLISH_LEVEL_OPTIONS = [
	{ value: "basic", labelKey: "fields.englishLevel.options.basic" },
	{ value: "intermediate", labelKey: "fields.englishLevel.options.intermediate" },
	{ value: "fluent", labelKey: "fields.englishLevel.options.fluent" },
] as const;

export const PREFERRED_CONTACT_METHOD_OPTIONS = [
	{ value: "email", labelKey: "fields.preferredContactMethod.options.email" },
	{ value: "whatsapp", labelKey: "fields.preferredContactMethod.options.whatsapp" },
	{ value: "telegram", labelKey: "fields.preferredContactMethod.options.telegram" },
] as const;

export type PreferredContactMethod = (typeof PREFERRED_CONTACT_METHOD_OPTIONS)[number]["value"];
