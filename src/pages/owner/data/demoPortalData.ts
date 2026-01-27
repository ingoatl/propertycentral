// Demo Portal Mock Data - All features working with realistic data
// This file contains mock data for the demo owner portal

export const DEMO_OWNER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
export const DEMO_PROPERTY_ID = "b2c3d4e5-f6a7-8901-bcde-f12345678901";

// Demo property details matching the Rita Way property (5bed/4bath in Smyrna, GA)
export const DEMO_PROPERTY = {
  id: DEMO_PROPERTY_ID,
  name: "3069 Rita Way Retreat",
  address: "3069 Rita Way, Smyrna, GA 30080",
  bedrooms: 5,
  bathrooms: 4,
  sqft: 3200,
  max_guests: 12,
  property_type: "hybrid",
  // Suburban home with warm tones matching the Rita Way aesthetic
  hero_image: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200&h=600&fit=crop",
  thumbnail: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=400&h=300&fit=crop"
};

// ============================================
// MARKETING TAB MOCK DATA
// ============================================

export const demoMarketingStats = [
  {
    id: "demo-stats-1",
    property_id: DEMO_PROPERTY_ID,
    report_month: new Date().toISOString(),
    social_media: {
      instagram_posts: 12,
      instagram_stories: 28,
      facebook_posts: 8,
      gmb_posts: 4,
      tiktok_posts: 6,
      linkedin_posts: 3,
      nextdoor_posts: 2,
      total_reach: 45200,
      total_engagement: 3840,
      engagement_rate: 8.5,
      recent_posts: [
        {
          platform: "tiktok" as const,
          url: "https://www.tiktok.com/@peachhausgroup/video/7599821614674413598",
          has_verified_link: true,
          posted_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          note: "Property tour featuring stunning kitchen renovation"
        },
        {
          platform: "instagram" as const,
          url: "https://instagram.com/p/demo123",
          has_verified_link: true,
          posted_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          note: "Sunset views from the patio"
        },
        {
          platform: "facebook" as const,
          url: "https://facebook.com/post/demo456",
          has_verified_link: true,
          posted_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          note: "5-star guest review highlight"
        },
        {
          platform: "gmb" as const,
          url: "https://g.co/kgs/demo789",
          has_verified_link: true,
          posted_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          note: "Google Business seasonal update"
        }
      ]
    },
    outreach: {
      total_companies_contacted: 47,
      industries_targeted: ["Healthcare", "Technology", "Insurance", "Consulting", "Entertainment"],
      emails_sent: 156,
      calls_made: 23,
      hotsheets_distributed: 12,
      decision_makers_identified: 34
    },
    visibility: {
      marketing_active: true,
      included_in_hotsheets: true
    },
    executive_summary: "Your property has gained significant visibility this month with 45K+ reach across platforms. Corporate outreach efforts have connected with 47 companies in the metro Atlanta area, generating 3 qualified inquiries for mid-term stays.",
    synced_at: new Date().toISOString()
  },
  // Previous month for trend calculations
  {
    id: "demo-stats-2",
    property_id: DEMO_PROPERTY_ID,
    report_month: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    social_media: {
      instagram_posts: 10,
      instagram_stories: 22,
      facebook_posts: 6,
      gmb_posts: 3,
      tiktok_posts: 4,
      total_reach: 38500,
      total_engagement: 3100,
      engagement_rate: 8.1
    },
    outreach: {
      total_companies_contacted: 38,
      emails_sent: 128,
      calls_made: 18,
      hotsheets_distributed: 10,
      decision_makers_identified: 26
    },
    visibility: {
      marketing_active: true,
      included_in_hotsheets: true
    },
    synced_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  }
];

