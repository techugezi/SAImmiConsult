// src/config/visaRequirements.ts

export type VisaType = 
  | 'visitor' | 'medical' | 'business' | 'general_work' 
  | 'critical_skills' | 'study' | 'relative' | 'retired' | 'exchange' | 'corporate';

export interface DocumentRequirement {
  id: string;
  labelKey: string; // Key for i18n
  required: boolean;
  acceptedFormats: string[];
}

export const COMMON_DOCUMENTS: DocumentRequirement[] = [
  { id: 'passport', labelKey: 'passport', required: true, acceptedFormats: ['.pdf', '.jpg'] },
  { id: 'passport_photo', labelKey: 'passport_photo', required: true, acceptedFormats: ['.jpg', '.png'] },
  { id: 'application_form', labelKey: 'application_form', required: true, acceptedFormats: ['.pdf'] },
  { id: 'fee_receipt', labelKey: 'fee_receipt', required: true, acceptedFormats: ['.pdf', '.jpg'] },
  { id: 'yellow_fever_certificate', labelKey: 'yellow_fever_certificate', required: false, acceptedFormats: ['.pdf'] },
];

export const VISA_SPECIFIC_DOCS: Record<VisaType, DocumentRequirement[]> = {
  visitor: [
    { id: 'return_ticket', labelKey: 'return_ticket', required: true, acceptedFormats: ['.pdf'] },
    { id: 'proof_of_funds', labelKey: 'proof_of_funds', required: true, acceptedFormats: ['.pdf'] },
    { id: 'travel_itinerary', labelKey: 'travel_itinerary', required: true, acceptedFormats: ['.pdf'] },
  ],
  general_work: [
    { id: 'medical_report', labelKey: 'medical_report', required: true, acceptedFormats: ['.pdf'] },
    { id: 'radiological_report', labelKey: 'radiological_report', required: true, acceptedFormats: ['.pdf'] },
    { id: 'police_clearance_certificate', labelKey: 'police_clearance_certificate', required: true, acceptedFormats: ['.pdf'] },
    { id: 'employment_contract', labelKey: 'employment_contract', required: true, acceptedFormats: ['.pdf'] },
    { id: 'saqa_evaluation', labelKey: 'saqa_evaluation', required: true, acceptedFormats: ['.pdf'] },
    { id: 'employer_undertaking', labelKey: 'employer_undertaking', required: true, acceptedFormats: ['.pdf'] },
  ],
  study: [
    { id: 'medical_report', labelKey: 'medical_report', required: true, acceptedFormats: ['.pdf'] },
    { id: 'radiological_report', labelKey: 'radiological_report', required: true, acceptedFormats: ['.pdf'] },
    { id: 'police_clearance_certificate', labelKey: 'police_clearance_certificate', required: true, acceptedFormats: ['.pdf'] },
    { id: 'program_confirmation', labelKey: 'program_confirmation', required: true, acceptedFormats: ['.pdf'] },
    { id: 'medical_cover', labelKey: 'medical_cover', required: true, acceptedFormats: ['.pdf'] },
  ],
  business: [
    { id: 'medical_report', labelKey: 'medical_report', required: true, acceptedFormats: ['.pdf'] },
    { id: 'radiological_report', labelKey: 'radiological_report', required: true, acceptedFormats: ['.pdf'] },
    { id: 'police_clearance_certificate', labelKey: 'police_clearance_certificate', required: true, acceptedFormats: ['.pdf'] },
    { id: 'proof_investment', labelKey: 'proof_investment', required: true, acceptedFormats: ['.pdf'] },
    { id: 'dti_recommendation', labelKey: 'dti_recommendation', required: true, acceptedFormats: ['.pdf'] },
    { id: 'staff_undertaking', labelKey: 'staff_undertaking', required: true, acceptedFormats: ['.pdf'] },
  ],
  critical_skills: [
    { id: 'medical_report', labelKey: 'medical_report', required: true, acceptedFormats: ['.pdf'] },
    { id: 'radiological_report', labelKey: 'radiological_report', required: true, acceptedFormats: ['.pdf'] },
    { id: 'police_clearance_certificate', labelKey: 'police_clearance_certificate', required: true, acceptedFormats: ['.pdf'] },
    { id: 'employment_contract', labelKey: 'employment_contract', required: true, acceptedFormats: ['.pdf'] },
    { id: 'saqa_evaluation', labelKey: 'saqa_evaluation', required: true, acceptedFormats: ['.pdf'] },
    { id: 'employer_undertaking', labelKey: 'employer_undertaking', required: true, acceptedFormats: ['.pdf'] },
    { id: 'qualification_certificates', labelKey: 'qualification_certificates', required: true, acceptedFormats: ['.pdf'] },
  ],
  medical: [
    { id: 'medical_report', labelKey: 'medical_report', required: true, acceptedFormats: ['.pdf'] },
    { id: 'radiological_report', labelKey: 'radiological_report', required: true, acceptedFormats: ['.pdf'] },
    { id: 'police_clearance_certificate', labelKey: 'police_clearance_certificate', required: true, acceptedFormats: ['.pdf'] },
    { id: 'return_ticket', labelKey: 'return_ticket', required: true, acceptedFormats: ['.pdf'] },
    { id: 'proof_of_funds', labelKey: 'proof_of_funds', required: true, acceptedFormats: ['.pdf'] },
    { id: 'motivation_letter', labelKey: 'motivation_letter', required: true, acceptedFormats: ['.pdf'] },
  ],
  relative: [
    { id: 'medical_report', labelKey: 'medical_report', required: true, acceptedFormats: ['.pdf'] },
    { id: 'radiological_report', labelKey: 'radiological_report', required: true, acceptedFormats: ['.pdf'] },
    { id: 'police_clearance_certificate', labelKey: 'police_clearance_certificate', required: true, acceptedFormats: ['.pdf'] },
    { id: 'return_ticket', labelKey: 'return_ticket', required: false, acceptedFormats: ['.pdf'] },
    { id: 'proof_of_funds', labelKey: 'proof_of_funds', required: true, acceptedFormats: ['.pdf'] },
    { id: 'birth_certificate', labelKey: 'birth_certificate', required: true, acceptedFormats: ['.pdf'] },
  ],
  retired: [
    { id: 'medical_report', labelKey: 'medical_report', required: true, acceptedFormats: ['.pdf'] },
    { id: 'radiological_report', labelKey: 'radiological_report', required: true, acceptedFormats: ['.pdf'] },
    { id: 'police_clearance_certificate', labelKey: 'police_clearance_certificate', required: true, acceptedFormats: ['.pdf'] },
    { id: 'proof_of_funds', labelKey: 'proof_of_funds', required: true, acceptedFormats: ['.pdf'] },
    { id: 'medical_cover', labelKey: 'medical_cover', required: true, acceptedFormats: ['.pdf'] },
  ],
  exchange: [
    { id: 'medical_report', labelKey: 'medical_report', required: true, acceptedFormats: ['.pdf'] },
    { id: 'radiological_report', labelKey: 'radiological_report', required: true, acceptedFormats: ['.pdf'] },
    { id: 'police_clearance_certificate', labelKey: 'police_clearance_certificate', required: true, acceptedFormats: ['.pdf'] },
    { id: 'return_ticket', labelKey: 'return_ticket', required: true, acceptedFormats: ['.pdf'] },
    { id: 'proof_of_funds', labelKey: 'proof_of_funds', required: true, acceptedFormats: ['.pdf'] },
    { id: 'employer_undertaking', labelKey: 'employer_undertaking', required: false, acceptedFormats: ['.pdf'] },
    { id: 'medical_cover', labelKey: 'medical_cover', required: true, acceptedFormats: ['.pdf'] },
    { id: 'program_confirmation', labelKey: 'program_confirmation', required: true, acceptedFormats: ['.pdf'] },
  ],
  corporate: [
    { id: 'medical_report', labelKey: 'medical_report', required: true, acceptedFormats: ['.pdf'] },
    { id: 'radiological_report', labelKey: 'radiological_report', required: true, acceptedFormats: ['.pdf'] },
    { id: 'police_clearance_certificate', labelKey: 'police_clearance_certificate', required: true, acceptedFormats: ['.pdf'] },
    { id: 'employment_contract', labelKey: 'employment_contract', required: true, acceptedFormats: ['.pdf'] },
    { id: 'employer_undertaking', labelKey: 'employer_undertaking', required: true, acceptedFormats: ['.pdf'] },
    { id: 'staff_undertaking', labelKey: 'staff_undertaking', required: true, acceptedFormats: ['.pdf'] },
    { id: 'labour_certificate', labelKey: 'labour_certificate', required: true, acceptedFormats: ['.pdf'] },
  ]
};

export const getRequirementsForVisa = (type: string) => {
  const specific = VISA_SPECIFIC_DOCS[type as VisaType] || [];
  return [...COMMON_DOCUMENTS, ...specific];
};
