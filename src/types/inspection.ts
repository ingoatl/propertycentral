export interface InspectionField {
  key: string;
  label: string;
  critical?: boolean;
  responsibleParty: 'owner' | 'pm' | 'cleaner';
}

export interface InspectionSection {
  id: string;
  title: string;
  fields: InspectionField[];
}

export interface Inspection {
  id: string;
  property_id: string;
  status: 'draft' | 'in_progress' | 'submitted' | 'completed';
  phase: string;
  inspector_name: string | null;
  inspection_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InspectionResponse {
  id: string;
  inspection_id: string;
  section_id: string;
  field_key: string;
  value_bool: boolean | null;
  value_text: string | null;
  answered_at: string;
}

export interface InspectionIssue {
  id: string;
  property_id: string;
  inspection_id: string | null;
  field_key: string;
  title: string;
  detail: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  responsible_party: 'owner' | 'pm' | 'cleaner';
  status: 'open' | 'in_progress' | 'resolved';
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

export interface InspectionPhoto {
  id: string;
  inspection_id: string;
  issue_id: string | null;
  field_key: string | null;
  photo_url: string;
  caption: string | null;
  uploaded_at: string;
}

// Ultra-minimal inspection checklist (~15 fields)
export const INSPECTION_SECTIONS: InspectionSection[] = [
  {
    id: "safety-security",
    title: "Safety & Security",
    fields: [
      { key: "smoke_carbon_detectors_working", label: "Smoke & CO detectors present and working", critical: true, responsibleParty: "owner" },
      { key: "gas_detector_kitchen", label: "Gas detector present in kitchen (if gas appliances)", critical: true, responsibleParty: "owner" },
      { key: "fire_extinguisher_kitchen", label: "Fire extinguisher present in kitchen", critical: true, responsibleParty: "owner" },
      { key: "first_aid_kit_present", label: "First Aid Kit present", critical: true, responsibleParty: "owner" },
      { key: "water_main_shutoff_accessible", label: "Water main shutoff accessible and labeled", critical: true, responsibleParty: "owner" }
    ]
  },
  {
    id: "access",
    title: "Access",
    fields: [
      { key: "lockbox_smart_lock_functional", label: "Lockbox/smart lock functional", responsibleParty: "pm" },
      { key: "keys_available_tested", label: "Keys available and tested", responsibleParty: "pm" },
      { key: "wifi_qr_code_posted", label: "WiFi QR code posted", responsibleParty: "pm" },
      { key: "emergency_contact_info_posted", label: "Emergency contact info posted", responsibleParty: "pm" }
    ]
  },
  {
    id: "essentials",
    title: "Essentials",
    fields: [
      { key: "hot_water_working", label: "Hot water working", critical: true, responsibleParty: "owner" },
      { key: "lighting_functional", label: "All lighting functional", responsibleParty: "owner" },
      { key: "internet_working", label: "Internet/WiFi working", responsibleParty: "pm" },
      { key: "washer_dryer_functional", label: "Washer/dryer functional", responsibleParty: "owner" }
    ]
  },
  {
    id: "bathrooms",
    title: "Bathrooms",
    fields: [
      { key: "bathroom1_plunger_present", label: "Bathroom 1: Plunger present", responsibleParty: "pm" },
      { key: "bathroom2_plunger_present", label: "Bathroom 2: Plunger present", responsibleParty: "pm" }
    ]
  }
];

export const getTotalFields = () => {
  return INSPECTION_SECTIONS.reduce((acc, section) => acc + section.fields.length, 0);
};

export const getFieldByKey = (key: string): InspectionField | undefined => {
  for (const section of INSPECTION_SECTIONS) {
    const field = section.fields.find(f => f.key === key);
    if (field) return field;
  }
  return undefined;
};

export const getSectionByFieldKey = (key: string): InspectionSection | undefined => {
  return INSPECTION_SECTIONS.find(section => 
    section.fields.some(f => f.key === key)
  );
};
