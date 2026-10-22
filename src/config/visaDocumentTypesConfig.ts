// src/config/visaDocumentTypesConfig.ts

// NOTE: This is a static, exhaustive mirror of `public.document_types` to avoid
// querying the DB for the document type catalogue at runtime.
// Source: document_types_rows.csv

export type I18nKey = string;

export type VisaDocumentTypeConfig = {
  id: string;
  /** i18n key for the display label (e.g. "Global.documentTypes.passport.label") */
  labelKey: I18nKey;
  /** i18n key for the helper/description copy */
  descriptionKey: I18nKey;
  /** English fallback (optional) */
  fallbackDescription: string;
};

export const VISA_DOCUMENT_TYPES = [
  {
    id: "application_form",
    labelKey: "Global.documentTypes.application_form.label",
    descriptionKey: "Global.documentTypes.application_form.description",
    fallbackDescription: "Completed and signed visa application form in the prescribed format.",
  },
  {
    id: "bbbee_certificate",
    labelKey: "Global.documentTypes.bbbee_certificate.label",
    descriptionKey: "Global.documentTypes.bbbee_certificate.description",
    fallbackDescription:
      "Valid B-BBEE certificate or affidavit reflecting the current empowerment status of the business.",
  },
  {
    id: "birth_certificate",
    labelKey: "Global.documentTypes.birth_certificate.label",
    descriptionKey: "Global.documentTypes.birth_certificate.description",
    fallbackDescription: "Full birth certificate to prove parent–child relationship or for minor applicants.",
  },
  {
    id: "business_plan",
    labelKey: "Global.documentTypes.business_plan.label",
    descriptionKey: "Global.documentTypes.business_plan.description",
    fallbackDescription:
      "Detailed business plan setting out the business model, financial projections and job creation plans.",
  },
  {
    id: "capital_proof",
    labelKey: "Global.documentTypes.capital_proof.label",
    descriptionKey: "Global.documentTypes.capital_proof.description",
    fallbackDescription: "Proof of available capital or funding to establish or support the proposed business activities.",
  },
  {
    id: "company_registration",
    labelKey: "Global.documentTypes.company_registration.label",
    descriptionKey: "Global.documentTypes.company_registration.description",
    fallbackDescription:
      "Company registration documents (CIPC or equivalent) confirming legal incorporation of the business entity.",
  },
  {
    id: "curriculum_vitae",
    labelKey: "Global.documentTypes.curriculum_vitae.label",
    descriptionKey: "Global.documentTypes.curriculum_vitae.description",
    fallbackDescription: "Up-to-date CV / résumé summarising education, skills and work experience.",
  },
  {
    id: "dti_recommendation",
    labelKey: "Global.documentTypes.dti_recommendation.label",
    descriptionKey: "Global.documentTypes.dti_recommendation.description",
    fallbackDescription:
      "Recommendation or support letter from the relevant government department (e.g. DTI/DTIC) for the specific business/investment.",
  },
  {
    id: "employer_undertaking",
    labelKey: "Global.documentTypes.employer_undertaking.label",
    descriptionKey: "Global.documentTypes.employer_undertaking.description",
    fallbackDescription:
      "Employer undertaking letter confirming compliance with visa conditions and labour regulations, and agreeing to reporting duties.",
  },
  {
    id: "employment_contract",
    labelKey: "Global.documentTypes.employment_contract.label",
    descriptionKey: "Global.documentTypes.employment_contract.description",
    fallbackDescription: "Signed employment contract or formal offer of employment from the South African employer.",
  },
  {
    id: "experience_letters",
    labelKey: "Global.documentTypes.experience_letters.label",
    descriptionKey: "Global.documentTypes.experience_letters.description",
    fallbackDescription:
      "Reference or experience letters from previous employers confirming the applicant’s work history and duties.",
  },
  {
    id: "fee_receipt",
    labelKey: "Global.documentTypes.fee_receipt.label",
    descriptionKey: "Global.documentTypes.fee_receipt.description",
    fallbackDescription:
      "Proof of payment of the prescribed visa application fee (bank slip, receipt, or point-of-sale confirmation).",
  },
  {
    id: "labour_certificate",
    labelKey: "Global.documentTypes.labour_certificate.label",
    descriptionKey: "Global.documentTypes.labour_certificate.description",
    fallbackDescription:
      "Certificate, waiver or confirmation from the Department of Labour or relevant authority supporting the application.",
  },
  {
    id: "marriage_certificate",
    labelKey: "Global.documentTypes.marriage_certificate.label",
    descriptionKey: "Global.documentTypes.marriage_certificate.description",
    fallbackDescription: "Marriage certificate to prove spousal relationship where required for accompanying or relative visas.",
  },
  {
    id: "medical_cover",
    labelKey: "Global.documentTypes.medical_cover.label",
    descriptionKey: "Global.documentTypes.medical_cover.description",
    fallbackDescription: "Proof of adequate medical aid or health insurance for the full period of intended stay.",
  },
  {
    id: "medical_report",
    labelKey: "Global.documentTypes.medical_report.label",
    descriptionKey: "Global.documentTypes.medical_report.description",
    fallbackDescription:
      "Recent medical report from a registered practitioner confirming overall good health and absence of listed conditions.",
  },
  {
    id: "motivation_letter",
    labelKey: "Global.documentTypes.motivation_letter.label",
    descriptionKey: "Global.documentTypes.motivation_letter.description",
    fallbackDescription:
      "Motivation letter explaining the purpose of travel, background and reasons for the chosen visa route.",
  },
  {
    id: "other_supporting_documents",
    labelKey: "Global.documentTypes.other_supporting_documents.label",
    descriptionKey: "Global.documentTypes.other_supporting_documents.description",
    fallbackDescription:
      "Any other supporting documents relevant to the specific application that do not fit into the standard categories.",
  },
  {
    id: "passport",
    labelKey: "Global.documentTypes.passport.label",
    descriptionKey: "Global.documentTypes.passport.description",
    fallbackDescription: "Valid passport with sufficient validity and blank pages for visa and entry/exit stamps.",
  },
  {
    id: "passport_photo",
    labelKey: "Global.documentTypes.passport_photo.label",
    descriptionKey: "Global.documentTypes.passport_photo.description",
    fallbackDescription: "Recent passport-sized colour photograph that meets official biometric and visa photo requirements.",
  },
  {
    id: "police_clearance_certificate",
    labelKey: "Global.documentTypes.police_clearance_certificate.label",
    descriptionKey: "Global.documentTypes.police_clearance_certificate.description",
    fallbackDescription:
      "Original police clearance certificate from each relevant country of residence for the prescribed period.",
  },
  {
    id: "program_confirmation",
    labelKey: "Global.documentTypes.program_confirmation.label",
    descriptionKey: "Global.documentTypes.program_confirmation.description",
    fallbackDescription:
      "Official programme acceptance or confirmation letter from the educational institution, employer, or exchange programme.",
  },
  {
    id: "proof_investment",
    labelKey: "Global.documentTypes.proof_investment.label",
    descriptionKey: "Global.documentTypes.proof_investment.description",
    fallbackDescription:
      "Evidence of the required level of investment in a South African business (e.g. bank confirmations, auditor letters).",
  },
  {
    id: "proof_of_funds",
    labelKey: "Global.documentTypes.proof_of_funds.label",
    descriptionKey: "Global.documentTypes.proof_of_funds.description",
    fallbackDescription:
      "Bank statements, payslips, sponsorship letters or other proof of sufficient financial means to support the stay.",
  },
  {
    id: "qualification_certificates",
    labelKey: "Global.documentTypes.qualification_certificates.label",
    descriptionKey: "Global.documentTypes.qualification_certificates.description",
    fallbackDescription: "Copies of educational qualifications, diplomas, degrees and relevant certificates.",
  },
  {
    id: "radiological_report",
    labelKey: "Global.documentTypes.radiological_report.label",
    descriptionKey: "Global.documentTypes.radiological_report.description",
    fallbackDescription:
      "Recent radiological (chest X-ray) report confirming the absence of certain pulmonary diseases, where required.",
  },
  {
    id: "repatriation_guarantee",
    labelKey: "Global.documentTypes.repatriation_guarantee.label",
    descriptionKey: "Global.documentTypes.repatriation_guarantee.description",
    fallbackDescription: "Repatriation guarantee, deposit or financial assurance to cover return travel where required.",
  },
  {
    id: "return_ticket",
    labelKey: "Global.documentTypes.return_ticket.label",
    descriptionKey: "Global.documentTypes.return_ticket.description",
    fallbackDescription: "Confirmed return or onward flight ticket showing intention to depart before visa expiry.",
  },
  {
    id: "saica_letter",
    labelKey: "Global.documentTypes.saica_letter.label",
    descriptionKey: "Global.documentTypes.saica_letter.description",
    fallbackDescription: "Letter or confirmation from SAICA/SAQA or similar professional body, where required for the profession.",
  },
  {
    id: "saqa_evaluation",
    labelKey: "Global.documentTypes.saqa_evaluation.label",
    descriptionKey: "Global.documentTypes.saqa_evaluation.description",
    fallbackDescription: "SAQA evaluation or certificate of recognition of foreign qualifications where required.",
  },
  {
    id: "shareholder_certificates",
    labelKey: "Global.documentTypes.shareholder_certificates.label",
    descriptionKey: "Global.documentTypes.shareholder_certificates.description",
    fallbackDescription: "Shareholder certificates or ownership proof indicating the applicant’s stake in the business, where required.",
  },
  {
    id: "staff_undertaking",
    labelKey: "Global.documentTypes.staff_undertaking.label",
    descriptionKey: "Global.documentTypes.staff_undertaking.description",
    fallbackDescription:
      "Undertaking regarding staffing, recruitment or compliance commitments (e.g. job creation, training, local hiring) where applicable.",
  },
  {
    id: "tax_clearance",
    labelKey: "Global.documentTypes.tax_clearance.label",
    descriptionKey: "Global.documentTypes.tax_clearance.description",
    fallbackDescription:
      "Tax clearance certificate or proof of good standing with SARS for the business or applicant where required.",
  },
  {
    id: "travel_itinerary",
    labelKey: "Global.documentTypes.travel_itinerary.label",
    descriptionKey: "Global.documentTypes.travel_itinerary.description",
    fallbackDescription: "Travel itinerary including dates, accommodation bookings and planned activities where required.",
  },
  {
    id: "waiver_letter",
    labelKey: "Global.documentTypes.waiver_letter.label",
    descriptionKey: "Global.documentTypes.waiver_letter.description",
    fallbackDescription:
      "Waiver letter or confirmation approving an exemption from a required document or condition, issued by the relevant authority.",
  },
  {
    id: "yellow_fever_certificate",
    labelKey: "Global.documentTypes.yellow_fever_certificate.label",
    descriptionKey: "Global.documentTypes.yellow_fever_certificate.description",
    fallbackDescription:
      "Yellow fever vaccination certificate (international certificate) if travelling from or via a yellow fever risk country.",
  },
] as const;