export const demoMarketingActivities = [
  {
    id: "demo-activity-1",
    property_id: DEMO_PROPERTY_ID,
    activity_type: "social_post",
    platform: "tiktok",
    title: "Property Tour Video - 3069 Rita Way",
    description: "Professional walkthrough showcasing the 5-bedroom retreat with stunning kitchen and outdoor entertainment space.",
    metrics: { views: 12500, likes: 890, shares: 156, comments: 67 },
    activity_url: "https://www.tiktok.com/@peachhausgroup/video/7599821614674413598",
    activity_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    synced_at: new Date().toISOString(),
    guest_info: null
  },
  {
    id: "demo-activity-2",
    property_id: DEMO_PROPERTY_ID,
    activity_type: "email_blast",
    platform: "email",
    title: "Pre-Arrival Welcome Email",
    description: "Sent check-in instructions, WiFi details, and personalized local recommendations to upcoming guest.",
    metrics: { delivered: 1, opened: 1 },
    activity_url: null,
    activity_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    synced_at: new Date().toISOString(),
    guest_info: {
      guest_name: "Jennifer Martinez",
      check_in: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      check_out: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000).toISOString(),
      adults: 4,
      children: 2,
      pets: 0
    }
  },
  {
    id: "demo-activity-3",
    property_id: DEMO_PROPERTY_ID,
    activity_type: "social_post",
    platform: "instagram",
    title: "Guest Review Spotlight",
    description: "Featured amazing 5-star review from the Anderson family with their pool day photo.",
    metrics: { likes: 234, comments: 18, saves: 45, reach: 4200 },
    activity_url: "https://instagram.com/p/demo-review",
    activity_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    synced_at: new Date().toISOString(),
    guest_info: null
  },
  {
    id: "demo-activity-4",
    property_id: DEMO_PROPERTY_ID,
    activity_type: "campaign_launched",
    platform: "corporate",
    title: "Healthcare Relocation Campaign",
    description: "Targeted outreach to 15 healthcare companies in the Alpharetta/Roswell corridor for traveling nurses and medical professionals.",
    metrics: { companies: 15, emails_sent: 45, responses: 4 },
    activity_url: null,
    activity_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    synced_at: new Date().toISOString(),
    guest_info: null
  },
  {
    id: "demo-activity-5",
    property_id: DEMO_PROPERTY_ID,
    activity_type: "post_stay_thankyou",
    platform: "email",
    title: "Post-Stay Thank You Email",
    description: "Personalized thank you with review request sent to recent guest, generating a 5-star review.",
    metrics: { delivered: 1, opened: 1, review_received: 1 },
    activity_url: null,
    activity_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    synced_at: new Date().toISOString(),
    guest_info: {
      guest_name: "Robert Chen",
      check_in: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000).toISOString(),
      check_out: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      adults: 2,
      children: 0,
      pets: 1
    }
  },
  {
    id: "demo-activity-6",
    property_id: DEMO_PROPERTY_ID,
    activity_type: "listing_updated",
    platform: "airbnb",
    title: "Listing Photos Updated",
    description: "Refreshed all listing photos with new professional shots highlighting recent kitchen upgrades and seasonal décor.",
    metrics: { views_increase: 28 },
    activity_url: null,
    activity_date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    synced_at: new Date().toISOString(),
    guest_info: null
  }
];

