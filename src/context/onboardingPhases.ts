import { PhaseDefinition } from "@/types/onboarding";

export const ONBOARDING_PHASES: PhaseDefinition[] = [
  {
    id: 1,
    title: "Owner Intake & Legal",
    description: "Capture all legal documentation, permits, and insurance requirements",
    tasks: [
      { title: "Owner Name", field_type: "text" },
      { title: "Owner Email", field_type: "text" },
      { title: "Owner Phone", field_type: "phone" },
      { title: "STR Permit Number", field_type: "text" },
      { title: "Upload STR License/Permit", field_type: "file" },
      { title: "Signed Management Agreement Link", field_type: "text", description: "Google Drive link to signed agreement (Admin Only)" },
      { title: "ACH Details", field_type: "file", description: "Upload ACH authorization form (Admin Only)" },
      { title: "HOA Information", field_type: "textarea", description: "If applicable" },
      { title: "Insurance Provider & Policy Number", field_type: "textarea", description: "Provider name and policy number" },
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
      { title: "Water Details", field_type: "textarea", description: "Provider and account number" },
      { title: "Electric Details", field_type: "textarea", description: "Provider and account number" },
      { title: "Gas Details", field_type: "textarea", description: "Provider and account number" },
      { title: "Internet Details", field_type: "textarea", description: "Provider and account number" },
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
      { title: "Lawncare", field_type: "checkbox" },
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
      { title: "Upload professional photos", field_type: "textarea", description: "Upload these 5 photos in exact order:\n1. Exterior Arrival Shot\n2. Main Living Area (Hero Room)\n3. Signature/Selling Feature (game room, view, pool, deck, kitchen island, fireplace, or Dining+Living combined)\n4. Primary Bedroom (Master)\n5. Kitchen (Wide Angle)" },
      { title: "Digital guidebook published", field_type: "checkbox" },
      { title: "Link to existing photos", field_type: "text" },
    ]
  },
  {
    id: 7,
    title: "Listings & Booking Platforms",
    description: "Publish property across all relevant booking channels",
    tasks: [
      // Core Mid-Term Rental Marketplaces
      { title: "🏡 Core Mid-Term Rental Marketplaces", field_type: "section_header" },
      { title: "Furnished Finder", field_type: "text", description: "Enter Listing URL" },
      { title: "CHBO (Corporate Housing by Owner)", field_type: "text", description: "Enter Listing URL" },
      { title: "Homads", field_type: "text", description: "Enter Listing URL" },
      { title: "MidTermRentalProperties.com", field_type: "text", description: "Enter Listing URL" },
      { title: "Midtermrentals.com", field_type: "text", description: "Enter Listing URL" },
      { title: "June Homes", field_type: "text", description: "Enter Placeholder" },
      
      // Core Booking Platforms
      { title: "🌐 Core Booking Platforms", field_type: "section_header" },
      { title: "Airbnb", field_type: "text", description: "Alex will set up the listing" },
      { title: "Airbnb – 1-Year Listing", field_type: "text", description: "Alex will set up the listing" },
      { title: "VRBO", field_type: "text", description: "Alex will set up the listing" },
      { title: "Zillow", field_type: "text", description: "Chris please set up" },
      { title: "Booking.com", field_type: "text", description: "Do not create new listings (only manage existing)" },
      
      // Insurance Housing Providers
      { title: "🏢 Insurance Housing Providers", field_type: "section_header" },
      { title: "ALE Solutions", field_type: "text", description: "Enter Placeholder" },
      { title: "Alacrity", field_type: "text", description: "Enter Placeholder" },
      { title: "CRS Temporary Housing", field_type: "text", description: "Enter Placeholder" },
      { title: "Housing Headquarters", field_type: "text", description: "Enter Placeholder" },
      { title: "Sedgwick Temporary Housing", field_type: "text", description: "Enter Placeholder" },
      { title: "Homelink", field_type: "text", description: "https://homelinkhelps.com/" },
      
      // Corporate Housing Providers - Only operational platforms
      { title: "💼 Corporate Housing Providers", field_type: "section_header" },
      { title: "NCH (National Corporate Housing)", field_type: "text", description: "Enter Listing URL" },
      { title: "CRU Homes", field_type: "text", description: "Enter Listing URL" },
      { title: "UCH (United Corporate Housing)", field_type: "text", description: "Enter Listing URL" },
      { title: "Mobile", field_type: "text", description: "Enter Listing URL" },
      
      // Direct Booking
      { title: "Direct Booking Page", field_type: "text", description: "Enter direct booking page URL" },
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
  },
  
  {
    id: 10,
    title: "Property Specifications",
    description: "Physical attributes and characteristics",
    tasks: [
      { title: "Brand Name", field_type: "text", description: "Marketing brand name for the property" },
      { title: "Property Type Detail", field_type: "text", description: "SFH, Townhouse, Townhome, Condo, etc." },
      { title: "Stories", field_type: "text", description: "Number of floors/stories" },
      { title: "Square Footage", field_type: "text" },
      { title: "Bedrooms", field_type: "text" },
      { title: "Bathrooms", field_type: "text" },
      { title: "Parking Type", field_type: "text", description: "Garage, driveway, carport, assigned spots, etc." },
      { title: "Parking Capacity", field_type: "text", description: "Number of vehicles" },
      { title: "Basement", field_type: "radio", options: ["Yes", "No"] },
      { title: "Fenced Yard", field_type: "radio", options: ["Yes", "No", "Partially"] },
      { title: "ADA Compliant", field_type: "radio", options: ["Yes", "No"] },
      { title: "Bedroom on Main", field_type: "radio", options: ["Yes", "No"] },
      { title: "Walk-in Shower", field_type: "radio", options: ["Yes", "No"] },
      { title: "Furnished", field_type: "radio", options: ["Yes", "No"] },
      { title: "Pool", field_type: "text", description: "Pool type (e.g., inflatable hot tub, community pool) or 'No'" }
    ]
  },
  
  {
    id: 11,
    title: "Financial Terms & Pricing",
    description: "Rent, deposits, fees, and financial details",
    tasks: [
      { title: "Monthly Rent", field_type: "currency" },
      { title: "Nightly Rate", field_type: "currency" },
      { title: "Security Deposit", field_type: "currency" },
      { title: "Utility Cap", field_type: "currency" },
      { title: "Cleaning Fee", field_type: "currency", description: "One-time move-out fee" },
      { title: "Admin Fee", field_type: "currency", description: "One-time administrative fee" },
      { title: "Pet Fee", field_type: "currency", description: "One-time pet fee per pet" },
      { title: "Monthly Pet Rent", field_type: "currency", description: "Recurring monthly pet rent" },
      { title: "Monthly Cleaning Fee", field_type: "currency", description: "Recurring monthly cleaning fee" }
    ]
  },
  
  {
    id: 12,
    title: "Pet & Lease Policies",
    description: "Pet rules and lease term requirements",
    tasks: [
      { title: "Pets Allowed", field_type: "radio", options: ["Yes", "No"] },
      { title: "Pet Rules", field_type: "textarea", description: "Max pets, weight limits, breed restrictions" },
      { title: "Maximum Number of Pets", field_type: "text" },
      { title: "Maximum Pet Weight (lbs)", field_type: "text" },
      { title: "Lease Term", field_type: "text", description: "e.g., month to month, 2 months min., 12 months" },
      { title: "Notice to Vacate", field_type: "text", description: "e.g., 30 days, 60 days" }
    ]
  },
  
  {
    id: 13,
    title: "Schools & Neighborhood",
    description: "School district and nearby schools information",
    tasks: [
      { title: "School District", field_type: "text" },
      { title: "Elementary School", field_type: "text" },
      { title: "Middle School", field_type: "text" },
      { title: "High School", field_type: "text" }
    ]
  }
];
