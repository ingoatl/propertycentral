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
      console.log("Starting test performance email generation for Villa 14...");
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
    let orderMinimumFee: number = 0;
    let visitCount: number = 0;
    let expenseCount: number = 0;

    if (isReconciliationMode) {
      // RECONCILIATION MODE: Fetch approved reconciliation data
      const { data: reconciliation, error: recError } = await supabase
        .from("monthly_reconciliations")
        .select(`
          *,
          properties(*),
          property_owners(email, name, second_owner_name, second_owner_email)
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
      orderMinimumFee = Number(reconciliation.order_minimum_fee || 0);
      
      // Fetch line items to calculate visit total
      const { data: lineItemsForCalc, error: itemsCalcError } = await supabase
        .from("reconciliation_line_items")
        .select("*")
        .eq("reconciliation_id", reconciliation_id)
        .eq("verified", true)
        .eq("item_type", "visit");

      if (itemsCalcError) throw itemsCalcError;
      
      const visitTotal = (lineItemsForCalc || []).reduce((sum: number, item: any) => sum + Math.abs(item.amount), 0);
      visitCount = lineItemsForCalc?.length || 0;
      
      // CORRECT CALCULATION: Include visits as expenses
      netIncome = totalRevenue - managementFees - orderMinimumFee - expenseTotal - visitTotal;
      
      console.log("Reconciliation mode net calculation:", {
        totalRevenue,
        managementFees,
        orderMinimumFee,
        expenseTotal,
        visitTotal,
        netIncome
      });

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
          description: item.description,
          price: Math.abs(item.amount),
        }));

      expenses = (lineItems || [])
        .filter((item: any) => item.item_type === "expense")
        .map((item: any) => ({
          date: item.date,
          amount: Math.abs(item.amount),
          purpose: item.description,
          category: item.category,
          vendor: item.description.includes(' - ') ? item.description.split(' - ')[1] : null,
        }));
      
      expenseCount = expenses.length;

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
      ownerEmail = "info@peachhausgroup.com"; // Test email

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

      // Fetch Villa 14 property for test
      const { data: properties, error: propertiesError } = await supabase
        .from("properties")
        .select("*, rental_type")
        .ilike("name", "%villa%14%");

      if (propertiesError) throw propertiesError;
      
      if (!properties || properties.length === 0) {
        throw new Error("Villa 14 not found");
      }

      property = properties[0];
      console.log("Found property:", property.name, property.id);

      // Fetch visits for THIS property ONLY in the previous month
      const { data: visitsData, error: visitsError } = await supabase
        .from("visits")
        .select("*")
        .eq("property_id", property.id)
        .gte("date", firstDayOfPreviousMonth.toISOString().split('T')[0])
        .lte("date", lastDayOfPreviousMonth.toISOString().split('T')[0])
        .order("date", { ascending: false });

      if (visitsError) {
        console.error("Error fetching visits:", visitsError);
        throw visitsError;
      }
      visits = visitsData || [];
      console.log(`Found ${visits.length} visits for ${property.name} in ${previousMonthName}`);

      // Fetch expenses for THIS property ONLY in the previous month
      const { data: expensesData, error: expensesError } = await supabase
        .from("expenses")
        .select("*")
        .eq("property_id", property.id)
        .gte("date", firstDayOfPreviousMonth.toISOString().split('T')[0])
        .lte("date", lastDayOfPreviousMonth.toISOString().split('T')[0])
        .order("date", { ascending: false });

      if (expensesError) {
        console.error("Error fetching expenses:", expensesError);
        throw expensesError;
      }
      expenses = expensesData || [];
      console.log(`Found ${expenses.length} expenses for ${property.name} in ${previousMonthName}`);

      // Fetch bookings for THIS property ONLY in the previous month
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("ownerrez_bookings")
        .select("*")
        .eq("property_id", property.id)
        .gte("check_in", firstDayOfPreviousMonth.toISOString().split('T')[0])
        .lte("check_in", lastDayOfPreviousMonth.toISOString().split('T')[0]);

      if (bookingsError) {
        console.error("Error fetching bookings:", bookingsError);
        throw bookingsError;
      }
      bookings = bookingsData || [];
      console.log(`Found ${bookings.length} bookings for ${property.name} in ${previousMonthName}`);

      // Check for active mid-term bookings for THIS property in the previous month
      const { data: midTermBookingsData, error: midTermError } = await supabase
        .from("mid_term_bookings")
        .select("*")
        .eq("property_id", property.id)
        .eq("status", "active")
        .gte("end_date", firstDayOfPreviousMonth.toISOString().split('T')[0])
        .lte("start_date", lastDayOfPreviousMonth.toISOString().split('T')[0]);

      if (midTermError) {
        console.error("Error fetching mid-term bookings:", midTermError);
        throw midTermError;
      }
      midTermBookings = midTermBookingsData || [];
      console.log(`Found ${midTermBookings.length} mid-term bookings for ${property.name} in ${previousMonthName}`);

      // Verify all data belongs to the correct property
      const invalidVisits = visits.filter(v => v.property_id !== property.id);
      const invalidExpenses = expenses.filter(e => e.property_id !== property.id);
      const invalidBookings = bookings.filter(b => b.property_id !== property.id);
      const invalidMidTerm = midTermBookings.filter(m => m.property_id !== property.id);
      
      if (invalidVisits.length > 0 || invalidExpenses.length > 0 || invalidBookings.length > 0 || invalidMidTerm.length > 0) {
        console.error("CRITICAL ERROR: Data from other properties detected!", {
          invalidVisits: invalidVisits.length,
          invalidExpenses: invalidExpenses.length,
          invalidBookings: invalidBookings.length,
          invalidMidTerm: invalidMidTerm.length
        });
        throw new Error("Data integrity error: Found data belonging to other properties");
      }

      console.log(`All data verified for property ${property.name} (${property.id})`);

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

      // Calculate totals including mid-term revenue AND visits as expenses
      const visitTotal = visits.reduce((sum, v) => sum + Number(v.price), 0);
      expenseTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
      bookingRevenue = bookings.reduce((sum, b) => sum + Number(b.total_amount), 0);
      managementFees = bookings.reduce((sum, b) => sum + Number(b.management_fee), 0);
      
      // Calculate mid-term revenue for the month
      // Use nightly_rate if available, otherwise use monthly_rent
      midTermRevenue = midTermBookings.reduce((sum, b) => {
        if (b.nightly_rate) {
          // Calculate days in the previous month
          const daysInMonth = new Date(lastDayOfPreviousMonth.getFullYear(), lastDayOfPreviousMonth.getMonth() + 1, 0).getDate();
          return sum + (Number(b.nightly_rate) * daysInMonth);
        }
        return sum + Number(b.monthly_rent);
      }, 0);
      totalRevenue = bookingRevenue + midTermRevenue;
      
      // Calculate net income: Revenue - ALL expenses (management fees, visits, other expenses, order minimum fee)
      netIncome = totalRevenue - managementFees - visitTotal - expenseTotal - orderMinimumFee;
      
      console.log("Test mode calculation:", {
        totalRevenue,
        managementFees,
        visitTotal,
        expenseTotal,
        orderMinimumFee,
        netIncome
      });
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

      // System Prompt for PeachHaus Monthly Owner Performance Report
      const systemPrompt = `You are generating a monthly owner email for a property managed by PeachHaus Group LLC. Follow these rules exactly:

**A. Determine Rental Model**
Current property rental model: ${property.rental_type}
${property.rental_type === 'hybrid' ? '- Hybrid model: Primary focus is mid-term (MTR) placements + fill the gaps with short-term (STR) bookings. This model benefits from both corporate/insurance stays and tourist/short-stay demand.' : ''}
${property.rental_type === 'mid_term' ? '- MTR-Only model: Focus exclusively on mid-term placements (insurance, corporate, healthcare) with minimal short-term activity.' : ''}

**B. Layout & Style**
- Single-column layout (mobile optimized)
- Use web-safe sans-serif fonts (Arial or Helvetica)
- Body font size: 14-16px for readability
- Headings: 22-26px or bold weight
- Brand color: PeachHaus orange (#FF8C42) for headings/accents
- Body text: dark neutral
- Background: white or light offset
- White space: generous between sections

**C. Content Structure to Generate**

 1. **Performance Highlights**
   - Bookings: ${bookings?.length || 0}
   - Short-term revenue: $${bookingRevenue.toFixed(2)}
   - Mid-term revenue: $${midTermRevenue.toFixed(2)}
   - Total revenue: $${totalRevenue.toFixed(2)}
   - Property visits: ${isReconciliationMode ? visitCount : visits?.length || 0}
   - Maintenance tasks: ${isReconciliationMode ? expenseCount : expenses?.length || 0}

2. **What PeachHaus Did This Period**
   - Generate 3-5 high-impact actions taken (listing refresh, dynamic pricing, partner engagement, maintenance audit)
   ${property.rental_type === 'hybrid' ? '- Include both STR and MTR tactics' : ''}
   ${property.rental_type === 'mid_term' ? '- Focus on MTR tenant acquisition/retention' : ''}

3. **Local Demand Drivers & Upcoming Events**
   Location: ${metroArea}, ${city}, ${state}
   ${property.rental_type === 'hybrid' ? '- Include both leisure/tourist events AND corporate/relocation drivers' : ''}
   ${property.rental_type === 'mid_term' ? '- Focus on corporate/insurance/relocation demand, infrastructure projects, NOT tourist events' : ''}
   - For each event: name, date, distance from property, how it drives demand
   - Generate 2-4 realistic upcoming events/drivers for this location

4. **Strategic Action Plan**
   - Generate 2-4 specific planned actions for next period
   ${property.rental_type === 'hybrid' ? '- Include: "Pivot to short-stay around [event]" + "Secure mid-term partner for longer stays"' : ''}
   ${property.rental_type === 'mid_term' ? '- Focus: Corporate outreach, insurance partnerships, longer-term placement strategy' : ''}

**D. Tone & Format Requirements**
- Professional, confident, owner-focused
- Short paragraphs, bullet lists preferred
- Use HTML <p>, <strong>, <ul>, <li> tags
- Each section 2-4 lines maximum
- CONCISE and SCANNABLE

**E. Exclusions**
- DO NOT include financial line items, expenses, or cost breakdowns
- Focus purely on bookings, revenue potential, demand drivers, and strategy

Generate the performance report content now in HTML format.`;

      const propertyContext = `
Property: ${property.name}
Location: ${locationDescription}
Type: ${property.rental_type === 'hybrid' ? 'Hybrid (Short-term & Mid-term)' : property.rental_type === 'mid_term' ? 'Mid-term Only' : 'Long-term'}
Has Active Mid-term Booking: ${hasMidTermBooking ? 'Yes' : 'No'}
Previous Month: ${previousMonthName}
Bookings: ${bookings?.length || 0}
Short-term Revenue: $${bookingRevenue.toFixed(2)}
Mid-term Revenue: $${midTermRevenue.toFixed(2)}
Total Revenue: $${totalRevenue.toFixed(2)}
Visits: ${visits?.length || 0}
Expenses: $${expenseTotal.toFixed(2)}
Metro Area: ${metroArea}
City: ${city}
State: ${state}
      `.trim();

      let aiPrompt = systemPrompt + "\n\nProperty Details:\n" + propertyContext;

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

    // Calculate total expenses including visits for display
    const visitExpenses = visits.reduce((sum, v) => sum + Number(v.price), 0);
    const otherExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const totalExpensesWithVisits = otherExpenses + visitExpenses + managementFees + orderMinimumFee;

    console.log("Financial Summary:", {
      propertyId: property.id,
      propertyName: property.name,
      visits: visits.length,
      expenses: expenses.length,
      bookings: bookings.length,
      midTermBookings: midTermBookings.length,
      visitExpenses: visitExpenses,
      otherExpenses: otherExpenses,
      managementFees: managementFees,
      orderMinimumFee: orderMinimumFee,
      totalRevenue: totalRevenue,
      totalExpensesWithVisits: totalExpensesWithVisits,
      netIncome: netIncome,
      mode: isReconciliationMode ? 'reconciliation' : 'test'
    });

    // Get owner names - fetch owner for this property
    let ownerNames = "Property Owner";
    try {
      const { data: ownerData, error: ownerError } = await supabase
        .from("property_owners")
        .select("name, second_owner_name")
        .eq("id", property.owner_id)
        .maybeSingle();

      if (!ownerError && ownerData) {
        // Extract first name(s) from primary owner
        const primaryName = ownerData.name;
        let firstNames: string[] = [];
        
        if (primaryName.includes('&')) {
          firstNames = primaryName.split('&').map((name: string) => name.trim().split(' ')[0]);
        } else if (primaryName.toLowerCase().includes(' and ')) {
          firstNames = primaryName.split(/\sand\s/i).map((name: string) => name.trim().split(' ')[0]);
        } else {
          firstNames.push(primaryName.split(' ')[0]);
        }
        
        // Add second owner's first name if exists
        if (ownerData.second_owner_name) {
          const secondName = ownerData.second_owner_name.trim().split(' ')[0];
          firstNames.push(secondName);
        }
        
        ownerNames = firstNames.join(' & ');
      }
    } catch (error) {
      console.error("Error fetching owner names:", error);
    }

    // Generate owner statement email body (only used in reconciliation mode)
    let emailBody = "";
    
    if (isReconciliationMode) {
      // Generate professional email with PeachHaus branding and itemized financial statement
      emailBody = `
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
            <!-- Header with PeachHaus Orange -->
            <div style="background-color: #FF7F00; padding: 30px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Helvetica', 'Arial', sans-serif;">
                🏡 PeachHaus Monthly Summary
              </h1>
              <p style="color: #ffffff; margin: 12px 0 0 0; font-size: 16px; font-weight: 400; opacity: 0.95;">
                Property: ${property.name} | Period: ${previousMonthName}
              </p>
            </div>

            <!-- Professional Summary -->
            <div style="padding: 35px 40px; background-color: #ffffff;">
              <p style="font-size: 15px; line-height: 1.8; color: #2c3e50; margin: 0 0 20px 0;">
                Dear ${ownerNames},
              </p>
              <p style="font-size: 15px; line-height: 1.8; color: #2c3e50; margin: 0 0 20px 0;">
                Please find enclosed your official monthly financial statement for the period ending ${previousMonthName}. 
                This statement provides a comprehensive breakdown of all revenue collected and expenses incurred on your behalf 
                during the reporting period. All amounts reflected herein have been verified and reconciled with our accounting records.
              </p>
              <p style="font-size: 15px; line-height: 1.8; color: #2c3e50; margin: 0;">
                In accordance with our management agreement, payment processing will occur automatically unless we receive written notification of discrepancies prior to the deadline.
              </p>
            </div>

              <!-- Property Info Card -->
              <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 16px; padding: 25px; margin: 0 40px 35px 40px; border: 1px solid #dee2e6; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <div style="display: flex; align-items: start; gap: 20px;">
                  <div style="flex-shrink: 0;">
                    <img 
                      src="${property.image_path ? `${supabaseUrl}/storage/v1/object/public/property-images/${property.image_path.split('/').pop()}` : `${supabaseUrl}/storage/v1/object/public/property-images/peachhaus-logo.png`}" 
                      alt="${property.name}" 
                      style="width: 180px; height: 120px; object-fit: cover; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" 
                      onerror="this.onerror=null; this.src='${supabaseUrl}/storage/v1/object/public/property-images/peachhaus-logo.png'; this.style.objectFit='contain'; this.style.padding='20px';" 
                    />
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

              <!-- Performance Summary -->
              <div style="background-color: #ffffff; padding: 40px; margin: 0;">
                <h2 style="color: #FF7F00; margin: 0 0 30px 0; font-size: 22px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Helvetica', 'Arial', sans-serif;">
                  📊 Performance Summary
                </h2>
                
                <!-- Income & Activity Section -->
                <div style="background-color: #ffffff; border: 1px solid #EAEAEA; border-radius: 12px; padding: 25px; margin-bottom: 25px;">
                  <h3 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 18px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Helvetica', 'Arial', sans-serif;">
                    Income & Activity
                  </h3>
                  <table style="width: 100%; border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Helvetica', 'Arial', sans-serif;">
                    ${bookingRevenue > 0 ? `
                    <tr>
                      <td style="padding: 12px 0; color: #2c3e50; font-size: 15px; border-bottom: 1px solid #f5f5f5;">Short-term Booking Revenue</td>
                      <td style="padding: 12px 0; color: #22c55e; font-size: 15px; text-align: right; font-weight: 600; border-bottom: 1px solid #f5f5f5;">$${bookingRevenue.toFixed(2)}</td>
                    </tr>` : ''}
                    ${midTermRevenue > 0 ? `
                    <tr>
                      <td style="padding: 12px 0; color: #2c3e50; font-size: 15px; border-bottom: 1px solid #f5f5f5;">Mid-term Rental Revenue</td>
                      <td style="padding: 12px 0; color: #22c55e; font-size: 15px; text-align: right; font-weight: 600; border-bottom: 1px solid #f5f5f5;">$${midTermRevenue.toFixed(2)}</td>
                    </tr>` : ''}
                    <tr style="background-color: #E9F8EF;">
                      <td style="padding: 16px 12px; color: #166534; font-size: 16px; font-weight: 700;">Subtotal: Gross Revenue</td>
                      <td style="padding: 16px 12px; color: #166534; font-size: 16px; text-align: right; font-weight: 800;">$${totalRevenue.toFixed(2)}</td>
                    </tr>
                  </table>
                </div>

                <!-- PeachHaus Services Rendered Section -->
                <div style="background-color: #ffffff; border: 1px solid #EAEAEA; border-radius: 12px; padding: 25px; margin-bottom: 25px;">
                  <h3 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 18px; font-weight: 700; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Helvetica', 'Arial', sans-serif;">
                    🧰 PeachHaus Services Rendered
                  </h3>
                  <table style="width: 100%; border-collapse: collapse; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Helvetica', 'Arial', sans-serif;">
                    <tr>
                      <td style="padding: 12px 0; color: #2c3e50; font-size: 15px; border-bottom: 1px solid #f5f5f5;">Management & Oversight (${property.management_fee_percentage || 15}%)</td>
                      <td style="padding: 12px 0; color: #4a4a4a; font-size: 15px; text-align: right; font-weight: 600; border-bottom: 1px solid #f5f5f5;">$${managementFees.toFixed(2)}</td>
                    </tr>
                    ${orderMinimumFee > 0 ? `
                    <tr>
                      <td style="padding: 12px 0; color: #2c3e50; font-size: 15px; border-bottom: 1px solid #f5f5f5;">Operational Minimum Fee</td>
                      <td style="padding: 12px 0; color: #4a4a4a; font-size: 15px; text-align: right; font-weight: 600; border-bottom: 1px solid #f5f5f5;">$${orderMinimumFee.toFixed(2)}</td>
                    </tr>` : ''}
                    ${visits && visits.length > 0 ? visits.map((visit: any) => `
                    <tr>
                      <td style="padding: 10px 0; color: #2c3e50; font-size: 14px; border-bottom: 1px solid #f5f5f5;">
                        Property Visit - ${new Date(visit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${visit.description ? ': ' + visit.description : ''}
                      </td>
                      <td style="padding: 10px 0; color: #4a4a4a; font-size: 14px; text-align: right; font-weight: 600; border-bottom: 1px solid #f5f5f5;">$${Number(visit.price).toFixed(2)}</td>
                    </tr>`).join('') : ''}
                    ${expenses && expenses.length > 0 ? expenses.map((expense: any) => {
                      const description = expense.purpose || 'Maintenance & Supplies';
                      const dateStr = new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                      
                      return `
                      <tr>
                        <td style="padding: 10px 0; color: #2c3e50; font-size: 14px; border-bottom: 1px solid #f5f5f5;">
                          ${dateStr}: ${description}${expense.vendor ? ' - ' + expense.vendor : ''}${expense.category ? ' (' + expense.category + ')' : ''}
                        </td>
                        <td style="padding: 10px 0; color: #4a4a4a; font-size: 14px; text-align: right; font-weight: 600; border-bottom: 1px solid #f5f5f5;">$${Number(expense.amount).toFixed(2)}</td>
                      </tr>`;
                    }).join('') : ''}
                    <tr style="background-color: #FFF3EC;">
                      <td style="padding: 16px 12px; color: #E86800; font-size: 16px; font-weight: 700;">Total: Services Provided</td>
                      <td style="padding: 16px 12px; color: #E86800; font-size: 16px; text-align: right; font-weight: 800;">$${totalExpensesWithVisits.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td colspan="2" style="padding: 16px 0; color: #6b7280; font-size: 13px; line-height: 1.6; font-style: italic;">
                        Reflects PeachHaus management and service charges for this period.<br>
                        All services are part of PeachHaus' proactive management to protect property value and guest experience.
                      </td>
                    </tr>
                  </table>
                </div>

                <!-- Thank You Message -->
                <div style="background-color: #fafafa; border-radius: 8px; padding: 20px; margin-top: 30px; text-align: center;">
                  <p style="color: #2c3e50; margin: 0 0 8px 0; font-size: 15px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Helvetica', 'Arial', sans-serif;">
                    Thank you for partnering with PeachHaus.
                  </p>
                  <p style="color: #6b7280; margin: 0; font-size: 14px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', 'Helvetica', 'Arial', sans-serif;">
                    All charges reflect completed services that maintain your property's quality and performance readiness.
                  </p>
                </div>
              </div>

              <!-- End of Performance Summary -->
            </div>`;

    // AI Insights removed from owner statement - only for performance email

    emailBody += `
            <!-- Footer -->
            <div style="background-color: #2c3e50; color: #ffffff; padding: 32px 40px; text-align: center; border-top: 3px solid #FF8C42;">
              <p style="margin: 0; font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">
                PeachHaus Property Management
              </p>
              <p style="margin: 12px 0 0 0; font-size: 14px; color: #bdc3c7;">
                Questions or concerns? Contact us at <a href="mailto:info@peachhausgroup.com" style="color: #FF8C42; text-decoration: none; font-weight: 600;">info@peachhausgroup.com</a>
              </p>
              <p style="margin: 16px 0 0 0; font-size: 12px; color: #95a5a6; line-height: 1.6;">
                This is an official financial statement. Please retain for your records.<br>
                Thank you for trusting PeachHaus with your investment property.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
    } // End of owner statement email generation

    // Determine recipient and subject based on mode
    const recipientEmail = isTestEmail ? test_email : ownerEmail;
    
    // Send from admin@peachhausgroup.com (verified domain)
    const fromEmail = "PeachHaus Property Management <admin@peachhausgroup.com>";

    console.log(`Sending email to ${recipientEmail} from ${fromEmail}...`);

    let statementResponse: any = null;

    // EMAIL 1: Official Statement with Legal Language (ONLY in reconciliation mode)
    if (isReconciliationMode) {
      const statementSubject = isTestEmail 
        ? `[TEST] Monthly Owner Statement - ${property.name} - ${previousMonthName}`
        : `Monthly Owner Statement - ${property.name} - ${previousMonthName}`;

      statementResponse = await resend.emails.send({
        from: fromEmail,
        to: [recipientEmail],
        subject: statementSubject,
        html: emailBody,
      });

      console.log("Statement email sent:", statementResponse);

      if (statementResponse.error) {
        throw statementResponse.error;
      }
    }

    // EMAIL 2: Property Performance Report (ONLY in test mode, NOT in reconciliation mode)
    let performanceResponse: any = null;
    
    if (!isReconciliationMode) {
      const performanceEmailBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Property Performance Report - ${previousMonthName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
          </style>
        </head>
        <body style="margin: 0; padding: 0; background: #f4f4f4;">
          <div style="max-width: 650px; margin: 0 auto; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            
            <!-- Logo Header -->
            <div style="background-color: #ffffff; padding: 30px 40px; text-align: center; border-bottom: 3px solid #FF8C42;">
              <img src="${supabaseUrl}/storage/v1/object/public/property-images/peachhaus-logo.png" alt="PeachHaus Property Management" style="max-width: 280px; height: auto;" onerror="this.style.display='none';" />
            </div>

            <!-- Property Card with Image -->
            <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 16px; padding: 25px; margin: 20px 40px 35px 40px; border: 1px solid #dee2e6; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
              <div style="display: flex; align-items: start; gap: 20px;">
                <div style="flex-shrink: 0;">
                  <img 
                    src="${property.image_path ? `${supabaseUrl}/storage/v1/object/public/property-images/${property.image_path.split('/').pop()}` : `${supabaseUrl}/storage/v1/object/public/property-images/peachhaus-logo.png`}" 
                    alt="${property.name}" 
                    style="width: 180px; height: 120px; object-fit: cover; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" 
                    onerror="this.onerror=null; this.src='${supabaseUrl}/storage/v1/object/public/property-images/peachhaus-logo.png'; this.style.objectFit='contain'; this.style.padding='20px';" 
                  />
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

            <!-- Performance Highlights -->
            <div style="padding: 35px 40px; background-color: #fafafa;">
              <h2 style="color: #FF7F00; margin: 0 0 20px 0; font-size: 22px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                Performance Highlights
              </h2>
              <div style="background-color: #ffffff; padding: 24px; border-radius: 8px; border-left: 4px solid #FF8C42;">
                <ul style="list-style: none; padding: 0; margin: 0;">
                  <li style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #6c757d; font-size: 15px;">Bookings:</span>
                    <span style="color: #2c3e50; font-size: 18px; font-weight: 600;">${bookings?.length || 0}</span>
                  </li>
                  <li style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #6c757d; font-size: 15px;">Short-term Revenue:</span>
                    <span style="color: #27ae60; font-size: 18px; font-weight: 600;">$${bookingRevenue.toFixed(2)}</span>
                  </li>
                  <li style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #6c757d; font-size: 15px;">Mid-term Revenue:</span>
                    <span style="color: #27ae60; font-size: 18px; font-weight: 600;">$${midTermRevenue.toFixed(2)}</span>
                  </li>
                  ${midTermBookings && midTermBookings.length > 0 ? `
                  <li style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #6c757d; font-size: 15px;">Active Tenant:</span>
                    <span style="color: #8B5CF6; font-size: 16px; font-weight: 600;">${midTermBookings[0].tenant_name}</span>
                  </li>` : ''}
                  <li style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #6c757d; font-size: 15px;">Total Revenue:</span>
                    <span style="color: #27ae60; font-size: 20px; font-weight: 700;">$${totalRevenue.toFixed(2)}</span>
                  </li>
                  <li style="padding: 10px 0; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #6c757d; font-size: 15px;">Property Visits:</span>
                    <span style="color: #2c3e50; font-size: 18px; font-weight: 600;">${visits?.length || 0}</span>
                  </li>
                  <li style="padding: 10px 0; display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #6c757d; font-size: 15px;">Maintenance Tasks:</span>
                    <span style="color: #2c3e50; font-size: 18px; font-weight: 600;">${visits?.length || 0}</span>
                  </li>
                </ul>
              </div>
            </div>

            ${aiInsights ? `
            <!-- Performance Analysis -->
            <div style="padding: 35px 40px; background-color: #ffffff; border-top: 1px solid #e1e8ed;">
              <h2 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                Market Analysis & Strategy
              </h2>
              <div style="color: #4a5568; line-height: 1.9; font-size: 15px; background-color: #f8fbfd; padding: 24px; border-radius: 6px; border-left: 4px solid #667eea;">
                ${aiInsights}
              </div>
            </div>` : ''}

            <!-- Property Type Specific Insights -->
            <div style="padding: 35px 40px; background-color: #fafafa; border-top: 1px solid #e1e8ed;">
              <h2 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center;">
                <span style="font-size: 24px; margin-right: 10px;">📊</span> ${property.rental_type === 'hybrid' ? 'Hybrid Rental Strategy' : property.rental_type === 'mid_term' ? 'Mid-Term Rental Performance' : 'Rental Performance'}
              </h2>
              
              ${property.rental_type === 'hybrid' ? `
              <div style="background-color: #ffffff; padding: 24px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #667eea;">
                <h3 style="color: #667eea; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">
                  🔄 Dual-Channel Revenue Optimization
                </h3>
                <p style="color: #4a5568; line-height: 1.8; margin: 0 0 12px 0; font-size: 14px;">
                  Your property is strategically positioned in both short-term and mid-term markets, maximizing occupancy and revenue potential. 
                  This month: <strong>${bookingRevenue > 0 && midTermRevenue > 0 ? 'Both channels generated revenue' : bookingRevenue > 0 ? 'Short-term bookings dominated' : 'Mid-term rental in effect'}</strong>.
                </p>
                ${midTermRevenue > 0 ? `
                <p style="color: #4a5568; line-height: 1.8; margin: 0; font-size: 14px;">
                  <strong>Current Status:</strong> Active mid-term tenant providing stable monthly income of $${midTermRevenue.toFixed(2)}. 
                  We continue to monitor the market for optimal transition timing to maximize your annual returns.
                </p>` : `
                <p style="color: #4a5568; line-height: 1.8; margin: 0; font-size: 14px;">
                  <strong>Current Status:</strong> Operating in short-term mode with ${bookings?.length || 0} booking(s) this month. 
                  We're actively evaluating mid-term opportunities to reduce vacancy gaps and optimize revenue.
                </p>`}
              </div>` : property.rental_type === 'mid_term' ? `
              <div style="background-color: #ffffff; padding: 24px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
                <h3 style="color: #f59e0b; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">
                  🏠 Stable Mid-Term Occupancy
                </h3>
                <p style="color: #4a5568; line-height: 1.8; margin: 0 0 12px 0; font-size: 14px;">
                  Your property is currently generating consistent monthly revenue through our mid-term rental program. 
                  This strategy provides reliable cash flow while minimizing turnover costs and maintenance wear.
                </p>
                <p style="color: #4a5568; line-height: 1.8; margin: 0; font-size: 14px;">
                  <strong>Monthly Revenue:</strong> $${midTermRevenue.toFixed(2)} | 
                  <strong>Lease Status:</strong> ${hasMidTermBooking ? 'Active tenant in residence' : 'Marketing for next tenant'}
                </p>
              </div>` : ''}

              <!-- Marketing & Events -->
              <div style="background-color: #ffffff; padding: 24px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #FF8C42;">
                <h3 style="color: #FF8C42; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">
                  📢 Marketing Activities & Local Events
                </h3>
                <p style="color: #4a5568; line-height: 1.8; margin: 0 0 12px 0; font-size: 14px;">
                  <strong>Active Listings:</strong> Your property is currently listed on ${property.rental_type === 'mid_term' ? 'specialized mid-term rental platforms including Furnished Finder and corporate housing networks' : 'Airbnb, VRBO, and Booking.com with optimized pricing and professional photography'}.
                </p>
                <p style="color: #4a5568; line-height: 1.8; margin: 0 0 12px 0; font-size: 14px;">
                  <strong>Upcoming Area Events:</strong> We monitor local events in ${metroArea} that drive demand, including conferences, festivals, and seasonal attractions. 
                  ${property.rental_type !== 'mid_term' ? 'Our dynamic pricing algorithm automatically adjusts rates during high-demand periods.' : 'These events help maintain strong tenant interest.'}
                </p>
                <p style="color: #4a5568; line-height: 1.8; margin: 0; font-size: 14px;">
                  <strong>SEO & Visibility:</strong> Your listing maintains strong search visibility with ${property.rental_type === 'mid_term' ? 'targeted keywords for traveling professionals and corporate relocations' : 'optimized descriptions, 5-star reviews, and instant booking enabled'}.
                </p>
              </div>

              <!-- Strategic Action Plan -->
              <div style="background-color: #ffffff; padding: 24px; border-radius: 6px; border-left: 4px solid #10b981;">
                <h3 style="color: #10b981; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">
                  ✅ Action Plan for Next Period
                </h3>
                <ul style="color: #4a5568; line-height: 1.8; margin: 0; padding-left: 20px; font-size: 14px;">
                  ${property.rental_type === 'hybrid' ? `
                  <li>Continue monitoring market conditions to optimize channel mix</li>
                  <li>Refresh listing photos and descriptions to maintain competitive edge</li>
                  <li>Evaluate upcoming events to adjust pricing strategy</li>
                  ${midTermRevenue > 0 ? '<li>Plan transition strategy for end of current mid-term lease</li>' : '<li>Identify opportunities for mid-term tenant placement</li>'}
                  ` : property.rental_type === 'mid_term' ? `
                  <li>Maintain regular communication with current tenant</li>
                  <li>Schedule property inspection to ensure condition standards</li>
                  <li>Begin pre-marketing for next lease cycle (if applicable)</li>
                  <li>Review competitive rental rates in the area</li>
                  ` : `
                  <li>Optimize pricing based on local event calendar</li>
                  <li>Refresh listing content and photos quarterly</li>
                  <li>Monitor competitor listings and adjust strategy</li>
                  <li>Maintain 5-star guest experience standards</li>
                  `}
                  <li>Continue proactive property maintenance to prevent issues</li>
                  <li>Update market analysis and revenue projections</li>
                </ul>
              </div>
            </div>

            <!-- Closing Message -->
            <div style="padding: 35px 40px; background-color: #ffffff; border-top: 1px solid #e1e8ed;">
              <p style="color: #2c3e50; font-size: 15px; line-height: 1.8; margin: 0 0 20px 0;">
                We're honored to manage your property and remain dedicated to providing exceptional service. 
                Your property is in great hands, and we're always working to maximize your returns while maintaining the highest standards of care.
              </p>
              <p style="color: #2c3e50; font-size: 15px; line-height: 1.8; margin: 0;">
                Have questions about this report? We're just a message away!
              </p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #2c3e50; color: #ffffff; padding: 32px 40px; text-align: center; border-top: 3px solid #FF8C42;">
              <p style="margin: 0; font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">
                PeachHaus Property Management
              </p>
              <p style="margin: 12px 0 0 0; font-size: 14px; color: #bdc3c7;">
                Questions or feedback? Contact us at <a href="mailto:info@peachhausgroup.com" style="color: #FF8C42; text-decoration: none; font-weight: 600;">info@peachhausgroup.com</a>
              </p>
              <p style="margin: 16px 0 0 0; font-size: 12px; color: #95a5a6; line-height: 1.6;">
                Thank you for trusting PeachHaus with your investment property.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const performanceSubject = isTestEmail 
      ? `[TEST] Property Performance Report - ${property.name} - ${previousMonthName}`
      : `Property Performance Report - ${property.name} - ${previousMonthName}`;

    console.log("Sending performance report email...");

    performanceResponse = await resend.emails.send({
      from: fromEmail,
      to: [recipientEmail],
      subject: performanceSubject,
      html: performanceEmailBody,
    });

    console.log("Performance email sent:", performanceResponse);

    if (performanceResponse.error) {
      console.error("Performance email error:", performanceResponse.error);
      throw performanceResponse.error;
    }
    } // End of performance email (test mode only)


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
    if (isReconciliationMode) {
      if (isTestEmail) {
        console.log(`Owner statement sent successfully to ${test_email}`);
      } else {
        console.log(`Owner statement sent successfully to ${ownerEmail}`);
      }
    } else {
      if (isTestEmail) {
        console.log(`Performance email sent successfully to ${test_email}`);
      } else {
        console.log(`Performance email sent successfully to ${ownerEmail}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: isReconciliationMode 
          ? (isTestEmail ? `Owner statement sent to ${test_email}` : `Owner statement sent to ${ownerEmail}`)
          : (isTestEmail ? `Performance email sent to ${test_email}` : `Performance email sent to ${ownerEmail}`),
        statementEmailId: statementResponse?.data?.id,
        performanceEmailId: performanceResponse?.data?.id,
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
