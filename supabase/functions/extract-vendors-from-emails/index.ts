import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VendorInfo {
  name: string;
  company_name: string;
  email: string;
  phone: string | null;
  specialty: string[];
  notes: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting intelligent vendor extraction from emails...');

    // Get ALL email insights - we'll filter intelligently
    const { data: emails, error: emailError } = await supabase
      .from('email_insights')
      .select('sender_email, subject, summary, category, property_id')
      .order('email_date', { ascending: false });

    if (emailError) {
      console.error('Error fetching emails:', emailError);
      throw emailError;
    }

    console.log(`Found ${emails?.length || 0} total emails`);

    // STRICT exclusions - only platforms and internal emails
    const strictExcludedDomains = [
      // Booking platforms
      'airbnb.com', 'airbnb.',
      'vrbo.com', 'vrbo.',
      'booking.com',
      'expedia.com',
      'ownerrez.com',
      'truvi.com',
      
      // E-commerce (not service vendors)
      'amazon.com', 'amazon.', 'amzn.com',
      'walmart.com', 'target.com', 'homedepot.com', 'lowes.com',
      
      // Payment/Financial platforms
      'stripe.com', 'paypal.com', 'venmo.com',
      'speedpay.com', 'relayfi.com',
      
      // Internal
      'peachhausgroup.com', 'peachhg.com',
      
      // Task management (not vendors)
      'breezeway.io',
      
      // Utilities (bill notifications, not service providers)
      'scanaenergy.com', 'gassouth.com',
      'georgiapower.com', 'duke-energy.com',
      'xfinity.com', 'spectrum.com', 'att.com',
      
      // Government
      '.gov',
      
      // Marketing/newsletters
      'mailchimp.com', 'hubspot.com', 'constantcontact.com',
      
      // Real estate platforms (not vendors)
      'zillow.com', 'realtor.com', 'redfin.com',
      
      // Screening services
      'mysmartmove.com', 'noreply.mysmartmove.com',
      
      // Document services
      'dochub.com', 'docusign.com',
      
      // Generic noreply
      'noreply@', 'no-reply@', 'donotreply@'
    ];

    // Keywords that indicate SERVICE vendors (people who do physical work)
    const serviceVendorKeywords = [
      // Work types
      'invoice', 'quote', 'estimate', 'service', 'repair', 'maintenance',
      'install', 'inspection', 'treatment', 'cleaning', 'clean',
      'lawn', 'landscape', 'landscaping', 'mowing',
      'hvac', 'plumbing', 'plumber', 'electrical', 'electrician',
      'pest', 'termite', 'exterminator',
      'pool', 'handyman', 'contractor',
      'work order', 'completed', 'technician',
      'paint', 'painter', 'roof', 'roofer',
      'locksmith', 'appliance', 'flooring',
      'photo', 'shoot', 'photography', 'media',
      // Action words
      'fixed', 'repaired', 'installed', 'replaced', 'addressed',
      'items to address', 'work today', 'today\'s work'
    ];

    // Filter emails to potential vendors
    const potentialVendorEmails = emails?.filter(email => {
      const senderLower = email.sender_email.toLowerCase();
      const subjectLower = (email.subject || '').toLowerCase();
      const summaryLower = (email.summary || '').toLowerCase();
      
      // Exclude strict domains
      if (strictExcludedDomains.some(excluded => senderLower.includes(excluded))) {
        return false;
      }
      
      // Include if it has service vendor keywords in subject or summary
      const hasServiceKeyword = serviceVendorKeywords.some(keyword => 
        subjectLower.includes(keyword) || summaryLower.includes(keyword)
      );
      
      // Include maintenance/expense/order categories regardless
      const isRelevantCategory = ['maintenance', 'expense', 'order'].includes(email.category);
      
      return hasServiceKeyword || isRelevantCategory;
    }) || [];

    console.log(`Filtered to ${potentialVendorEmails.length} potential vendor emails`);

    // Group emails by sender
    const emailsBySender: Record<string, typeof potentialVendorEmails> = {};
    potentialVendorEmails.forEach(email => {
      const key = email.sender_email.toLowerCase();
      if (!emailsBySender[key]) {
        emailsBySender[key] = [];
      }
      emailsBySender[key].push(email);
    });

    const uniqueSenders = Object.keys(emailsBySender);
    console.log(`Found ${uniqueSenders.length} unique potential vendor senders`);
    console.log('Senders:', uniqueSenders.slice(0, 20).join(', '));

    // Get existing vendors to avoid duplicates
    const { data: existingVendors } = await supabase
      .from('vendors')
      .select('email, company_name, name');

    const existingEmails = new Set(existingVendors?.map(v => v.email?.toLowerCase()).filter(Boolean) || []);
    const existingCompanies = new Set(existingVendors?.map(v => v.company_name?.toLowerCase()).filter(Boolean) || []);
    const existingNames = new Set(existingVendors?.map(v => v.name?.toLowerCase()).filter(Boolean) || []);

    console.log(`Existing vendors: ${existingEmails.size}`);

    // Prepare vendor candidates for AI analysis (exclude already existing)
    const vendorCandidates = Object.entries(emailsBySender)
      .filter(([email]) => !existingEmails.has(email.toLowerCase()))
      .slice(0, 40) // Increase limit for better coverage
      .map(([email, emails]) => ({
        email,
        count: emails.length,
        subjects: [...new Set(emails.slice(0, 8).map(e => e.subject))],
        summaries: emails.slice(0, 5).map(e => e.summary),
        categories: [...new Set(emails.map(e => e.category))]
      }));

    if (vendorCandidates.length === 0) {
      console.log('No new vendor candidates found');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No new vendors found',
          vendorsCreated: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Analyzing ${vendorCandidates.length} vendor candidates with AI...`);
    console.log('Candidates:', vendorCandidates.map(c => c.email).join(', '));

    // Use AI to extract vendor information with BETTER prompt
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are a vendor extraction assistant for a property management company. Analyze email communications and identify SERVICE VENDORS - people or companies who perform physical work on properties.

INCLUDE these types of vendors:
- Handymen / General contractors (often use personal gmail addresses like mariodiaz@gmail.com)
- Pest control companies (Terminix, Orkin, local pest services)
- HVAC technicians
- Plumbers and electricians
- Landscaping / lawn care companies (like "Pasto Verde Landscaping LLC")
- Cleaning services
- Pool/spa maintenance
- Photographers / media companies (for property photos)
- Locksmiths
- Painters and roofers
- Appliance repair technicians
- Smart home / security installers (like Jervis Systems)

DO NOT INCLUDE:
- Property owners (even if they email about work - they're owners, not vendors)
- Utility companies (gas, electric, water providers)
- Government agencies
- Real estate agents or brokers
- Payment processors
- Booking platforms
- Internal company emails

For each vendor found, extract:
- name: Contact person's first name if identifiable from email (e.g., "Mario" from mariodiaz@gmail.com), or company name
- company_name: Business name if identifiable, otherwise derive from context or use the person's full name as company
- email: The email address
- phone: Phone number ONLY if explicitly mentioned in the email content (null otherwise - this is fine)
- specialty: Array from ["hvac", "plumbing", "electrical", "appliances", "general_maintenance", "exterior", "cleaning", "pest_control", "locks_security", "pool_spa", "roofing", "flooring", "painting", "landscaping", "photography", "smart_home"]
- notes: Brief description based on email content

Be AGGRESSIVE in identifying vendors - if someone is communicating about work, repairs, services, invoices, or maintenance, they're likely a vendor. Personal gmail addresses are FINE for small contractors/handymen.

Return ONLY a valid JSON array. If no vendors found, return [].`
          },
          {
            role: 'user',
            content: `Analyze these email senders and extract vendor information. Remember - handymen often use personal gmail addresses!\n\n${JSON.stringify(vendorCandidates, null, 2)}`
          }
        ],
        temperature: 0.3,
        max_tokens: 3000
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices[0]?.message?.content || '[]';
    
    console.log('AI response:', content);

    // Parse AI response
    let vendors: VendorInfo[] = [];
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        vendors = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      vendors = [];
    }

    console.log(`AI identified ${vendors.length} vendors`);

    // Insert new vendors - phone is now optional!
    const vendorsToInsert = vendors
      .filter(v => v.email && (v.company_name || v.name))
      .filter(v => !existingEmails.has(v.email.toLowerCase()))
      .filter(v => !existingCompanies.has((v.company_name || '').toLowerCase()))
      .filter(v => !existingNames.has((v.name || '').toLowerCase()))
      .map(v => ({
        name: v.name || v.company_name,
        company_name: v.company_name || v.name,
        email: v.email.toLowerCase(),
        phone: v.phone?.trim() || null, // Phone is now optional
        specialty: v.specialty || ['general_maintenance'],
        service_area: ['Atlanta Metro'],
        notes: v.notes || 'Auto-extracted from email communications',
        status: 'active',
        insurance_verified: false,
        w9_on_file: false,
        emergency_available: false,
        total_jobs_completed: 0,
        average_rating: 0
      }));

    console.log(`Preparing to insert ${vendorsToInsert.length} new vendors`);
    console.log('Vendors to insert:', vendorsToInsert.map(v => `${v.name} (${v.email})`).join(', '));

    if (vendorsToInsert.length > 0) {
      const { data: insertedVendors, error: insertError } = await supabase
        .from('vendors')
        .insert(vendorsToInsert)
        .select();

      if (insertError) {
        console.error('Error inserting vendors:', insertError);
        throw insertError;
      }

      console.log(`Successfully inserted ${insertedVendors?.length || 0} vendors`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Successfully extracted and created ${insertedVendors?.length || 0} vendors`,
          vendorsCreated: insertedVendors?.length || 0,
          vendors: insertedVendors
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'No new unique vendors to add',
        vendorsCreated: 0 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in extract-vendors-from-emails:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
