// // src/config/visaQuestionConfig.ts

// export const DESTINATIONS = [
  // { value: "south_africa", label: "South Africa" },
  // { value: "uk", label: "United Kingdom" },
  // { value: "greece", label: "Europe (Greek passport)" },
  // { value: "europe_schengen", label: "Europe / Schengen" },
  // { value: "usa", label: "United States" },
  // { value: "canada", label: "Canada" },
  // { value: "russia", label: "Russia" },
// ] as const;

// export type Destination = (typeof DESTINATIONS)[number]["value"];

// // ✅ South African visa purpose stays the same (UNCHANGED)
// export const SA_VISA_PURPOSES = [
  // { value: "visitors", label: "Visitor's Visa", subtitle: "Tourism, family visits, short business" },
  // { value: "medical_treatment", label: "Medical Treatment Visa" },
  // { value: "business", label: "Business Visa" },
  // { value: "general_work", label: "General Work Visa" },
  // { value: "critical_skills", label: "Critical Skills Work Visa" },
  // { value: "intra_company", label: "Intra-Company Transfer Work Visa" },
  // { value: "corporate", label: "Corporate Visa" },
  // { value: "study", label: "Study Visa" },
  // { value: "exchange", label: "Exchange Visa" },
  // { value: "retired", label: "Retired Persons' Visa" },
  // { value: "relatives", label: "Relative's Visa" },
  // { value: "entertainment", label: "Entertainment Industry Visa" },
  // { value: "transit", label: "Transit Visa" },
// ] as const;

// export type SAPurpose = (typeof SA_VISA_PURPOSES)[number]["value"];

// export type NonSaDestination = Exclude<Destination, "south_africa">;

// export type NonSaPurpose =
  // | "tourism_visa"
  // | "training_visa"
  // | "eu_visa_free_90_days"
  // | "work_visa";

// export type PurposeId = SAPurpose | NonSaPurpose;

// export type PurposeOption = {
  // value: PurposeId;
  // label: string;
// };

// // ✅ The export your page expects (and what fixes the runtime crash)
// export const NON_SA_VISA_PURPOSES_BY_DESTINATION: Record<NonSaDestination, readonly PurposeOption[]> = {
  // uk: [
    // { value: "tourism_visa", label: "Tourism visa" },
    // { value: "training_visa", label: "Training visa" },
  // ],
  // usa: [
    // { value: "tourism_visa", label: "Tourism visa" },
    // { value: "training_visa", label: "Training visa" },
  // ],
  // canada: [
    // { value: "tourism_visa", label: "Tourism visa" },
    // { value: "training_visa", label: "Training visa" },
  // ],
  // europe_schengen: [
    // { value: "tourism_visa", label: "Tourism visa" },
    // { value: "training_visa", label: "Training visa" },
  // ],
  // greece: [{ value: "eu_visa_free_90_days", label: "Visa-free entry to the EU for 90 days" }],
  // russia: [{ value: "work_visa", label: "Work visa" }],
// } as const;

// // OPTIONAL compatibility export (if any older files still import NON_SA_PURPOSES)
// export const NON_SA_PURPOSES = NON_SA_VISA_PURPOSES_BY_DESTINATION;


// src/config/visaQuestionConfig.ts

// Keep this generic so it works with i18next, next-intl, lingui, etc.
export type I18nKey = string;

export type Option<T extends string> = {
  value: T;
  labelKey: I18nKey;
};

export type OptionWithSubtitle<T extends string> = Option<T> & {
  subtitleKey?: I18nKey;
};

// DESTINATIONS now contains i18n keys (no hard-coded labels)
export const DESTINATIONS = [
  { value: "south_africa", labelKey: "Global.destinations.south_africa" },
  { value: "uk", labelKey: "Global.destinations.uk" },
  { value: "greece", labelKey: "Global.destinations.greece" },
  { value: "europe_schengen", labelKey: "Global.destinations.europe_schengen" },
  { value: "usa", labelKey: "Global.destinations.usa" },
  { value: "canada", labelKey: "Global.destinations.canada" },
  { value: "russia", labelKey: "Global.destinations.russia" },
] as const;

