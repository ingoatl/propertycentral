import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { reconciliation_id, test_email } = await req.json();

    // Reconciliation mode vs test mode
    const isReconciliationMode = !!reconciliation_id;
    const isTestEmail = !!test_email;
    
    if (isReconciliationMode) {
      console.log(`Sending owner statement for reconciliation: ${reconciliation_id}${isTestEmail ? ' (TEST to ' + test_email + ')' : ''}`);
    } else {
      console.log("Starting test monthly statement generation for Smoke Hollow...");
    }
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    let property: any;
    let ownerEmail: string;
    let totalRevenue: number;
    let bookingRevenue: number;
    let midTermRevenue: number;
    let expenseTotal: number;
    let managementFees: number;
    let netIncome: number;
    let visits: any[] = [];
    let expenses: any[] = [];
    let bookings: any[] = [];
    let midTermBookings: any[] = [];
    let expenseDocuments: { [key: string]: string } = {};
    let reportDate: string = "";
    let previousMonthName: string;

    if (isReconciliationMode) {
      // RECONCILIATION MODE: Fetch approved reconciliation data
      const { data: reconciliation, error: recError } = await supabase
        .from("monthly_reconciliations")
        .select(`
          *,
          properties(*),
          property_owners(email, name)
        `)
        .eq("id", reconciliation_id)
        .eq("status", "approved")
        .single();

      if (recError || !reconciliation) {
        throw new Error("Reconciliation not found or not approved");
      }

      property = reconciliation.properties;
      ownerEmail = reconciliation.property_owners?.email;
      
      if (!ownerEmail) {
        throw new Error("Owner email not found");
      }

      // Use reconciliation data instead of live queries
      totalRevenue = Number(reconciliation.total_revenue || 0);
      bookingRevenue = Number(reconciliation.short_term_revenue || 0);
      midTermRevenue = Number(reconciliation.mid_term_revenue || 0);
      expenseTotal = Number(reconciliation.total_expenses || 0);
      managementFees = Number(reconciliation.management_fee || 0);
      const orderMinimumFee = Number(reconciliation.order_minimum_fee || 0);
      netIncome = Number(reconciliation.net_to_owner || 0);

      // Fetch line items for details
      const { data: lineItems, error: itemsError } = await supabase
        .from("reconciliation_line_items")
        .select("*")
        .eq("reconciliation_id", reconciliation_id)
        .eq("verified", true)
        .order("date", { ascending: false });

      if (itemsError) throw itemsError;

      // Map line items back to their original types for email display
      visits = (lineItems || [])
        .filter((item: any) => item.item_type === "visit")
        .map((item: any) => ({
          date: item.date,
          price: item.amount,
        }));

      expenses = (lineItems || [])
        .filter((item: any) => item.item_type === "expense")
        .map((item: any) => ({
          date: item.date,
          amount: Math.abs(item.amount),
          purpose: item.description,
          category: item.category,
        }));

      bookings = (lineItems || [])
        .filter((item: any) => item.item_type === "booking")
        .map((item: any) => ({
          guest_name: item.description,
          check_in: item.date,
          total_amount: item.amount,
        }));

      midTermBookings = (lineItems || [])
        .filter((item: any) => item.item_type === "mid_term_booking")
        .map((item: any) => ({
          tenant_name: item.description,
          monthly_rent: item.amount,
        }));

      previousMonthName = new Date(reconciliation.reconciliation_month).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
      });

    } else {
      // TEST MODE: Use existing logic
      ownerEmail = "test@peachhaus.com"; // Test email

      // Get current and previous month dates
    const now = new Date();
      const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfPreviousMonth = new Date(firstDayOfCurrentMonth.getTime() - 1);
      const firstDayOfPreviousMonth = new Date(lastDayOfPreviousMonth.getFullYear(), lastDayOfPreviousMonth.getMonth(), 1);
      
      previousMonthName = firstDayOfPreviousMonth.toLocaleDateString('en-US', { 
        month: 'long',
        year: 'numeric'
      });

      reportDate = now.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      // Fetch Smoke Hollow property
      const { data: properties, error: propertiesError } = await supabase
        .from("properties")
        .select("*, rental_type")
        .ilike("name", "%smoke%hollow%");

      if (propertiesError) throw propertiesError;
      
      if (!properties || properties.length === 0) {
        throw new Error("Smoke Hollow not found");
      }

      property = properties[0];
      console.log("Found property:", property);

      // Fetch visits and expenses for this property (all time for demo)
      const { data: visitsData, error: visitsError } = await supabase
        .from("visits")
        .select("*")
        .eq("property_id", property.id)
        .order("date", { ascending: false });

      if (visitsError) throw visitsError;
      visits = visitsData || [];

      const { data: expensesData, error: expensesError } = await supabase
        .from("expenses")
        .select("*")
        .eq("property_id", property.id)
        .order("date", { ascending: false });

      if (expensesError) throw expensesError;
      expenses = expensesData || [];

      const { data: bookingsData, error: bookingsError } = await supabase
        .from("ownerrez_bookings")
        .select("*")
        .eq("property_id", property.id);

      if (bookingsError) throw bookingsError;
      bookings = bookingsData || [];

      // Check for active mid-term bookings
      const { data: midTermBookingsData, error: midTermError } = await supabase
        .from("mid_term_bookings")
        .select("*")
        .eq("property_id", property.id)
        .eq("status", "active")
        .gte("end_date", firstDayOfPreviousMonth.toISOString().split('T')[0])
        .lte("start_date", lastDayOfPreviousMonth.toISOString().split('T')[0]);

      if (midTermError) throw midTermError;
      midTermBookings = midTermBookingsData || [];

      console.log(`Found ${visits.length} visits, ${expenses.length} expenses, ${bookings.length} bookings, ${midTermBookings.length} mid-term bookings`);

      // Generate signed URLs for expense documents
      for (const expense of expenses) {
      if (expense.file_path) {
        try {
          const { data, error } = await supabase.storage
            .from('expense-documents')
            .createSignedUrl(expense.file_path, 604800); // 7 days expiry
          
          if (!error && data) {
            expenseDocuments[expense.id] = data.signedUrl;
          }
        } catch (err) {
          console.error(`Error generating signed URL for expense ${expense.id}:`, err);
        }
      }
      }

      // Calculate totals including mid-term revenue
      const visitTotal = visits.reduce((sum, v) => sum + Number(v.price), 0);
      expenseTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
      bookingRevenue = bookings.reduce((sum, b) => sum + Number(b.total_amount), 0);
      managementFees = bookings.reduce((sum, b) => sum + Number(b.management_fee), 0);
      
      // Calculate mid-term revenue for the month
      midTermRevenue = midTermBookings.reduce((sum, b) => sum + Number(b.monthly_rent), 0);
      totalRevenue = bookingRevenue + midTermRevenue;
      
      netIncome = totalRevenue - managementFees - expenseTotal;
    } // End of test mode

    const hasMidTermBooking = midTermBookings.length > 0;

    // Parse location from address
    const addressParts = property.address.split(',').map((p: string) => p.trim());
    const city = addressParts[1] || '';
    const stateZip = addressParts[2] || '';
    const state = stateZip.split(' ')[0] || '';
    
    // Determine metro area based on city/state
    let metroArea = '';
    if (city.toLowerCase().includes('roswell') || city.toLowerCase().includes('atlanta')) {
      metroArea = 'Metro Atlanta';
    } else {
      metroArea = city;
    }
    
    const locationDescription = `${city}, ${state} (${metroArea})`;

    // Generate AI insights
    console.log("Generating AI insights...");
    let aiInsights = "";
    
    try {

      const propertyContext = `
Property: ${property.name}
Location: ${locationDescription}
Type: ${property.rental_type === 'hybrid' ? 'Hybrid (Short-term & Mid-term)' : property.rental_type === 'mid_term' ? 'Mid-term' : 'Long-term'}
Has Active Mid-term Booking: ${hasMidTermBooking ? 'Yes' : 'No'}
Previous Month: ${previousMonthName}
Bookings: ${bookings?.length || 0}
Revenue: $${totalRevenue.toFixed(2)}
Visits: ${visits?.length || 0}
Expenses: $${expenseTotal.toFixed(2)}
      `.trim();

      // Customize prompt based on property type and booking status
      let aiPrompt = "";
      
      if (property.rental_type === 'hybrid' && !hasMidTermBooking) {
        // Hybrid property without mid-term tenant - focus on dual marketing strategy
        aiPrompt = `You are a professional property management expert for PeachHaus Property Management. Analyze this hybrid rental property:

${propertyContext}

Provide a CONCISE professional analysis in HTML format (use <p>, <strong>, <ul>, <li> tags). Keep each section brief and actionable:

**1. Performance Snapshot** (1-2 sentences max)
Quick assessment of current performance.

**2. PeachHaus's Active Marketing Strategy**
List our key initiatives (use bullet points, keep each to 5-7 words):
- Short-term: Premium platform listings, dynamic pricing
- Mid-term: Corporate partnerships, healthcare outreach
- Property maintenance and optimization

**3. Key Local Opportunities** (Maximum 2-3 items)
Only the most significant upcoming events or trends in ${metroArea} that could drive bookings. Keep very brief.

**4. This Month's Action Plan** (3-4 bullet points max, 5-8 words each)
Specific actions we're taking now.

Keep it CONCISE and SCANNABLE. Each section should be 2-4 lines maximum.`;

      } else if (property.rental_type === 'mid_term' || (property.rental_type === 'hybrid' && hasMidTermBooking)) {
        // Mid-term property OR hybrid with active tenant
        aiPrompt = `You are a professional property management expert for PeachHaus Property Management. Analyze this ${hasMidTermBooking ? 'occupied' : ''} mid-term rental:

${propertyContext}

Provide a CONCISE professional analysis in HTML format (use <p>, <strong>, <ul>, <li> tags). Keep each section brief:

**1. Performance Snapshot** (1-2 sentences max)
Quick ${hasMidTermBooking ? 'tenant satisfaction' : 'property status'} overview.

${hasMidTermBooking ? `**2. PeachHaus's Tenant Retention Strategy**
List key initiatives (bullet points, 5-7 words each):
- Weekly tenant check-ins and support
- 24-hour maintenance response guarantee
- Early renewal discussions (60 days out)
- Amenity optimization based on feedback

**3. Renewal Action Plan** (3-4 bullet points max, 5-8 words each)
Specific steps to secure lease extension.` : 
`**2. PeachHaus's Contract Acquisition Strategy**
List key initiatives (bullet points, 5-7 words each):
- Corporate outreach: Fortune 500 relocations
- Insurance partnerships: Displaced homeowner programs
- Healthcare network: Travel nurse placements
- Premium mid-term platform listings

**3. This Month's Action Plan** (3-4 bullet points max, 5-8 words each)
Specific steps to secure qualified tenant.`}

Keep it CONCISE and SCANNABLE. Each section should be 2-4 lines maximum. DO NOT mention local events for mid-term rentals.`;

      } else {
        // Long-term or other
        aiPrompt = `Provide a brief 3-section analysis: Performance, PeachHaus Actions, Recommendations. Use HTML <p>, <strong>, <ul>, <li> tags. Keep very concise - 2-3 sentences per section max.`;
      }

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: aiPrompt
            }
          ],
        }),
      });

      if (aiResponse.ok) {
        const aiData = await aiResponse.json();
        aiInsights = aiData.choices[0].message.content;
        console.log("AI insights generated successfully");
      } else {
        console.error("AI request failed:", await aiResponse.text());
      }
    } catch (error) {
      console.error("Error generating AI insights:", error);
    }

    // Generate professional email with PeachHaus branding
    let emailBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Monthly Owner Statement - ${previousMonthName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
          </style>
        </head>
        <body style="margin: 0; padding: 0; background: #f4f4f4;">
          <div style="max-width: 650px; margin: 0 auto; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            
            <!-- Logo Header -->
            <div style="background-color: #ffffff; padding: 30px 40px; text-align: center; border-bottom: 3px solid #FF8C42;">
              <img src="${supabaseUrl}/storage/v1/object/public/property-images/peachhaus-logo.png" alt="PeachHaus Property Management" style="max-width: 280px; height: auto;" />
            </div>
            
            <!-- Title Section -->
            <div style="background-color: #5a6c7d; padding: 25px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 600; letter-spacing: 0.5px;">Monthly Owner Statement</h1>
              <p style="color: #e8eef3; margin: 8px 0 0 0; font-size: 18px; font-weight: 400;">
                ${property.name}
              </p>
              <p style="color: #c8d4dd; margin: 5px 0 0 0; font-size: 15px;">
                ${previousMonthName}
              </p>
            </div>

            <!-- Legal Notice -->
            <div style="background-color: #fef8e7; border: 2px solid #f39c12; padding: 24px 40px; margin: 0;">
              <h3 style="color: #d68910; margin: 0 0 12px 0; font-size: 17px; font-weight: 700; display: flex; align-items: center;">
                <span style="font-size: 20px; margin-right: 8px;">⚠️</span> Action Required
              </h3>
              <p style="color: #7d6608; margin: 0; font-size: 15px; line-height: 1.7;">
                Please carefully review this financial statement. If you have any questions or discrepancies, 
                you must notify PeachHaus Property Management in writing by 
                <strong style="color: #d68910;">${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 5).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>.
              </p>
              <p style="color: #7d6608; margin: 12px 0 0 0; font-size: 14px; line-height: 1.7;">
                <em>Failure to respond by the deadline will constitute acceptance of this statement as accurate and complete.</em>
              </p>
            </div>
              
              <p style="font-size: 16px; line-height: 1.8; color: #34495e; margin: 0 0 30px 0;">
                We hope this message finds you well! We're excited to share your property's performance for <strong style="color: #8B5CF6;">${previousMonthName}</strong>. 
                Your trust means everything to us, and we're committed to maximizing your investment while keeping you informed every step of the way.
              </p>

              <!-- Property Info Card with Location -->
              <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 16px; padding: 25px; margin-bottom: 35px; border: 1px solid #dee2e6; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <div style="display: flex; align-items: start; gap: 15px;">
                  <div style="background: linear-gradient(135deg, #FF6B9D, #C86DD7); width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 4px 12px rgba(255, 107, 157, 0.3);">
                    <span style="font-size: 24px;">${property.rental_type === 'hybrid' ? '🔄' : property.rental_type === 'mid_term' ? '🏠' : '🏢'}</span>
                  </div>
                  <div style="flex: 1;">
                    <h2 style="margin: 0 0 8px 0; font-size: 22px; color: #2c3e50; font-weight: 600;">
                      ${property.name}
                    </h2>
                    <p style="margin: 0 0 8px 0; color: #6c757d; font-size: 15px; line-height: 1.5;">
                      📍 ${city}, ${state}
                    </p>
                    <p style="margin: 0 0 12px 0; color: #8B5CF6; font-size: 14px; font-weight: 500;">
                      ${metroArea} Area
                    </p>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                      <span style="display: inline-block; background: ${property.rental_type === 'hybrid' ? 'linear-gradient(135deg, #667eea, #764ba2)' : property.rental_type === 'mid_term' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'linear-gradient(135deg, #10b981, #059669)'}; color: white; padding: 6px 14px; border-radius: 12px; font-size: 12px; font-weight: 600; letter-spacing: 0.5px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
                        ${property.rental_type === 'hybrid' ? '🔄 HYBRID RENTAL' : property.rental_type === 'mid_term' ? '🏠 MID-TERM RENTAL' : '🏢 LONG-TERM RENTAL'}
                      </span>
                      ${hasMidTermBooking ? `
                      <span style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 6px 14px; border-radius: 12px; font-size: 12px; font-weight: 600; letter-spacing: 0.5px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
                        ✓ ACTIVE TENANT
                      </span>` : ''}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Financial Summary -->
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 35px; border-radius: 16px; margin-bottom: 35px; box-shadow: 0 10px 30px rgba(102, 126, 234, 0.25);">
                <h2 style="color: white; margin: 0 0 15px 0; font-size: 24px; font-weight: 600; text-align: center;">
                  💰 Financial Summary
                </h2>
                <p style="text-align: center; color: rgba(255,255,255,0.95); margin: 0 0 25px 0; font-size: 15px;">
                  ${property.rental_type === 'hybrid' 
                    ? (hasMidTermBooking 
                      ? 'Your hybrid property generated revenue from both short-term bookings and mid-term rental this month.' 
                      : 'Your hybrid property revenue from short-term bookings. We are actively marketing for mid-term opportunities.')
                    : property.rental_type === 'mid_term'
                    ? 'Your mid-term rental property performance including tenant revenue and maintenance.'
                    : 'Your long-term rental property performance this month.'}
                </p>
                <table style="width: 100%; border-collapse: separate; border-spacing: 0 12px;">
                  ${bookingRevenue > 0 ? `
                  <tr>
                    <td style="background: rgba(255,255,255,0.15); padding: 18px 22px; border-radius: 10px; backdrop-filter: blur(10px);">
                      <p style="margin: 0 0 8px 0; color: rgba(255,255,255,0.9); font-size: 13px; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 500;">Short-term Booking Revenue</p>
                      <p style="margin: 0; color: white; font-size: 32px; font-weight: 700;">$${bookingRevenue.toFixed(2)}</p>
                    </td>
                  </tr>` : ''}
                  ${midTermRevenue > 0 ? `
                  <tr>
                    <td style="background: rgba(255,255,255,0.15); padding: 18px 22px; border-radius: 10px; backdrop-filter: blur(10px);">
                      <p style="margin: 0 0 8px 0; color: rgba(255,255,255,0.9); font-size: 13px; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 500;">Mid-term Rental Revenue</p>
                      <p style="margin: 0; color: white; font-size: 32px; font-weight: 700;">$${midTermRevenue.toFixed(2)}</p>
                    </td>
                  </tr>` : ''}
                  <tr>
                    <td style="background: rgba(255,255,255,0.15); padding: 18px 22px; border-radius: 10px; backdrop-filter: blur(10px);">
                      <p style="margin: 0 0 8px 0; color: rgba(255,255,255,0.9); font-size: 13px; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 500;">Management Fees</p>
                      <p style="margin: 0; color: white; font-size: 32px; font-weight: 700;">${managementFees > 0 ? '$' + managementFees.toFixed(2) : '$0.00'}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background: rgba(255,255,255,0.15); padding: 18px 22px; border-radius: 10px; backdrop-filter: blur(10px);">
                      <p style="margin: 0 0 8px 0; color: rgba(255,255,255,0.9); font-size: 13px; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 500;">Property Expenses</p>
                      <p style="margin: 0; color: white; font-size: 32px; font-weight: 700;">$${expenseTotal.toFixed(2)}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background: linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.15)); padding: 20px 22px; border-radius: 10px; backdrop-filter: blur(10px); border: 2px solid rgba(255,255,255,0.3);">
                      <p style="margin: 0 0 8px 0; color: white; font-size: 14px; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 600;">Your Net Income</p>
                      <p style="margin: 0; color: ${netIncome >= 0 ? '#4ade80' : '#f87171'}; font-size: 38px; font-weight: 800; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">$${netIncome.toFixed(2)}</p>
                    </td>
                  </tr>
                </table>
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.2); text-align: center;">
                  <p style="margin: 0; color: rgba(255,255,255,0.95); font-size: 15px;">
                    <strong>Property Visits:</strong> ${visits?.length || 0} professional check-ins 🏃
                  </p>
                </div>
              </div>`;

    // Add AI Insights Section
    if (aiInsights) {
      emailBody += `
              <!-- Performance Insights Section -->
              <div style="padding: 35px 40px; background-color: #f8fbfd; border-top: 1px solid #e1e8ed;">
                <h2 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center;">
                  <span style="font-size: 24px; margin-right: 10px;">📊</span> Property Performance & Insights
                </h2>
                <div style="color: #4a5568; line-height: 1.9; font-size: 15px; background-color: #ffffff; padding: 24px; border-radius: 6px; border-left: 4px solid #FF8C42;">
                  ${aiInsights}
                </div>
              </div>`;
    }

    // Add Visits Section if there are any
    if (visits && visits.length > 0) {
      const isHybrid = property.rental_type === 'hybrid';
      const isMidTerm = property.rental_type === 'mid_term';
      emailBody += `
              <div style="margin-bottom: 35px;">
                <h3 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 22px; font-weight: 600; display: flex; align-items: center; gap: 10px;">
                  <span style="background: linear-gradient(135deg, #667eea, #764ba2); width: 38px; height: 38px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 18px;">🏃</span>
                  ${isHybrid ? 'Property Visits & Inspections' : isMidTerm ? 'Property Inspections & Visits' : 'Property Visits'}
                </h3>
                <p style="color: #6c757d; margin: 0 0 20px 0; font-size: 15px;">
                  ${isHybrid
                    ? `Our team made ${visits.length} visit${visits.length > 1 ? 's' : ''} to ensure your property is in perfect condition for both short-term guests and potential mid-term tenants.`
                    : isMidTerm 
                    ? `We conducted ${visits.length} professional inspection${visits.length > 1 ? 's' : ''} and visit${visits.length > 1 ? 's' : ''} to maintain your property and ensure tenant satisfaction.`
                    : `Our team made ${visits.length} visit${visits.length > 1 ? 's' : ''} to ensure your property is in perfect condition.`
                  }
                </p>
                <div style="background: #f8f9fa; border-radius: 12px; overflow: hidden; border: 1px solid #e9ecef;">`;
      
      visits.forEach((visit, idx) => {
        const bgColor = idx % 2 === 0 ? '#ffffff' : '#f8f9fa';
        emailBody += `
                  <div style="padding: 18px 22px; background: ${bgColor}; border-bottom: 1px solid #e9ecef; display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                      <p style="margin: 0 0 5px 0; font-size: 15px; color: #2c3e50; font-weight: 500;">
                        📅 ${new Date(visit.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                      </p>
                      ${visit.notes ? `<p style="margin: 0; font-size: 14px; color: #6c757d; font-style: italic;">${visit.notes}</p>` : ''}
                    </div>
                    <div style="text-align: right; margin-left: 20px;">
                      <span style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 8px 16px; border-radius: 20px; font-size: 15px; font-weight: 600; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);">
                        $${Number(visit.price).toFixed(2)}
                      </span>
                    </div>
                  </div>`;
      });
      
      emailBody += `
                </div>
              </div>`;
    }

    // Add Expenses Section if there are any
    if (expenses && expenses.length > 0) {
      emailBody += `
              <div style="margin-bottom: 35px;">
                <h3 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 22px; font-weight: 600; display: flex; align-items: center; gap: 10px;">
                  <span style="background: linear-gradient(135deg, #f59e0b, #d97706); width: 38px; height: 38px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 18px;">💳</span>
                  Property Expenses
                </h3>
                <p style="color: #6c757d; margin: 0 0 20px 0; font-size: 15px;">
                  We've handled ${expenses.length} expense${expenses.length > 1 ? 's' : ''} to keep your property running smoothly. All receipts are attached below.
                </p>
                <div style="background: #f8f9fa; border-radius: 12px; overflow: hidden; border: 1px solid #e9ecef;">`;
      
      expenses.forEach((expense, idx) => {
        const bgColor = idx % 2 === 0 ? '#ffffff' : '#f8f9fa';
        const hasReceipt = expenseDocuments[expense.id];
        
        emailBody += `
                  <div style="padding: 18px 22px; background: ${bgColor}; border-bottom: 1px solid #e9ecef;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: ${hasReceipt ? '12px' : '0'};">
                      <div style="flex: 1;">
                        <p style="margin: 0 0 5px 0; font-size: 15px; color: #2c3e50; font-weight: 500;">
                          📅 ${new Date(expense.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p style="margin: 0; font-size: 14px; color: #6c757d;">
                          ${expense.purpose || 'General maintenance'}
                        </p>
                      </div>
                      <div style="text-align: right; margin-left: 20px;">
                        <span style="color: #dc2626; font-size: 18px; font-weight: 700;">
                          $${Number(expense.amount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    ${hasReceipt ? `
                    <a href="${expenseDocuments[expense.id]}" 
                       style="display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 500; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3); transition: all 0.3s;">
                      📄 View Receipt
                    </a>` : ''}
                  </div>`;
      });
      
      emailBody += `
                </div>
              </div>`;
    }

    // Closing Message & Footer
    emailBody += `
            </div>
            
            <!-- Footer -->
            <div style="background-color: #2c3e50; color: #ffffff; padding: 32px 40px; text-align: center; border-top: 3px solid #FF8C42;">
              <p style="margin: 0; font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">
                PeachHaus Property Management
              </p>
              <p style="margin: 12px 0 0 0; font-size: 14px; color: #bdc3c7;">
                Questions or concerns? Contact us at <a href="mailto:info@peachhausgroup.com" style="color: #FF8C42; text-decoration: none; font-weight: 600;">info@peachhausgroup.com</a>
              </p>
              <p style="margin: 16px 0 0 0; font-size: 12px; color: #95a5a6; line-height: 1.6;">
                This is an official financial statement. Please retain for your records.
              </p>
            </div>
          </div>
        </body>
      </html>`;

    // Determine recipient and subject based on mode
    const recipientEmail = isTestEmail ? test_email : ownerEmail;
    const emailSubject = isTestEmail 
      ? `[TEST] Monthly Owner Statement - ${property.name} - ${previousMonthName}`
      : `Monthly Owner Statement - ${property.name} - ${previousMonthName}`;

    console.log(`Sending email to ${recipientEmail}...`);

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: "PeachHaus Property Management <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: emailSubject,
      html: emailBody,
    });

    console.log("Email sent:", emailResponse);

    if (emailResponse.error) {
      throw emailResponse.error;
    }

    // If in reconciliation mode and NOT a test email, mark expenses as billed and update reconciliation status
    if (isReconciliationMode && !isTestEmail) {
      // Mark all expense line items as exported/billed
      const { data: expenseLineItems } = await supabase
        .from("reconciliation_line_items")
        .select("item_id")
        .eq("reconciliation_id", reconciliation_id)
        .eq("item_type", "expense")
        .eq("verified", true);

      if (expenseLineItems && expenseLineItems.length > 0) {
        const expenseIds = expenseLineItems.map((item: any) => item.item_id);
        await supabase
          .from("expenses")
          .update({ exported: true })
          .in("id", expenseIds);
        
        console.log(`Marked ${expenseIds.length} expenses as billed`);
      }

      // Calculate next month's 5th for deadline
      const recMonth = new Date(reportDate);
      const nextMonth = new Date(recMonth.getFullYear(), recMonth.getMonth() + 2, 5);

      // Update reconciliation status to "statement_sent"
      await supabase
        .from("monthly_reconciliations")
        .update({
          status: "statement_sent",
          statement_sent_at: new Date().toISOString(),
          owner_response_deadline: nextMonth.toISOString().split("T")[0],
        })
        .eq("id", reconciliation_id);

      console.log("Statement sent successfully to owner in reconciliation mode");
    } else if (isTestEmail) {
      console.log(`Test email sent successfully to ${test_email}`);
    } else {
      console.log("Test email sent successfully!");
    }

    // Success log
    if (isTestEmail) {
      console.log(`Test email sent successfully to ${test_email}`);
    } else {
      console.log(`Email sent successfully to ${ownerEmail}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: isTestEmail ? `Test email sent to ${test_email}` : `Email sent to ${ownerEmail}`,
        emailId: emailResponse.data?.id,
        property: property.name,
        stats: {
          visits: visits?.length || 0,
          expenses: expenses?.length || 0,
          bookingRevenue: bookingRevenue,
          midTermRevenue: midTermRevenue,
          totalRevenue: totalRevenue,
          netIncome: netIncome,
          hasMidTermBooking: hasMidTermBooking
        }
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error generating/sending test email:", error);
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