export const demoSocialPosts = [
  {
    id: "demo-social-1",
    property_id: DEMO_PROPERTY_ID,
    platform: "tiktok",
    caption: "Tour this stunning 5-bedroom Roswell retreat! 🏡✨ Perfect for families and groups. #ATLvacation #RoswellGA #VacationRental",
    post_url: "https://www.tiktok.com/@peachhausgroup/video/7599821614674413598",
    media_url: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=400&fit=crop",
    thumbnail_url: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=400&fit=crop",
    status: "published",
    published_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    metrics: { views: 12500, likes: 890, shares: 156, comments: 67 },
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "demo-social-2",
    property_id: DEMO_PROPERTY_ID,
    platform: "instagram",
    caption: "Morning coffee hits different when you have this view ☕🌅 #PeachHausStays #AtlantaVacation",
    post_url: "https://instagram.com/p/demo-morning",
    media_url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&h=400&fit=crop",
    thumbnail_url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&h=400&fit=crop",
    status: "published",
    published_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    metrics: { likes: 234, comments: 18, saves: 45, reach: 4200 },
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "demo-social-3",
    property_id: DEMO_PROPERTY_ID,
    platform: "facebook",
    caption: "We're so grateful for amazing guests like the Martinez family! Their 5-star review made our day 💛 Book your family getaway today!",
    post_url: "https://facebook.com/post/demo-review",
    media_url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=400&fit=crop",
    thumbnail_url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=400&fit=crop",
    status: "published",
    published_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    metrics: { likes: 89, comments: 12, shares: 8, reach: 2100 },
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "demo-social-4",
    property_id: DEMO_PROPERTY_ID,
    platform: "google",
    caption: "Spring is here! Our Roswell property is ready for your next adventure with updated outdoor spaces and blooming gardens.",
    post_url: "https://g.co/kgs/demo-spring",
    media_url: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=400&h=400&fit=crop",
    thumbnail_url: "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=400&h=400&fit=crop",
    status: "published",
    published_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    metrics: { views: 560 },
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// ============================================
// MESSAGES TAB MOCK DATA
// ============================================

export const demoVoicemails = [
  {
    id: "demo-vm-1",
    owner_id: DEMO_OWNER_ID,
    token: "demo-token-1",
    sender_name: "Alex - Property Manager",
    recipient_name: "Sara Thompson",
    message_text: "Hi Sara, just wanted to let you know the HVAC maintenance was completed today. Everything is running great! The technician also replaced the air filter. Let me know if you have any questions.",
    media_type: "audio",
    audio_url: null,
    video_url: null,
    duration_seconds: 42,
    status: "listened",
    direction: "outbound",
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "demo-vm-2",
    owner_id: DEMO_OWNER_ID,
    token: "demo-token-2",
    sender_name: "Property Manager",
    recipient_name: "Sara Thompson",
    message_text: "Good morning! Your January statement is ready and shows $4,280 in net earnings. Great month! The statement is available in your portal.",
    media_type: "video",
    audio_url: null,
    video_url: null,
    duration_seconds: 38,
    status: "listened",
    direction: "outbound",
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  }
];

export const demoCommunications = [
  {
    id: "demo-comm-1",
    direction: "outbound",
    communication_type: "sms",
    body: "Hi Sara! Just wanted to confirm that your guest Jennifer Martinez checks in tomorrow at 4pm. Everything is ready - fresh linens, welcome basket, and the AC is set to 72°. 🏡",
    sent_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    subject: null,
    status: "delivered",
    from_name: "PeachHaus Team"
  },
  {
    id: "demo-comm-2",
    direction: "inbound",
    communication_type: "sms",
    body: "Perfect, thank you! Can you make sure there are extra towels by the pool? The Martinez family has kids.",
    sent_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    subject: null,
    status: "received",
    from_name: "Sara Thompson"
  },
  {
    id: "demo-comm-3",
    direction: "outbound",
    communication_type: "sms",
    body: "Absolutely! I'll have our housekeeper add extra pool towels and some floaties for the kids. All set! 🏊‍♂️",
    sent_at: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString(),
    subject: null,
    status: "delivered",
    from_name: "PeachHaus Team"
  },
  {
    id: "demo-comm-4",
    direction: "outbound",
    communication_type: "email",
    body: "Dear Sara,\n\nI wanted to share some exciting news! Your property has received a 5-star review from the Chen family. Here's what they said:\n\n\"Absolutely perfect stay! The house was immaculate, the kitchen had everything we needed, and the neighborhood was so peaceful. We'll definitely be back!\"\n\nThis brings your overall rating to 4.92 stars. Great work on maintaining such a beautiful property!\n\nBest regards,\nAlex",
    sent_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    subject: "New 5-Star Review for 3069 Rita Way! ⭐",
    status: "delivered",
    from_name: "PeachHaus Team"
  },
  {
    id: "demo-comm-5",
    direction: "inbound",
    communication_type: "email",
    body: "That's wonderful news! So happy to hear the guests enjoyed their stay. Please thank the cleaning team for their great work!",
    sent_at: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString(),
    subject: "Re: New 5-Star Review for 3069 Rita Way! ⭐",
    status: "received",
    from_name: "Sara Thompson"
  },
  {
    id: "demo-comm-6",
    direction: "outbound",
    communication_type: "sms",
    body: "Quick update: Your January statement is ready! Net earnings: $4,280. I've sent a detailed breakdown to your email. Let me know if you have any questions! 📊",
    sent_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    subject: null,
    status: "delivered",
    from_name: "PeachHaus Team"
  }
];

// ============================================
// MAINTENANCE/REPAIRS TAB MOCK DATA
// ============================================

export const demoWorkOrders = [
  {
    id: "demo-wo-1",
    work_order_number: 1042,
    title: "HVAC System Annual Maintenance",
    description: "Annual preventive maintenance on HVAC system including coil cleaning, refrigerant check, and filter replacement.",
    status: "completed",
    urgency: "normal",
    category: "hvac",
    quoted_cost: 185,
    actual_cost: 185,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    completed_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    owner_approved: true,
    vendors: { name: "Comfort Air Solutions" },
    properties: { name: "3069 Rita Way Retreat", address: "3069 Rita Way, Roswell, GA" }
  },
  {
    id: "demo-wo-2",
    work_order_number: 1047,
    title: "Pool Pump Repair",
    description: "Pool pump making unusual noise. Technician will inspect and repair/replace as needed.",
    status: "pending_approval",
    urgency: "normal",
    category: "pool_spa",
    quoted_cost: 450,
    actual_cost: null,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    completed_at: null,
    owner_approved: null,
    vendors: { name: "Blue Wave Pool Service" },
    properties: { name: "3069 Rita Way Retreat", address: "3069 Rita Way, Roswell, GA" }
  },
  {
    id: "demo-wo-3",
    work_order_number: 1044,
    title: "Garbage Disposal Replacement",
    description: "Kitchen garbage disposal failed. Replaced with InSinkErator 1/2 HP model.",
    status: "completed",
    urgency: "urgent",
    category: "plumbing",
    quoted_cost: 225,
    actual_cost: 210,
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    completed_at: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString(),
    owner_approved: true,
    vendors: { name: "Roswell Plumbing Pros" },
    properties: { name: "3069 Rita Way Retreat", address: "3069 Rita Way, Roswell, GA" }
  },
  {
    id: "demo-wo-4",
    work_order_number: 1049,
    title: "Smart Lock Battery Replacement",
    description: "Front door smart lock showing low battery warning. Replace batteries and test functionality.",
    status: "scheduled",
    urgency: "low",
    category: "general",
    quoted_cost: 45,
    actual_cost: null,
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    completed_at: null,
    owner_approved: true,
    vendors: { name: "PeachHaus Maintenance Team" },
    properties: { name: "3069 Rita Way Retreat", address: "3069 Rita Way, Roswell, GA" }
  }
];

export const demoWorkOrderPhotos = {
  "demo-wo-1": [
    {
      id: "demo-photo-1",
      photo_url: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400&h=400&fit=crop",
      photo_type: "before",
      media_type: "image",
      caption: "HVAC unit before maintenance",
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "Comfort Air Tech"
    },
    {
      id: "demo-photo-2",
      photo_url: "https://images.unsplash.com/photo-1631545806609-17b49b14df96?w=400&h=400&fit=crop",
      photo_type: "after",
      media_type: "image",
      caption: "Clean coils and new filter installed",
      created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "Comfort Air Tech"
    }
  ],
  "demo-wo-3": [
    {
      id: "demo-photo-3",
      photo_url: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop",
      photo_type: "before",
      media_type: "image",
      caption: "Failed garbage disposal unit",
      created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "Plumber"
    },
    {
      id: "demo-photo-4",
      photo_url: "https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=400&h=400&fit=crop",
      photo_type: "after",
      media_type: "image",
      caption: "New InSinkErator installed and tested",
      created_at: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString(),
      uploaded_by: "Plumber"
    }
  ]
};

// ============================================
// SCHEDULED MAINTENANCE (PREDICTIVE) MOCK DATA
// ============================================

export const demoScheduledTasks = [
  {
    id: "demo-sched-1",
    scheduled_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    status: "scheduled",
    auto_assigned: true,
    assignment_reason: "Best rated HVAC vendor in your area (4.9 stars)",
    completed_at: null,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    schedule: {
      id: "demo-schedule-1",
      next_due_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      is_enabled: true,
      custom_frequency_months: null,
      preferred_vendor_id: null
    },
    template: {
      id: "demo-template-1",
      name: "HVAC Filter Replacement",
      category: "hvac",
      frequency_months: 3,
      estimated_cost_low: 25,
      estimated_cost_high: 50,
      description: "Replace air filters to maintain air quality and HVAC efficiency. Recommended every 3 months."
    },
    vendor: {
      id: "demo-vendor-1",
      name: "Comfort Air Solutions",
      phone: "770-555-1234"
    },
    property: {
      id: DEMO_PROPERTY_ID,
      name: "3069 Rita Way Retreat",
      address: "3069 Rita Way, Roswell, GA"
    }
  },
  {
    id: "demo-sched-2",
    scheduled_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    status: "scheduled",
    auto_assigned: true,
    assignment_reason: "Property preferred vendor",
    completed_at: null,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    schedule: {
      id: "demo-schedule-2",
      next_due_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      is_enabled: true,
      custom_frequency_months: null,
      preferred_vendor_id: null
    },
    template: {
      id: "demo-template-2",
      name: "Pool Equipment Inspection",
      category: "pool_spa",
      frequency_months: 6,
      estimated_cost_low: 150,
      estimated_cost_high: 250,
      description: "Comprehensive pool equipment inspection including pump, filter, heater, and chemical balance."
    },
    vendor: {
      id: "demo-vendor-2",
      name: "Blue Wave Pool Service",
      phone: "770-555-5678"
    },
    property: {
      id: DEMO_PROPERTY_ID,
      name: "3069 Rita Way Retreat",
      address: "3069 Rita Way, Roswell, GA"
    }
  },
  {
    id: "demo-sched-3",
    scheduled_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    status: "scheduled",
    auto_assigned: true,
    assignment_reason: "Highest rated pest control vendor",
    completed_at: null,
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    schedule: {
      id: "demo-schedule-3",
      next_due_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      is_enabled: true,
      custom_frequency_months: null,
      preferred_vendor_id: null
    },
    template: {
      id: "demo-template-3",
      name: "Quarterly Pest Control",
      category: "pest_control",
      frequency_months: 3,
      estimated_cost_low: 75,
      estimated_cost_high: 125,
      description: "Interior and exterior pest prevention treatment. Essential for Georgia properties."
    },
    vendor: {
      id: "demo-vendor-3",
      name: "Peach State Pest Control",
      phone: "770-555-9012"
    },
    property: {
      id: DEMO_PROPERTY_ID,
      name: "3069 Rita Way Retreat",
      address: "3069 Rita Way, Roswell, GA"
    }
  },
  {
    id: "demo-sched-4",
    scheduled_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: "completed",
    auto_assigned: false,
    assignment_reason: "Owner preferred vendor",
    completed_at: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    schedule: {
      id: "demo-schedule-4",
      next_due_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      is_enabled: true,
      custom_frequency_months: null,
      preferred_vendor_id: null
    },
    template: {
      id: "demo-template-4",
      name: "Gutter Cleaning",
      category: "exterior",
      frequency_months: 6,
      estimated_cost_low: 100,
      estimated_cost_high: 175,
      description: "Clean all gutters and downspouts. Check for damage and ensure proper drainage."
    },
    vendor: {
      id: "demo-vendor-4",
      name: "Clean Gutters ATL",
      phone: "770-555-3456"
    },
    property: {
      id: DEMO_PROPERTY_ID,
      name: "3069 Rita Way Retreat",
      address: "3069 Rita Way, Roswell, GA"
    }
  },
  {
    id: "demo-sched-5",
    scheduled_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: "completed",
    auto_assigned: true,
    assignment_reason: "Best rated HVAC vendor in your area",
    completed_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    schedule: {
      id: "demo-schedule-5",
      next_due_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      is_enabled: true,
      custom_frequency_months: null,
      preferred_vendor_id: null
    },
    template: {
      id: "demo-template-5",
      name: "HVAC System Annual Maintenance",
      category: "hvac",
      frequency_months: 12,
      estimated_cost_low: 150,
      estimated_cost_high: 225,
      description: "Full HVAC system inspection, cleaning, and tune-up. Includes coil cleaning and refrigerant check."
    },
    vendor: {
      id: "demo-vendor-1",
      name: "Comfort Air Solutions",
      phone: "770-555-1234"
    },
    property: {
      id: DEMO_PROPERTY_ID,
      name: "3069 Rita Way Retreat",
      address: "3069 Rita Way, Roswell, GA"
    }
  }
];
