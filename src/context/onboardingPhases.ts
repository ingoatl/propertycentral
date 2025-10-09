import { PhaseDefinition } from "@/types/onboarding";

export const ONBOARDING_PHASES: PhaseDefinition[] = [
  {
    id: 1,
    title: "Owner Intake & Legal",
    description: "Capture all legal documentation, permits, and insurance requirements",
    tasks: [
      { title: "Owner Onboarding Form Completed", field_type: "checkbox" },
      { title: "Owner Name", field_type: "text" },
      { title: "Owner Email", field_type: "text" },
      { title: "Owner Phone", field_type: "phone" },
      { title: "STR Permit Number", field_type: "text" },
      { title: "Upload STR License/Permit", field_type: "file" },
      { title: "Upload Signed Management Agreement", field_type: "file" },
      { title: "HOA Information", field_type: "textarea", description: "If applicable" },
      { title: "Insurance Provider", field_type: "text" },
      { title: "Insurance Policy Number", field_type: "text" },
      { title: "Upload Insurance Policy", field_type: "file" },
      { title: "PeachHaus Listed as Additional Insured", field_type: "radio", options: ["Yes", "No"] },
    ]
  },
  {
    id: 2,
    title: "Property Details & Access",
    description: "Collect all access codes, credentials, and entry information",
    tasks: [
      { title: "WiFi Details", field_type: "text", description: "Network name and password" },
      { title: "Smart lock brand", field_type: "text" },
      { title: "Smart lock master PIN code", field_type: "text" },
      { title: "Emergency guest PIN", field_type: "text" },
      { title: "Lockbox Code for Emergencies", field_type: "text" },
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
      { title: "Water Provider", field_type: "text" },
      { title: "Water Account Number", field_type: "text" },
      { title: "Electric Provider", field_type: "text" },
      { title: "Electric Account Number", field_type: "text" },
      { title: "Gas Provider", field_type: "text" },
      { title: "Gas Account Number", field_type: "text" },
      { title: "Internet Provider", field_type: "text" },
      { title: "Internet Account Number", field_type: "text" },
      { title: "Trash Service Provider", field_type: "text" },
      { title: "HOA Contact Information", field_type: "textarea" },
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
      // Mid-term Marketplaces Section
      { title: "📋 MID-TERM MARKETPLACES", field_type: "text", description: "Category header - no action needed" },
      { title: "Furnished Finder", field_type: "text", description: "Enter Listing URL" },
      { title: "CHBO (Corporate Housing by Owner)", field_type: "text", description: "Enter Listing URL" },
      { title: "Homads", field_type: "text", description: "Enter Listing URL" },
      { title: "MidTermRentalProperties.com", field_type: "text", description: "Enter Listing URL" },
      { title: "Anyplace", field_type: "text", description: "Enter Placeholder" },
      { title: "June Homes", field_type: "text", description: "Enter Placeholder" },
      { title: "Kopa", field_type: "text", description: "Enter Placeholder" },
      
      // Core Booking Platforms Section
      { title: "📋 CORE BOOKING PLATFORMS", field_type: "text", description: "Category header - no action needed" },
      { title: "Airbnb", field_type: "text", description: "Alex will setup the listing - Enter Listing URL" },
      { title: "Airbnb - 1 year Listing", field_type: "text", description: "Alex will setup the listing - Enter Listing URL" },
      { title: "VRBO", field_type: "text", description: "Alex will setup the listing - Enter Listing URL" },
      { title: "Zillow", field_type: "text", description: "Chris Please setup - Enter Listing URL" },
      { title: "Booking", field_type: "text", description: "Do not create new Listings (only existing Listing) - Enter Listing URL" },
      
      // Insurance Housing Providers Section
      { title: "📋 INSURANCE HOUSING PROVIDERS", field_type: "text", description: "Category header - no action needed" },
      { title: "ALE Solutions", field_type: "text", description: "Enter Placeholder" },
      { title: "Alacrity", field_type: "text", description: "Enter Placeholder" },
      { title: "CRS Temporary Housing", field_type: "text", description: "Enter Placeholder" },
      { title: "Assured Relocation", field_type: "text", description: "Enter Placeholder" },
      { title: "THD (Temporary Housing Directory)", field_type: "text", description: "Enter Placeholder" },
      { title: "Housing Headquarters", field_type: "text", description: "Enter Placeholder" },
      { title: "Sedgwick Temporary Housing", field_type: "text", description: "Enter Placeholder" },
      { title: "Homelink", field_type: "text", description: "Their website is https://homelinkhelps.com/ - Enter Placeholder" },
      
      // Corporate Housing Providers Section
      { title: "📋 CORPORATE HOUSING PROVIDERS", field_type: "text", description: "Category header - no action needed" },
      { title: "Blueground", field_type: "text", description: "Enter Listing URL" },
      { title: "Landing", field_type: "text", description: "Enter Listing URL" },
      { title: "2nd Address", field_type: "text", description: "Enter Listing URL" },
      { title: "Aleph Living", field_type: "text", description: "Enter Listing URL" },
      { title: "Zeus Living", field_type: "text", description: "Enter Placeholder" },
      { title: "Travel Nurse Housing", field_type: "text", description: "Enter Placeholder" },
      
      // General Fields
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
      { title: "Emergency Contact Name", field_type: "text" },
      { title: "Emergency Contact Phone", field_type: "phone" },
      { title: "Backup Key Location", field_type: "text" },
      { title: "Security System Present", field_type: "radio", options: ["Yes", "No"] },
      { title: "Security System Brand", field_type: "text" },
      { title: "Security Alarm Code", field_type: "text" },
      { title: "Cameras Present", field_type: "radio", options: ["Yes", "No"] },
      { title: "Camera Locations", field_type: "textarea" },
      { title: "Camera System Login URL", field_type: "text" },
      { title: "Camera Login Credentials", field_type: "text" },
      { title: "Fire Extinguisher Locations", field_type: "textarea" },
      { title: "First Aid Kit Location", field_type: "text" },
      { title: "Water Main Shutoff Location", field_type: "text" },
    ]
  }
];
