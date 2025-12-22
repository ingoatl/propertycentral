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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting vendor extraction from emails...');

    // Get all email insights that might contain vendor info
    const { data: emails, error: emailError } = await supabase
      .from('email_insights')
      .select('sender_email, subject, summary, category, property_id')
      .in('category', ['maintenance', 'expense', 'utilities', 'order', 'payment'])
      .order('email_date', { ascending: false });

    if (emailError) {
      console.error('Error fetching emails:', emailError);
      throw emailError;
    }

    console.log(`Found ${emails?.length || 0} relevant emails`);

    // Filter out internal and known platform emails
    const excludedDomains = [
      'amazon.com', 'amazon.', 'amzn.com',
      'airbnb.com', 'airbnb.',
      'vrbo.com', 'vrbo.',
      'ownerrez.com',
      'peachhausgroup.com', 'peachhg.com',
      'booking.com',
      'expedia.com',
      'stripe.com',
      'breezeway.io', // Task management, not vendor
      'zillow.com',
      'truvi.com',
      'dochub.com',
      'speedpay.com', // Payment processor
      'relayfi.com', // Payment platform
      'cobbcounty.gov', // Government
      'kennesaw-ga.gov', // Government
      'gmail.com' // Personal emails need special handling
    ];

    const potentialVendorEmails = emails?.filter(email => {
      const domain = email.sender_email.toLowerCase();
      return !excludedDomains.some(excluded => domain.includes(excluded));
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

    console.log(`Found ${Object.keys(emailsBySender).length} unique sender domains`);

    // Get existing vendors to avoid duplicates
    const { data: existingVendors } = await supabase
      .from('vendors')
      .select('email, company_name');

    const existingEmails = new Set(existingVendors?.map(v => v.email?.toLowerCase()) || []);
    const existingCompanies = new Set(existingVendors?.map(v => v.company_name?.toLowerCase()) || []);

    console.log(`Existing vendors: ${existingEmails.size}`);

    // Prepare email context for AI analysis
    const vendorCandidates = Object.entries(emailsBySender)
      .filter(([email]) => !existingEmails.has(email.toLowerCase()))
      .slice(0, 30) // Limit to avoid token limits
      .map(([email, emails]) => ({
        email,
        count: emails.length,
        subjects: emails.slice(0, 5).map(e => e.subject),
        summaries: emails.slice(0, 3).map(e => e.summary),
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

    // Use AI to extract vendor information
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a data extraction assistant. Analyze email sender information and identify legitimate business vendors/service providers for a property management company.

Extract vendor information and return a JSON array of vendor objects. Only include actual business vendors, NOT:
- Personal email addresses (unless clearly a business contact)
- Internal company emails
- Automated notification systems
- Government agencies
- Payment processors

For each vendor, extract:
- name: Contact person name if available, otherwise company name
- company_name: Business/company name
- email: Email address
- phone: Phone number if mentioned (null if not found)
- specialty: Array of service categories like ["pest_control"], ["hvac"], ["plumbing"], ["electrical"], ["cleaning"], ["landscaping"], ["smart_home"], ["utilities"], ["general_maintenance"]
- notes: Brief description of services based on email content

Return ONLY valid JSON array. If no vendors found, return empty array [].`
          },
          {
            role: 'user',
            content: `Analyze these email senders and extract vendor information:\n\n${JSON.stringify(vendorCandidates, null, 2)}`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
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
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        vendors = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      vendors = [];
    }

    console.log(`AI identified ${vendors.length} vendors`);

    // Insert new vendors - filter out those without phone numbers (required field)
    const vendorsToInsert = vendors
      .filter(v => v.email && v.company_name)
      .filter(v => v.phone && v.phone.trim() !== '') // Phone is required
      .filter(v => !existingEmails.has(v.email.toLowerCase()))
      .filter(v => !existingCompanies.has(v.company_name.toLowerCase()))
      .map(v => ({
        name: v.name || v.company_name,
        company_name: v.company_name,
        email: v.email.toLowerCase(),
        phone: v.phone!.trim(),
        specialty: v.specialty || [],
        service_area: ['Atlanta Metro'],
        notes: v.notes || 'Auto-extracted from email communications',
        status: 'active',
        insurance_verified: false,
        w9_on_file: false,
        emergency_available: false,
        total_jobs_completed: 0,
        average_rating: 0
      }));

    // Log skipped vendors for debugging
    const skippedNoPhone = vendors.filter(v => !v.phone || v.phone.trim() === '');
    if (skippedNoPhone.length > 0) {
      console.log(`Skipped ${skippedNoPhone.length} vendors without phone numbers:`, 
        skippedNoPhone.map(v => v.company_name || v.name).join(', '));
    }

    console.log(`Inserting ${vendorsToInsert.length} new vendors`);

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