export type Destination = (typeof DESTINATIONS)[number]["value"];

// ✅ South African visa purpose values stay the same; labels/subtitles become keys
export const SA_VISA_PURPOSES = [
  {
    value: "visitors",
    labelKey: "VisaQuestions.sa_purposes.visitors.label",
    subtitleKey: "VisaQuestions.sa_purposes.visitors.subtitle",
  },
  { value: "medical_treatment", labelKey: "VisaQuestions.sa_purposes.medical_treatment.label" },
  { value: "business", labelKey: "VisaQuestions.sa_purposes.business.label" },
  { value: "general_work", labelKey: "VisaQuestions.sa_purposes.general_work.label" },
  { value: "critical_skills", labelKey: "VisaQuestions.sa_purposes.critical_skills.label" },
  { value: "intra_company", labelKey: "VisaQuestions.sa_purposes.intra_company.label" },
  { value: "corporate", labelKey: "VisaQuestions.sa_purposes.corporate.label" },
  { value: "study", labelKey: "VisaQuestions.sa_purposes.study.label" },
  { value: "exchange", labelKey: "VisaQuestions.sa_purposes.exchange.label" },
  { value: "retired", labelKey: "VisaQuestions.sa_purposes.retired.label" },
  { value: "relatives", labelKey: "VisaQuestions.sa_purposes.relatives.label" },
  { value: "entertainment", labelKey: "VisaQuestions.sa_purposes.entertainment.label" },
  { value: "transit", labelKey: "VisaQuestions.sa_purposes.transit.label" },
] as const;

export type SAPurpose = (typeof SA_VISA_PURPOSES)[number]["value"];

export type NonSaDestination = Exclude<Destination, "south_africa">;

export type NonSaPurpose =
  | "tourism_visa"
  | "training_visa"
  | "eu_visa_free_90_days"
  | "work_visa";

export type PurposeId = SAPurpose | NonSaPurpose;

export type PurposeOption = Option<PurposeId>;

export const NON_SA_VISA_PURPOSES_BY_DESTINATION: Record<
  NonSaDestination,
  readonly PurposeOption[]
> = {
  uk: [
    { value: "tourism_visa", labelKey: "VisaQuestions.non_sa_purposes.tourism_visa.label" },
    { value: "training_visa", labelKey: "VisaQuestions.non_sa_purposes.training_visa.label" },
  ],
  usa: [
    { value: "tourism_visa", labelKey: "VisaQuestions.non_sa_purposes.tourism_visa.label" },
    { value: "training_visa", labelKey: "VisaQuestions.non_sa_purposes.training_visa.label" },
  ],
  canada: [
    { value: "tourism_visa", labelKey: "VisaQuestions.non_sa_purposes.tourism_visa.label" },
    { value: "training_visa", labelKey: "VisaQuestions.non_sa_purposes.training_visa.label" },
  ],
  europe_schengen: [
    { value: "tourism_visa", labelKey: "VisaQuestions.non_sa_purposes.tourism_visa.label" },
    { value: "training_visa", labelKey: "VisaQuestions.non_sa_purposes.training_visa.label" },
  ],
  greece: [
    {
      value: "eu_visa_free_90_days",
      labelKey: "VisaQuestions.non_sa_purposes.eu_visa_free_90_days.label",
    },
  ],
  russia: [{ value: "work_visa", labelKey: "VisaQuestions.non_sa_purposes.work_visa.label" }],
} as const;

// OPTIONAL compatibility export (if any older files still import NON_SA_PURPOSES)
export const NON_SA_PURPOSES = NON_SA_VISA_PURPOSES_BY_DESTINATION;
