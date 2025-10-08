import { PhaseDefinition } from "@/types/onboarding";

export const ONBOARDING_PHASES: PhaseDefinition[] = [
  {
    id: 1,
    title: "Owner Intake & Legal",
    description: "Capture all legal documentation, permits, and insurance requirements",
    tasks: [
      { title: "Create new property in onboarding pipeline", field_type: "checkbox" },
      { title: "STR permit number", field_type: "text" },
      { title: "STR permit expiration date", field_type: "date" },
      { title: "Upload STR license/permit documents", field_type: "file" },
      { title: "Upload signed management agreement", field_type: "file" },
      { title: "Owner onboarding form completed", field_type: "checkbox" },
      { title: "HOA information (if applicable)", field_type: "textarea" },
      { title: "Insurance provider name", field_type: "text" },
      { title: "Upload insurance policy documentation", field_type: "file" },
      { title: "Verify PeachHaus listed as additional insured", field_type: "checkbox" },
    ]
  },
  {
    id: 2,
    title: "Property Details & Access",
    description: "Collect all access codes, credentials, and entry information",
    tasks: [
      { title: "WiFi network name (SSID)", field_type: "text" },
      { title: "WiFi password", field_type: "text" },
      { title: "Smart lock brand", field_type: "text" },
      { title: "Smart lock master code", field_type: "text" },
      { title: "Emergency guest PIN", field_type: "text" },
      { title: "Lockbox code", field_type: "text" },
      { title: "Backup key location", field_type: "text" },
      { title: "Maid's closet code", field_type: "text" },
      { title: "Gate code", field_type: "text" },
      { title: "Garage code", field_type: "text" },
      { title: "Additional property access details", field_type: "textarea" },
    ]
  },
  {
    id: 3,
    title: "Utilities & Services",
    description: "Document all utility accounts and service provider information",
    tasks: [
      { title: "Upload HVAC serial number documentation", field_type: "file" },
      { title: "Upload appliance serial numbers", field_type: "file" },
      { title: "Water provider name", field_type: "text" },
      { title: "Water account number", field_type: "text" },
      { title: "Electric provider name", field_type: "text" },
      { title: "Electric account number", field_type: "text" },
      { title: "Gas provider name", field_type: "text" },
      { title: "Gas account number", field_type: "text" },
      { title: "Internet provider name", field_type: "text" },
      { title: "Internet account number", field_type: "text" },
      { title: "Trash service provider", field_type: "text" },
      { title: "Additional utility details", field_type: "textarea" },
    ]
  },
  {
    id: 4,
    title: "Cleaners & Maintenance",
    description: "Establish cleaning protocols and service provider relationships",
    tasks: [
      { title: "Negotiated price per cleaning", field_type: "currency" },
      { title: "Upload cleaning checklist", field_type: "file" },
      { title: "Assigned cleaner confirmed", field_type: "checkbox" },
      { title: "Primary cleaner name", field_type: "text" },
      { title: "Primary cleaner phone number", field_type: "phone" },
      { title: "Backup cleaner name", field_type: "text" },
      { title: "Backup cleaner phone number", field_type: "phone" },
      { title: "Owner satisfaction with existing cleaner", field_type: "radio", options: ["Yes", "No", "N/A"] },
      { title: "Cleaner payment arrangement", field_type: "textarea" },
    ]
  },
  {
    id: 5,
    title: "PMS & Tools Setup",
    description: "Configure property management software and operational tools",
    tasks: [
      { title: "Property setup in OwnerRez", field_type: "checkbox" },
      { title: "OwnerRez property ID", field_type: "text" },
      { title: "PriceLabs activated for dynamic pricing", field_type: "checkbox" },
      { title: "Truvi listing added", field_type: "checkbox" },
      { title: "Truvi package selected", field_type: "text" },
      { title: "Breezeway setup completed", field_type: "checkbox" },
      { title: "Property entered in owner portal", field_type: "checkbox" },
      { title: "Upload internet speed test results", field_type: "file" },
    ]
  },
  {
    id: 6,
    title: "Pictures & Assets",
    description: "Gather visual assets and create marketing materials",
    tasks: [
      { title: "Virtual walkthrough created/uploaded", field_type: "file" },
      { title: "Direct booking page created", field_type: "checkbox" },
      { title: "Professional photos scheduled", field_type: "date" },
      { title: "Upload professional photos", field_type: "file" },
      { title: "Digital guidebook published", field_type: "checkbox" },
      { title: "Final review completed", field_type: "checkbox" },
      { title: "Link to existing photos", field_type: "text" },
    ]
  },
  {
    id: 7,
    title: "Listings & Booking Platforms",
    description: "Publish property across all relevant booking channels",
    tasks: [
      { title: "Mid-term marketplace listings created", field_type: "checkbox" },
      { title: "Airbnb listing published", field_type: "checkbox" },
      { title: "VRBO listing published", field_type: "checkbox" },
      { title: "Insurance housing provider platforms", field_type: "multiselect", options: ["Furnished Finder", "Corporate Housing by Owner", "Other"] },
      { title: "Corporate housing provider platforms", field_type: "textarea" },
      { title: "Direct booking website setup", field_type: "checkbox" },
      { title: "Upload platform listing screenshots", field_type: "file" },
    ]
  },
  {
    id: 8,
    title: "Marketing and Guest Experience",
    description: "Define target audience and establish guest communication strategies",
    tasks: [
      { title: "Primary guest avatar/target demographic", field_type: "textarea" },
      { title: "Unique selling points of property", field_type: "textarea" },
      { title: "Pet policy", field_type: "radio", options: ["Allowed", "Not Allowed"] },
      { title: "Pet size restrictions", field_type: "text" },
      { title: "Additional pet policy details", field_type: "textarea" },
      { title: "Insurance contact for guest inquiries", field_type: "text" },
    ]
  },
  {
    id: 9,
    title: "Emergency & Safety Setup",
    description: "Ensure safety protocols and emergency preparedness",
    tasks: [
      { title: "Backup lockbox installed", field_type: "checkbox" },
      { title: "Upload PeachHaus inspection report", field_type: "file" },
      { title: "Emergency contact name", field_type: "text" },
      { title: "Emergency contact phone", field_type: "phone" },
      { title: "Security system present", field_type: "radio", options: ["Yes", "No"] },
      { title: "Security system brand", field_type: "text" },
      { title: "Security alarm code", field_type: "text" },
      { title: "Cameras present", field_type: "radio", options: ["Yes", "No"] },
      { title: "Camera locations", field_type: "textarea" },
      { title: "Camera login website", field_type: "text" },
      { title: "Camera login credentials", field_type: "text" },
      { title: "Fire extinguisher locations", field_type: "textarea" },
      { title: "Additional safety equipment details", field_type: "textarea" },
    ]
  }
];