export type VisaDocumentTypeId = (typeof VISA_DOCUMENT_TYPES)[number]["id"];
export type VisaDocumentType = (typeof VISA_DOCUMENT_TYPES)[number];

export const VISA_DOCUMENT_TYPE_BY_ID: Record<VisaDocumentTypeId, VisaDocumentType> = {
  "application_form": VISA_DOCUMENT_TYPES[0],
  "bbbee_certificate": VISA_DOCUMENT_TYPES[1],
  "birth_certificate": VISA_DOCUMENT_TYPES[2],
  "business_plan": VISA_DOCUMENT_TYPES[3],
  "capital_proof": VISA_DOCUMENT_TYPES[4],
  "company_registration": VISA_DOCUMENT_TYPES[5],
  "curriculum_vitae": VISA_DOCUMENT_TYPES[6],
  "dti_recommendation": VISA_DOCUMENT_TYPES[7],
  "employer_undertaking": VISA_DOCUMENT_TYPES[8],
  "employment_contract": VISA_DOCUMENT_TYPES[9],
  "experience_letters": VISA_DOCUMENT_TYPES[10],
  "fee_receipt": VISA_DOCUMENT_TYPES[11],
  "labour_certificate": VISA_DOCUMENT_TYPES[12],
  "marriage_certificate": VISA_DOCUMENT_TYPES[13],
  "medical_cover": VISA_DOCUMENT_TYPES[14],
  "medical_report": VISA_DOCUMENT_TYPES[15],
  "motivation_letter": VISA_DOCUMENT_TYPES[16],
  "other_supporting_documents": VISA_DOCUMENT_TYPES[17],
  "passport": VISA_DOCUMENT_TYPES[18],
  "passport_photo": VISA_DOCUMENT_TYPES[19],
  "police_clearance_certificate": VISA_DOCUMENT_TYPES[20],
  "program_confirmation": VISA_DOCUMENT_TYPES[21],
  "proof_investment": VISA_DOCUMENT_TYPES[22],
  "proof_of_funds": VISA_DOCUMENT_TYPES[23],
  "qualification_certificates": VISA_DOCUMENT_TYPES[24],
  "radiological_report": VISA_DOCUMENT_TYPES[25],
  "repatriation_guarantee": VISA_DOCUMENT_TYPES[26],
  "return_ticket": VISA_DOCUMENT_TYPES[27],
  "saica_letter": VISA_DOCUMENT_TYPES[28],
  "saqa_evaluation": VISA_DOCUMENT_TYPES[29],
  "shareholder_certificates": VISA_DOCUMENT_TYPES[30],
  "staff_undertaking": VISA_DOCUMENT_TYPES[31],
  "tax_clearance": VISA_DOCUMENT_TYPES[32],
  "travel_itinerary": VISA_DOCUMENT_TYPES[33],
  "waiver_letter": VISA_DOCUMENT_TYPES[34],
  "yellow_fever_certificate": VISA_DOCUMENT_TYPES[35],
};

export const VISA_DOCUMENT_TYPE_IDS = VISA_DOCUMENT_TYPES.map((d) => d.id) as VisaDocumentTypeId[];

export function isValidVisaDocumentTypeId(value: unknown): value is VisaDocumentTypeId {
  return typeof value === "string" && (VISA_DOCUMENT_TYPE_BY_ID as Record<string, VisaDocumentType>)[value] !== undefined;
}

export function getVisaDocumentType(id: VisaDocumentTypeId): VisaDocumentType {
  return VISA_DOCUMENT_TYPE_BY_ID[id];
}
