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

// Company logo URL (publicly accessible)
const LOGO_URL = `${supabaseUrl}/storage/v1/object/public/property-images/peachhaus-logo.png`;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { 
      reconciliation_id, 
      test_email, 
      isManualSend, 
      propertyId, 
      emailType, 
      sendToOwner = true, 
      sendCopyToInfo = true,
      isTestEmail: testEmailFlag,
      is_revised = false,
      added_items = []
    } = await req.json();

    // Reconciliation mode vs test mode vs manual send
    const isReconciliationMode = !!reconciliation_id;
    const isTestEmail = !!test_email || !!testEmailFlag;
    const isManualMode = !!isManualSend;
    const emailTypeToSend = emailType || (isReconciliationMode ? 'owner_statement' : 'performance');
    
    if (isReconciliationMode) {
      console.log(`Sending owner statement for reconciliation: ${reconciliation_id}${isTestEmail ? ' (TEST to ' + test_email + ')' : ''}`);
    } else if (isManualMode) {
      console.log(`Sending manual ${emailTypeToSend} email for property: ${propertyId}`);
    } else {
      console.log("Starting test performance email generation for Villa 14...");
    }
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

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
    let visitTotal: number = 0;
    let cleaningFeesTotal: number = 0;
    let petFeesTotal: number = 0;
    let midTermProrationDetails: any[] = []; // Store proration details for display
    
    // Initialize date variables that will be used throughout
    const now = new Date();
    const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfPreviousMonth = new Date(firstDayOfCurrentMonth.getTime() - 1);
    const firstDayOfPreviousMonth = new Date(lastDayOfPreviousMonth.getFullYear(), lastDayOfPreviousMonth.getMonth(), 1);

    // Variable for portal URL with magic link token
    let portalUrl = "https://peachhausgroup.lovable.app/owner";

    if (isReconciliationMode) {
      // RECONCILIATION MODE: Fetch approved reconciliation data (or already sent statements)
      const { data: reconciliation, error: recError } = await supabase
        .from("monthly_reconciliations")
        .select(`
          *,
          properties(*),
          property_owners(id, email, name, second_owner_name, second_owner_email, service_type)
        `)
        .eq("id", reconciliation_id)
        .in("status", ["approved", "statement_sent"])
        .single();

      if (recError || !reconciliation) {
        throw new Error("Reconciliation not found or not approved");
      }

      property = reconciliation.properties;
      ownerEmail = reconciliation.property_owners?.email;
      const ownerId = reconciliation.property_owners?.id;
      
      if (!ownerEmail) {
        throw new Error("Owner email not found");
      }

      // Generate magic link token for portal access (30-day expiry for statement emails)
      if (ownerId) {
        const token = crypto.randomUUID() + "-" + crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
        
        const { error: sessionError } = await supabase
          .from("owner_portal_sessions")
          .insert({
            owner_id: ownerId,
            token,
            email: ownerEmail,
            expires_at: expiresAt,
          });

        if (!sessionError) {
          portalUrl = `https://peachhausgroup.lovable.app/owner?token=${token}`;
          console.log(`Generated magic link for owner portal: ${portalUrl}`);
        } else {
          console.error("Failed to create portal session:", sessionError);
        }
      }

      // Use reconciliation data instead of live queries
      totalRevenue = Number(reconciliation.total_revenue || 0);
      bookingRevenue = Number(reconciliation.short_term_revenue || 0);
      midTermRevenue = Number(reconciliation.mid_term_revenue || 0);
      managementFees = Number(reconciliation.management_fee || 0);
      
      // Fetch mid-term booking details for proration explanation
      const recMonth = new Date(reconciliation.reconciliation_month + "T00:00:00");
      const recMonthStart = new Date(recMonth.getFullYear(), recMonth.getMonth(), 1);
      const recMonthEnd = new Date(recMonth.getFullYear(), recMonth.getMonth() + 1, 0);
      const daysInMonth = recMonthEnd.getDate();
      
      const { data: mtBookings } = await supabase
        .from("mid_term_bookings")
        .select("tenant_name, start_date, end_date, monthly_rent, nightly_rate")
        .eq("property_id", property.id)
        .eq("status", "active")
        .gte("end_date", recMonthStart.toISOString().split('T')[0])
        .lte("start_date", recMonthEnd.toISOString().split('T')[0]);
      
      if (mtBookings && mtBookings.length > 0) {
        mtBookings.forEach((booking: any) => {
          const bookingStart = new Date(booking.start_date + "T00:00:00");
          const bookingEnd = new Date(booking.end_date + "T00:00:00");
          
          // Calculate overlap with the reconciliation month
          const effectiveStart = bookingStart > recMonthStart ? bookingStart : recMonthStart;
          const effectiveEnd = bookingEnd < recMonthEnd ? bookingEnd : recMonthEnd;
          
          // Calculate days occupied in this month
          const occupiedDays = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          
          // Calculate prorated amount
          const monthlyRent = Number(booking.monthly_rent || 0);
          const proratedAmount = (monthlyRent / daysInMonth) * occupiedDays;
          
          const startDay = effectiveStart.getDate();
          const endDay = effectiveEnd.getDate();
          const monthName = recMonth.toLocaleDateString('en-US', { month: 'short' });
          
          midTermProrationDetails.push({
            tenantName: booking.tenant_name,
            dateRange: `${monthName} ${startDay} - ${monthName} ${endDay}`,
            monthlyRent: monthlyRent,
            occupiedDays: occupiedDays,
            daysInMonth: daysInMonth,
            proratedAmount: proratedAmount,
            isFullMonth: occupiedDays >= daysInMonth - 1 // Allow 1 day tolerance
          });
        });
        
        console.log("Mid-term proration details:", midTermProrationDetails);
      }
      
      // Check if order minimum fee is verified before including it
      const { data: orderMinLineItem } = await supabase
        .from("reconciliation_line_items")
        .select("verified, amount")
        .eq("reconciliation_id", reconciliation_id)
        .eq("item_type", "order_minimum")
        .eq("verified", true)
        .maybeSingle();
      
      orderMinimumFee = orderMinLineItem ? Math.abs(Number(orderMinLineItem.amount)) : 0;
      
      // Calculate ALL totals from checked line items (verified and not excluded) regardless of date
      const { data: allLineItems, error: itemsCalcError } = await supabase
        .from("reconciliation_line_items")
        .select("*")
        .eq("reconciliation_id", reconciliation_id)
        .eq("verified", true)
        .eq("excluded", false);

      if (itemsCalcError) throw itemsCalcError;
      
      // WATCHDOG: Detect and deduplicate line items with same item_id
      const itemIdCounts = new Map<string, number>();
      (allLineItems || []).forEach((item: any) => {
        if (item.item_id) {
          const key = `${item.item_type}:${item.item_id}`;
          itemIdCounts.set(key, (itemIdCounts.get(key) || 0) + 1);
        }
      });
      
      let duplicatesDetected = 0;
      itemIdCounts.forEach((count, key) => {
        if (count > 1) {
          duplicatesDetected += count - 1;
          console.warn(`⚠️ EMAIL WATCHDOG: Duplicate line item detected - ${key} appears ${count}x`);
        }
      });
      
      if (duplicatesDetected > 0) {
        console.warn(`⚠️ EMAIL WATCHDOG: Found ${duplicatesDetected} duplicate line items that will be deduplicated`);
      }
      
      // Deduplicate by item_id for accurate calculation
      const seenItemIds = new Set<string>();
      const deduplicatedLineItems = (allLineItems || []).filter((item: any) => {
        if (!item.item_id) return true;
        const key = `${item.item_type}:${item.item_id}`;
        if (seenItemIds.has(key)) {
          console.log(`EMAIL WATCHDOG: Excluding duplicate from calculation: ${key}`);
          return false;
        }
        seenItemIds.add(key);
        return true;
      });
      
      // Calculate visit total from deduplicated visit line items
      visitTotal = deduplicatedLineItems
        .filter((item: any) => item.item_type === "visit")
        .reduce((sum: number, item: any) => sum + Math.abs(item.amount), 0);
      visitCount = deduplicatedLineItems.filter((item: any) => item.item_type === "visit").length;
      
      // Calculate expense total from deduplicated expense line items (exclude pass-through fees)
      expenseTotal = deduplicatedLineItems
        .filter((item: any) => item.item_type === "expense" && item.fee_type !== 'cleaning_fee' && item.fee_type !== 'pet_fee')
        .reduce((sum: number, item: any) => sum + Math.abs(item.amount), 0);
      expenseCount = deduplicatedLineItems.filter((item: any) => item.item_type === "expense" && item.fee_type !== 'cleaning_fee' && item.fee_type !== 'pet_fee').length;
      
      // Calculate pass-through fees (cleaning and pet fees)
      cleaningFeesTotal = deduplicatedLineItems
        .filter((item: any) => item.fee_type === 'cleaning_fee')
        .reduce((sum: number, item: any) => sum + Math.abs(item.amount), 0);
      
      petFeesTotal = deduplicatedLineItems
        .filter((item: any) => item.fee_type === 'pet_fee')
        .reduce((sum: number, item: any) => sum + Math.abs(item.amount), 0);
      
      console.log("Pass-through fees:", { cleaningFeesTotal, petFeesTotal });
      
      // CORRECT CALCULATION: Include visits, expenses, AND pass-through fees
      netIncome = totalRevenue - managementFees - orderMinimumFee - expenseTotal - visitTotal - cleaningFeesTotal - petFeesTotal;
      
      console.log("Reconciliation mode net calculation:", {
        totalRevenue,
        managementFees,
        orderMinimumFee,
        expenseTotal,
        visitTotal,
        netIncome,
        duplicatesDetected
      });

      // Fetch line items for details (only verified and not excluded)
      const { data: lineItems, error: itemsError } = await supabase
        .from("reconciliation_line_items")
        .select("*")
        .eq("reconciliation_id", reconciliation_id)
        .eq("verified", true)
        .eq("excluded", false)
        .order("date", { ascending: false });

      if (itemsError) throw itemsError;
      
      // Deduplicate line items by item_id for display
      const seenDisplayIds = new Set<string>();
      const deduplicatedDisplayItems = (lineItems || []).filter((item: any) => {
        if (!item.item_id) return true;
        const key = `${item.item_type}:${item.item_id}`;
        if (seenDisplayIds.has(key)) {
          console.log(`EMAIL WATCHDOG: Excluding duplicate from display: ${item.description}`);
          return false;
        }
        seenDisplayIds.add(key);
        return true;
      });

      // Fetch actual visit records to get detailed breakdown (hours, visit fee, etc.)
      const visitLineItems = deduplicatedDisplayItems
        .filter((item: any) => item.item_type === "visit");
      
      // Get unique visit IDs only
      const uniqueVisitIds = [...new Set(visitLineItems.map((item: any) => item.item_id))];
      
      if (uniqueVisitIds.length > 0) {
        const { data: visitRecords, error: visitError } = await supabase
          .from("visits")
          .select("*, properties!inner(visit_price)")
          .in("id", uniqueVisitIds);
        
        if (visitError) {
          console.error("Error fetching visit records:", visitError);
          visits = visitLineItems.map((item: any) => ({
            description: item.description,
            price: Math.abs(item.amount),
            date: item.date,
            visited_by: "Staff",
            hours: 0,
            visit_fee: 0,
            notes: null
          }));
        } else {
          // Map each unique visit record - no duplicates
          visits = (visitRecords || []).map((v: any) => ({
            id: v.id,
            date: v.date,
            time: v.time,
            visited_by: v.visited_by || "Staff",
            hours: v.hours || 0,
            price: Number(v.price || 0),
            visit_fee: Number(v.properties?.visit_price || 0),
            notes: v.notes,
            description: `Property visit - ${v.visited_by || "Staff"}`
          }));
          
          console.log(`EMAIL: Fetched ${visits.length} unique visits (from ${visitLineItems.length} line items)`);
        }
      } else {
        visits = [];
      }

      // Fetch detailed expense data with line items for better descriptions
      // Use unique expense IDs only (from deduplicated list)
      const uniqueExpenseIds = [...new Set(
        deduplicatedDisplayItems
          .filter((item: any) => item.item_type === "expense")
          .map((item: any) => item.item_id)
      )];
      
      let detailedExpenses: any[] = [];
      if (uniqueExpenseIds.length > 0) {
        const { data: expenseData } = await supabase
          .from("expenses")
          .select("id, date, amount, purpose, category, vendor, order_number, items_detail, line_items, file_path, original_receipt_path, email_screenshot_path")
          .in("id", uniqueExpenseIds);
        
        detailedExpenses = expenseData || [];
        
        // Generate signed URLs for receipts - prioritize original_receipt_path > file_path > email_screenshot_path
        for (const expense of detailedExpenses) {
          const receiptPath = expense.original_receipt_path || expense.file_path || expense.email_screenshot_path;
          if (receiptPath) {
            const { data: signedUrlData } = await supabase.storage
              .from('expense-documents')
              .createSignedUrl(receiptPath, 60 * 60 * 24 * 7); // 7 days
            
            if (signedUrlData?.signedUrl) {
              expense.receipt_url = signedUrlData.signedUrl;
            }
          }
        }
      }
      
      expenses = deduplicatedDisplayItems
        .filter((item: any) => {
          if (item.item_type !== "expense") return false;
          
          // Filter out visit-related expenses to avoid double counting
          const desc = (item.description || '').toLowerCase();
          return !desc.includes('visit fee') && 
                 !desc.includes('visit charge') &&
                 !desc.includes('hourly charge') &&
                 !desc.includes('property visit');
        })
        .map((item: any) => {
          const detailedExpense = detailedExpenses.find((e: any) => e.id === item.item_id);
          return {
            id: item.item_id,
            date: item.date,
            amount: Math.abs(item.amount),
            purpose: detailedExpense?.items_detail || detailedExpense?.purpose || item.description,
            category: detailedExpense?.category || item.category,
            vendor: detailedExpense?.vendor || (item.description.includes(' - ') ? item.description.split(' - ')[1] : null),
            order_number: detailedExpense?.order_number,
            items_detail: detailedExpense?.items_detail,
            line_items: detailedExpense?.line_items,
            receipt_url: detailedExpense?.receipt_url,
          };
        });
      
      console.log(`EMAIL: Processing ${expenses.length} unique expenses`);
      expenseCount = expenses.length;

      bookings = deduplicatedDisplayItems
        .filter((item: any) => item.item_type === "booking")
        .map((item: any) => ({
          guest_name: item.description,
          check_in: item.date,
          total_amount: item.amount,
        }));

      midTermBookings = deduplicatedDisplayItems
        .filter((item: any) => item.item_type === "mid_term_booking")
        .map((item: any) => ({
          tenant_name: item.description,
          monthly_rent: item.amount,
        }));

      previousMonthName = new Date(reconciliation.reconciliation_month).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
      });
      
      // Set reportDate for reconciliation mode
      reportDate = new Date(reconciliation.reconciliation_month).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

    } else {
      // TEST MODE or MANUAL SEND MODE: Use existing logic
      
      previousMonthName = firstDayOfPreviousMonth.toLocaleDateString('en-US', { 
        month: 'long',
        year: 'numeric'
      });

      reportDate = now.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });

      let fetchedProperty;

      if (isManualMode && propertyId) {
        // MANUAL MODE: Fetch specific property
        const { data: manualProperty, error: manualError } = await supabase
          .from("properties")
          .select("*")
          .eq("id", propertyId)
          .maybeSingle();

        if (manualError) {
          console.error("Error fetching property:", manualError);
          throw manualError;
        }
        if (!manualProperty) throw new Error("Property not found");
        
        fetchedProperty = manualProperty;
        console.log("Manual send - Found property:", fetchedProperty.name, fetchedProperty.id);
        console.log("Property owner_id:", fetchedProperty.owner_id);
        console.log("Property user_id:", fetchedProperty.user_id);
        
        let foundEmail = "";
        
        // Try to get owner email from property_owners table first using owner_id
        if (fetchedProperty.owner_id) {
          const { data: ownerData, error: ownerError } = await supabase
            .from("property_owners")
            .select("email")
            .eq("id", fetchedProperty.owner_id)
            .maybeSingle();
          
          if (!ownerError && ownerData?.email) {
            foundEmail = ownerData.email;
            console.log("Found owner email from property_owners:", foundEmail);
          } else {
            console.log("Could not find owner in property_owners table, trying profiles...");
          }
        }
        
        // Fallback to profiles table using user_id if no owner email found
        if (!foundEmail && fetchedProperty.user_id) {
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", fetchedProperty.user_id)
            .maybeSingle();
          
          if (!profileError && profileData?.email) {
            foundEmail = profileData.email;
            console.log("Found owner email from profiles:", foundEmail);
          }
        }
        
        // If still no email found, throw error
        if (!foundEmail) {
          throw new Error(`No owner email found for property ${fetchedProperty.name}. Please assign an owner to this property.`);
        }
        
        ownerEmail = foundEmail;
      } else {
        // TEST MODE: Default to info@peachhausgroup.com
        ownerEmail = "info@peachhausgroup.com"; // Test email
        
        // Fetch Villa 14 property for test
        const { data: properties, error: propertiesError } = await supabase
          .from("properties")
          .select("*, rental_type")
          .ilike("name", "%villa%14%");

        if (propertiesError) throw propertiesError;
        
        if (!properties || properties.length === 0) {
          throw new Error("Villa 14 not found");
        }

        fetchedProperty = properties[0];
        console.log("Test mode - Found property:", fetchedProperty.name, fetchedProperty.id);
      }

      property = fetchedProperty;

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

    // Fetch AI prompt from database
    console.log(`Fetching AI prompt for email type: ${emailTypeToSend}...`);
    const { data: promptData, error: promptError } = await supabase
      .from("email_ai_prompts")
      .select("prompt_content")
      .eq("email_type", emailTypeToSend)
      .single();
    
    if (promptError) {
      console.error("Error fetching AI prompt, using default:", promptError);
    }
    
    // Use fetched prompt or fallback to default
    const basePrompt = promptData?.prompt_content || `You are generating a monthly owner email for a property managed by PeachHaus Group LLC. Follow these rules exactly:`;

    // Generate AI insights
    console.log("Generating AI insights...");
    let aiInsights = "";
    
    try {

      // System Prompt with location and property context
      const systemPrompt = basePrompt + `

**Property Context**
Current property rental model: ${property.rental_type}
${property.rental_type === 'hybrid' ? '- Hybrid model: Primary focus is mid-term (MTR) placements + fill the gaps with short-term (STR) bookings. This model benefits from both corporate/insurance stays and tourist/short-stay demand.' : ''}
${property.rental_type === 'mid_term' ? '- MTR-Only model: Focus exclusively on mid-term placements (insurance, corporate, healthcare) with minimal short-term activity.' : ''}

**Location Context**
Location: ${metroArea}, ${city}, ${state}

**Revenue Data (for context only, not to be shown in output)**
- Short-term revenue: $${bookingRevenue.toFixed(2)}
- Mid-term revenue: $${midTermRevenue.toFixed(2)}
- Total revenue: $${totalRevenue.toFixed(2)}
- Active bookings: ${bookings?.length || 0}
- Active mid-term tenants: ${midTermBookings?.length || 0}

**Existing Content to Replace**
You are REPLACING the system-generated default content. Focus on strategy, demand drivers, and action plans:

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

1. **What PeachHaus Did This Period**
   - Generate 3-5 high-impact actions taken (listing refresh, dynamic pricing, partner engagement, maintenance audit)
   ${property.rental_type === 'hybrid' ? '- Include both STR and MTR tactics' : ''}
   ${property.rental_type === 'mid_term' ? '- Focus on MTR tenant acquisition/retention' : ''}

2. **Local Demand Drivers & Upcoming Events**
   Location: ${metroArea}, ${city}, ${state}
   ${property.rental_type === 'hybrid' ? '- Include both leisure/tourist events AND corporate/relocation drivers' : ''}
   ${property.rental_type === 'mid_term' ? '- Focus on corporate/insurance/relocation demand, infrastructure projects, NOT tourist events' : ''}
   - For each event: name, date, distance from property, how it drives demand
   - Generate 2-4 realistic upcoming events/drivers for this location

3. **Strategic Action Plan**
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
- DO NOT generate a "Performance Highlights" section with bookings, visits, or maintenance tasks
- Focus purely on strategy, demand drivers, and action plans

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

      const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: aiPrompt
            }
          ],
          max_tokens: 1000,
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

    // ========== CALCULATION WATCHDOG ==========
    // In reconciliation mode, calculate totals DIRECTLY from the arrays that will be displayed
    // This ensures what we show in the email matches what we calculate
    
    let visitExpenses: number;
    let otherExpenses: number;
    
    if (isReconciliationMode) {
      // Calculate visit expenses from the ACTUAL visits array that will be displayed
      visitExpenses = visits.reduce((sum, v) => sum + Number(v.price || 0), 0);
      
      // Calculate expense total from the ACTUAL expenses array that will be displayed
      otherExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      
      // WATCHDOG: Compare with line item calculations and log discrepancies
      if (Math.abs(visitExpenses - visitTotal) > 0.01) {
        console.error(`🚨 WATCHDOG ALERT: Visit calculation mismatch! Displayed visits sum: $${visitExpenses.toFixed(2)}, Line items sum: $${visitTotal.toFixed(2)}`);
        console.error(`Visits array has ${visits.length} items, line items had ${visitCount} items`);
        // Log each visit for debugging
        visits.forEach((v, i) => console.log(`  Visit ${i+1}: ${v.visited_by} on ${v.date} = $${v.price}`));
      }
      
      if (Math.abs(otherExpenses - expenseTotal) > 0.01) {
        console.error(`🚨 WATCHDOG ALERT: Expense calculation mismatch! Displayed expenses sum: $${otherExpenses.toFixed(2)}, Line items sum: $${expenseTotal.toFixed(2)}`);
        console.error(`Expenses array has ${expenses.length} items, line items had ${expenseCount} items`);
      }
    } else {
      visitExpenses = visits.reduce((sum, v) => sum + Number(v.price), 0);
      otherExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    }
    
    // Calculate total from what we will actually DISPLAY (includes pass-through fees)
    const totalExpensesWithVisits = otherExpenses + visitExpenses + managementFees + orderMinimumFee + cleaningFeesTotal + petFeesTotal;

    // FINAL WATCHDOG: Log individual components for audit
    console.log("=== CALCULATION WATCHDOG SUMMARY ===");
    console.log(`Management Fees: $${managementFees.toFixed(2)}`);
    console.log(`Order Minimum: $${orderMinimumFee.toFixed(2)}`);
    console.log(`Visit Expenses (${visits.length} visits): $${visitExpenses.toFixed(2)}`);
    visits.forEach((v, i) => console.log(`  └ Visit ${i+1}: ${v.visited_by} on ${v.date} = $${Number(v.price || 0).toFixed(2)}`));
    console.log(`Other Expenses (${expenses.length} expenses): $${otherExpenses.toFixed(2)}`);
    expenses.forEach((e, i) => console.log(`  └ Expense ${i+1}: ${e.purpose?.substring(0, 40)} = $${Number(e.amount || 0).toFixed(2)}`));
    console.log(`TOTAL SERVICES: $${totalExpensesWithVisits.toFixed(2)}`);
    console.log(`Formula: ${managementFees} + ${orderMinimumFee} + ${visitExpenses} + ${otherExpenses} = ${totalExpensesWithVisits}`);
    console.log("=====================================");

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
      // Fortune 500 style: Clean, institutional, bank-statement quality
      // All black text, minimal colors, professional typography
      
      const statementId = `PH-${new Date(previousMonthName).getFullYear()}${String(new Date(previousMonthName).getMonth() + 1).padStart(2, '0')}-${reconciliation_id.slice(0, 8).toUpperCase()}`;
      const issueDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      const netLabel = netIncome >= 0 ? 'NET OWNER EARNINGS' : 'BALANCE DUE FROM OWNER';
      
      // Generate mid-term revenue HTML with proration explanation
      let midTermRevenueHtml = '';
      if (midTermRevenue > 0) {
        if (midTermProrationDetails.length > 0) {
          midTermRevenueHtml = midTermProrationDetails.map((detail: any) => {
            if (detail.isFullMonth) {
              // Full month - no proration needed
              return `
              <tr>
                <td style="padding: 8px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">
                  Mid-term Rental Revenue
                  <div style="color: #666666; font-size: 11px; margin-top: 2px;">
                    ${detail.tenantName}
                  </div>
                </td>
                <td style="padding: 8px 0; font-size: 13px; color: #111111; text-align: right; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace; border-bottom: 1px solid #e5e5e5; vertical-align: top;">$${detail.proratedAmount.toFixed(2)}</td>
              </tr>`;
            } else {
              // Prorated month - show calculation
              return `
              <tr>
                <td style="padding: 8px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">
                  Mid-term Rental Revenue
                  <div style="color: #666666; font-size: 11px; margin-top: 2px;">
                    ${detail.tenantName} (${detail.dateRange})
                  </div>
                  <div style="color: #888888; font-size: 10px; margin-top: 2px; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace;">
                    $${detail.monthlyRent.toLocaleString()}/mo × ${detail.occupiedDays}/${detail.daysInMonth} days = $${detail.proratedAmount.toFixed(2)}
                  </div>
                </td>
                <td style="padding: 8px 0; font-size: 13px; color: #111111; text-align: right; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace; border-bottom: 1px solid #e5e5e5; vertical-align: top;">$${detail.proratedAmount.toFixed(2)}</td>
              </tr>`;
            }
          }).join('');
        } else {
          // Fallback if no proration details available
          midTermRevenueHtml = `
          <tr>
            <td style="padding: 8px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">Mid-term Rental Revenue</td>
            <td style="padding: 8px 0; font-size: 13px; color: #111111; text-align: right; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace; border-bottom: 1px solid #e5e5e5;">$${midTermRevenue.toFixed(2)}</td>
          </tr>`;
        }
      }
      
      // Generate visit rows - compact format
      const visitRowsHtml = visits && visits.length > 0 ? visits.map((visit: any) => {
        const personName = visit.visited_by || 'Staff';
        const actualVisitPrice = Number(visit.price || 0);
        const visitHours = Number(visit.hours || 0);
        const visitDate = new Date(visit.date + 'T12:00:00');
        const dateStr = visitDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        const hourlyRate = 50;
        const hourlyCharge = visitHours * hourlyRate;
        const baseVisitFee = actualVisitPrice - hourlyCharge;
        
        let detail = dateStr;
        if (visitHours > 0) {
          detail += ` • Base $${baseVisitFee.toFixed(0)} + ${visitHours}h`;
        }
        
        let result = `
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">
            Property Visit (${personName})
            <span style="color: #666666; font-size: 11px; margin-left: 8px;">${detail}</span>
            ${visit.notes ? `<div style="color: #666666; font-size: 11px; margin-top: 2px; font-style: italic;">${visit.notes}</div>` : ''}
          </td>
          <td style="padding: 8px 0; font-size: 13px; color: #111111; text-align: right; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace; border-bottom: 1px solid #e5e5e5; vertical-align: top;">
            $${actualVisitPrice.toFixed(2)}
          </td>
        </tr>`;
        
        return result;
      }).join('') : '';
      
      // Generate expense rows - compact format (no receipt links - use portal instead)
      const expenseRowsHtml = expenses && expenses.length > 0 ? expenses.map((expense: any) => {
        const description = expense.purpose || expense.items_detail || 'Maintenance & Supplies';
        const dateStr = new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const vendor = expense.vendor ? ` - ${expense.vendor}` : '';
        
        return `
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">
            ${description}${vendor}
            <span style="color: #666666; font-size: 11px; margin-left: 8px;">${dateStr}</span>
          </td>
          <td style="padding: 8px 0; font-size: 13px; color: #111111; text-align: right; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace; border-bottom: 1px solid #e5e5e5; vertical-align: top;">
            $${Number(expense.amount).toFixed(2)}
          </td>
        </tr>`;
      }).join('') : '';

      emailBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Owner Statement - ${previousMonthName}</title>
        </head>
        <body style="margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
            
            <!-- Header - Corporate Minimal with Logo -->
            <div style="padding: 24px 32px; border-bottom: 2px solid #111111;">
              <table style="width: 100%;">
                <tr>
                  <td style="vertical-align: middle;">
                    <img src="${LOGO_URL}" alt="PeachHaus" style="height: 40px; width: auto;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                    <div style="display: none; font-size: 20px; font-weight: 700; color: #111111; letter-spacing: -0.3px;">PeachHaus</div>
                  </td>
                  <td style="text-align: right; vertical-align: middle;">
                    <div style="font-size: 16px; font-weight: 600; color: #111111; margin-bottom: 4px;">OWNER STATEMENT</div>
                    <div style="font-size: 10px; color: #666666; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace;">
                      ${statementId}
                    </div>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Property & Period Info -->
            <div style="padding: 20px 32px; background: #f9f9f9; border-bottom: 1px solid #e5e5e5;">
              <table style="width: 100%;">
                <tr>
                  <td style="vertical-align: top; width: 50%;">
                    <div style="font-size: 10px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Property</div>
                    <div style="font-size: 14px; font-weight: 600; color: #111111;">${property.name}</div>
                    <div style="font-size: 12px; color: #666666; margin-top: 2px;">${property.address}</div>
                  </td>
                  <td style="vertical-align: top; text-align: right;">
                    <div style="font-size: 10px; color: #666666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Statement Period</div>
                    <div style="font-size: 14px; font-weight: 600; color: #111111;">${previousMonthName}</div>
                    <div style="font-size: 12px; color: #666666; margin-top: 2px;">Issue Date: ${issueDate}</div>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Greeting - Brief -->
            <div style="padding: 24px 32px 16px 32px;">
              <p style="font-size: 14px; line-height: 1.6; color: #111111; margin: 0;">
                Dear ${ownerNames},
              </p>
              ${is_revised ? `
              <div style="background: #fff3cd; border-left: 3px solid #856404; padding: 12px 16px; margin: 16px 0;">
                <div style="font-size: 12px; font-weight: 600; color: #856404; margin-bottom: 8px;">REVISED STATEMENT</div>
                <p style="font-size: 12px; color: #856404; margin: 0; line-height: 1.5;">
                  This revised statement includes additional items not in the original. Please disregard the previous statement.
                </p>
              </div>
              ` : ''}
              <p style="font-size: 13px; line-height: 1.6; color: #444444; margin: 12px 0 0 0;">
                Please find below your financial statement for the period ending ${previousMonthName}.
              </p>
            </div>

            <!-- NET RESULT - Primary Focus -->
            <div style="padding: 0 32px 24px 32px;">
              <table style="width: 100%; border: 2px solid #111111;">
                <tr>
                  <td style="padding: 16px 20px; background: #111111;">
                    <table style="width: 100%;">
                      <tr>
                        <td style="vertical-align: middle;">
                          <div style="font-size: 10px; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8;">${netLabel}</div>
                          <div style="font-size: 10px; color: #ffffff; opacity: 0.6; margin-top: 2px;">For period ${previousMonthName}</div>
                        </td>
                        <td style="text-align: right; vertical-align: middle;">
                          <div style="font-size: 28px; font-weight: 700; color: #ffffff; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace;">
                            ${netIncome >= 0 ? '' : '-'}$${Math.abs(netIncome).toFixed(2)}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 20px; background: #f9f9f9;">
                    <table style="width: 100%;">
                      <tr>
                        <td style="font-size: 11px; color: #666666;">Gross Revenue</td>
                        <td style="font-size: 13px; font-weight: 600; color: #111111; text-align: right; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace;">$${totalRevenue.toFixed(2)}</td>
                        <td style="width: 32px;"></td>
                        <td style="font-size: 11px; color: #666666;">Total Expenses</td>
                        <td style="font-size: 13px; font-weight: 600; color: #111111; text-align: right; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace;">($${totalExpensesWithVisits.toFixed(2)})</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </div>

            <!-- REVENUE SECTION -->
            <div style="padding: 0 32px 16px 32px;">
              <div style="font-size: 11px; font-weight: 600; color: #111111; padding: 8px 0; border-bottom: 1px solid #111111; text-transform: uppercase; letter-spacing: 0.5px;">
                Revenue
              </div>
              <table style="width: 100%;">
                ${bookingRevenue > 0 ? `
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">Short-term Booking Revenue</td>
                  <td style="padding: 8px 0; font-size: 13px; color: #111111; text-align: right; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace; border-bottom: 1px solid #e5e5e5;">$${bookingRevenue.toFixed(2)}</td>
                </tr>` : ''}
                ${midTermRevenueHtml}
                <tr style="background: #f9f9f9;">
                  <td style="padding: 10px 0; font-size: 13px; font-weight: 600; color: #111111;">TOTAL GROSS REVENUE</td>
                  <td style="padding: 10px 0; font-size: 14px; color: #111111; text-align: right; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace; font-weight: 700;">$${totalRevenue.toFixed(2)}</td>
                </tr>
              </table>
            </div>

            <!-- EXPENSES SECTION -->
            <div style="padding: 0 32px 16px 32px;">
              <div style="font-size: 11px; font-weight: 600; color: #111111; padding: 8px 0; border-bottom: 1px solid #111111; text-transform: uppercase; letter-spacing: 0.5px;">
                Expenses & Fees
              </div>
              <table style="width: 100%;">
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">Management Fee (${property.management_fee_percentage || 15}%)</td>
                  <td style="padding: 8px 0; font-size: 13px; color: #111111; text-align: right; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace; border-bottom: 1px solid #e5e5e5;">$${managementFees.toFixed(2)}</td>
                </tr>
                ${orderMinimumFee > 0 ? `
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">Operational Minimum Fee</td>
                  <td style="padding: 8px 0; font-size: 13px; color: #111111; text-align: right; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace; border-bottom: 1px solid #e5e5e5;">$${orderMinimumFee.toFixed(2)}</td>
                </tr>` : ''}
                ${visitRowsHtml}
                ${expenseRowsHtml}
                ${cleaningFeesTotal > 0 ? `
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">
                    Cleaning Fees <span style="color: #666666; font-size: 11px;">(pass-through)</span>
                  </td>
                  <td style="padding: 8px 0; font-size: 13px; color: #111111; text-align: right; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace; border-bottom: 1px solid #e5e5e5;">$${cleaningFeesTotal.toFixed(2)}</td>
                </tr>` : ''}
                ${petFeesTotal > 0 ? `
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; color: #111111; border-bottom: 1px solid #e5e5e5;">
                    Pet Fees <span style="color: #666666; font-size: 11px;">(pass-through)</span>
                  </td>
                  <td style="padding: 8px 0; font-size: 13px; color: #111111; text-align: right; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace; border-bottom: 1px solid #e5e5e5;">$${petFeesTotal.toFixed(2)}</td>
                </tr>` : ''}
                <tr style="background: #f9f9f9;">
                  <td style="padding: 10px 0; font-size: 13px; font-weight: 600; color: #111111;">TOTAL EXPENSES</td>
                  <td style="padding: 10px 0; font-size: 14px; color: #111111; text-align: right; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace; font-weight: 700;">($${totalExpensesWithVisits.toFixed(2)})</td>
                </tr>
              </table>
            </div>

            <!-- NET RESULT - Final -->
            <div style="padding: 0 32px 24px 32px;">
              <table style="width: 100%; border: 2px solid #111111;">
                <tr>
                  <td style="padding: 14px 20px; background: #111111;">
                    <table style="width: 100%;">
                      <tr>
                        <td style="font-size: 12px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px;">${netLabel}</td>
                        <td style="font-size: 20px; font-weight: 700; color: #ffffff; text-align: right; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace;">
                          ${netIncome >= 0 ? '' : '-'}$${Math.abs(netIncome).toFixed(2)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Owner Portal CTA -->
            <div style="padding: 20px 32px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-top: 1px solid #e5e5e5;">
              <table style="width: 100%;">
                <tr>
                  <td style="vertical-align: middle;">
                    <div style="font-size: 13px; font-weight: 600; color: #111111; margin-bottom: 4px;">View Your Owner Portal</div>
                    <div style="font-size: 11px; color: #666666;">Access all receipts, bookings, and performance data anytime</div>
                  </td>
                  <td style="text-align: right; vertical-align: middle;">
                    <a href="${portalUrl}" style="display: inline-block; background: #111111; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 12px; font-weight: 600;">Open Portal →</a>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Footer -->
            <div style="padding: 24px 32px; border-top: 1px solid #e5e5e5; background: #f9f9f9;">
              <p style="font-size: 12px; color: #666666; margin: 0 0 12px 0; line-height: 1.5;">
                Questions about this statement? Reply to this email or contact <a href="mailto:info@peachhausgroup.com" style="color: #111111; text-decoration: underline;">info@peachhausgroup.com</a>
              </p>
              <div style="font-size: 10px; color: #999999; border-top: 1px solid #e5e5e5; padding-top: 12px; margin-top: 12px;">
                <div style="margin-bottom: 4px;">PeachHaus Group LLC</div>
                <div>This is an official financial statement. Please retain for your records.</div>
                <div style="margin-top: 8px; font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace;">${statementId} • ${issueDate}</div>
              </div>
            </div>

          </div>
        </body>
      </html>
    `;
    } // End of owner statement email generation

    // Determine recipient and subject based on mode
    const recipientEmail = isTestEmail ? test_email : ownerEmail;
    
    // Send from admin@peachhausgroup.com (verified domain)
    const fromEmail = "PeachHaus Group LLC <admin@peachhausgroup.com>";

    console.log(`Sending email to ${recipientEmail} from ${fromEmail}...`);

    let statementResponse: any = null;

    // EMAIL 1: Official Statement with Legal Language (ONLY in reconciliation mode)
    if (isReconciliationMode) {
      // Get owner data with both emails for reconciliation
      const { data: ownerData } = await supabase
        .from("property_owners")
        .select("email, second_owner_email")
        .eq("id", property.owner_id)
        .maybeSingle();
      
      let statementRecipients: string[] = [];
      
      // If this is a test email, ONLY send to info@peachhausgroup.com
      if (isTestEmail) {
        statementRecipients = ["info@peachhausgroup.com"];
      } else {
        // Normal mode: send to owners
        if (ownerData) {
          // Add primary owner email
          if (ownerData.email) {
            statementRecipients.push(ownerData.email);
          }
          // Add second owner email if exists
          if (ownerData.second_owner_email) {
            statementRecipients.push(ownerData.second_owner_email);
          }
        }
        
        // Always add info@ for live reconciliation statements
        if (!statementRecipients.includes("info@peachhausgroup.com")) {
          statementRecipients.push("info@peachhausgroup.com");
        }
      }
      
      const subjectPrefix = is_revised ? "REVISED " : "";
      const statementSubject = isTestEmail 
        ? `[TEST] ${subjectPrefix}Monthly Owner Statement - ${property.name} - ${previousMonthName}`
        : `${subjectPrefix}Monthly Owner Statement - ${property.name} - ${previousMonthName}`;

      console.log(`Sending statement to: ${statementRecipients.join(', ')} from ${fromEmail}...`);

      // Generate real PDF for attachment using pdf-lib
      let pdfAttachment: any = null;
      let pdfStoragePath: string | null = null;
      try {
        const pdfResponse = await fetch(`${supabaseUrl}/functions/v1/generate-statement-pdf`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ reconciliation_id }),
        });
        
        if (pdfResponse.ok) {
          const pdfData = await pdfResponse.json();
          if (pdfData.pdfBase64 && pdfData.fileName) {
            // Use real PDF binary from pdf-lib
            pdfAttachment = {
              filename: pdfData.fileName,
              content: pdfData.pdfBase64,
            };
            console.log(`Real PDF attachment generated: ${pdfData.fileName}`);
            
            // Store PDF in Supabase Storage for audit trail
            if (!isTestEmail) {
              try {
                const pdfBytes = Uint8Array.from(atob(pdfData.pdfBase64), c => c.charCodeAt(0));
                const storagePath = `${property.id}/${new Date().getFullYear()}/${pdfData.fileName}`;
                
                const { error: uploadError } = await supabase.storage
                  .from('statement-pdfs')
                  .upload(storagePath, pdfBytes, {
                    contentType: 'application/pdf',
                    upsert: true
                  });
                
                if (uploadError) {
                  console.error("Failed to store PDF in storage:", uploadError);
                } else {
                  pdfStoragePath = storagePath;
                  console.log(`PDF stored at: ${storagePath}`);
                }
              } catch (storageError) {
                console.error("Error storing PDF:", storageError);
              }
            }
          }
        } else {
          console.error("Failed to generate PDF:", await pdfResponse.text());
        }
      } catch (pdfError) {
        console.error("Error generating PDF for attachment:", pdfError);
      }

      // Send email with or without attachment
      const emailPayload: any = {
        from: fromEmail,
        to: statementRecipients,
        subject: statementSubject,
        html: emailBody,
      };
      
      if (pdfAttachment) {
        emailPayload.attachments = [pdfAttachment];
        console.log("Email will include PDF attachment");
      }

      statementResponse = await resend.emails.send(emailPayload);

      console.log("Statement email sent:", statementResponse);

      if (statementResponse.error) {
        throw statementResponse.error;
      }
      
      // ========== GREC AUDIT COMPLIANCE: Archive the statement ==========
      if (!isTestEmail) {
        const statementId = `PH-${new Date(previousMonthName).getFullYear()}${String(new Date(previousMonthName).getMonth() + 1).padStart(2, '0')}-${reconciliation_id.slice(0, 8).toUpperCase()}`;
        const statementMonth = new Date(previousMonthName);
        
        // Prepare line items snapshot for audit
        const lineItemsSnapshot = {
          visits: visits.map((v: any) => ({
            id: v.id,
            date: v.date,
            description: v.description || `Property visit - ${v.visited_by}`,
            amount: v.price,
            hours: v.hours,
            notes: v.notes
          })),
          expenses: expenses.map((e: any) => ({
            id: e.id,
            date: e.date,
            description: e.purpose || e.items_detail,
            amount: e.amount,
            category: e.category,
            vendor: e.vendor
          })),
          midTermProration: midTermProrationDetails,
          managementFee: managementFees,
          orderMinimumFee: orderMinimumFee,
          cleaningFees: cleaningFeesTotal,
          petFees: petFeesTotal
        };
        
        // Check if this is a revision
        const { data: existingStatements } = await supabase
          .from("owner_statement_archive")
          .select("revision_number")
          .eq("reconciliation_id", reconciliation_id)
          .order("revision_number", { ascending: false })
          .limit(1);
        
        const revisionNumber = existingStatements && existingStatements.length > 0 
          ? existingStatements[0].revision_number + 1 
          : 1;
        
        const archiveResult = await supabase
          .from("owner_statement_archive")
          .insert({
            reconciliation_id: reconciliation_id,
            property_id: property.id,
            owner_id: property.owner_id,
            statement_number: revisionNumber > 1 ? `${statementId}-R${revisionNumber}` : statementId,
            statement_date: new Date().toISOString().split('T')[0],
            statement_month: `${statementMonth.getFullYear()}-${String(statementMonth.getMonth() + 1).padStart(2, '0')}-01`,
            recipient_emails: statementRecipients,
            statement_html: emailBody,
            statement_pdf_path: pdfStoragePath, // Store PDF path for GREC audit
            net_owner_result: netIncome,
            total_revenue: totalRevenue,
            total_expenses: totalExpensesWithVisits,
            management_fee: managementFees,
            line_items_snapshot: lineItemsSnapshot,
            is_revision: revisionNumber > 1,
            revision_number: revisionNumber
          });
        
        if (archiveResult.error) {
          console.error("Failed to archive statement for GREC compliance:", archiveResult.error);
        } else {
          console.log(`✅ Statement archived for GREC compliance: ${statementId} (revision ${revisionNumber})`);
        }
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
              <img src="${LOGO_URL}" alt="PeachHaus Property Management" style="max-width: 280px; height: auto;" onerror="this.style.display='none';" />
            </div>

            <!-- Property Card with Image -->
            <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 16px; padding: 25px; margin: 20px 40px 35px 40px; border: 1px solid #dee2e6; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
              <div>
                <h2 style="margin: 0 0 8px 0; font-size: 22px; color: #2c3e50; font-weight: 600;">
                  ${property.name}
                </h2>
                <p style="margin: 0 0 8px 0; color: #6c757d; font-size: 15px; line-height: 1.5;">
                  📍 ${property.address}
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

            <!-- Performance Highlights -->
            <div style="padding: 35px 40px; background-color: #fafafa;">
              <h2 style="color: #FF7F00; margin: 0 0 20px 0; font-size: 22px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                Performance Highlights
              </h2>
              <div style="background-color: #ffffff; padding: 24px; border-radius: 8px; border-left: 4px solid #FF8C42;">
                ${bookingRevenue > 0 ? `
                <p style="color: #6c757d; font-size: 15px; margin: 0 0 12px 0;">
                  Short-term Revenue: <span style="color: #27ae60; font-weight: 600; font-size: 18px;">$${bookingRevenue.toFixed(2)}</span>
                </p>` : ''}
                ${midTermRevenue > 0 ? `
                <p style="color: #6c757d; font-size: 15px; margin: 0 0 12px 0;">
                  Mid-term Revenue: <span style="color: #27ae60; font-weight: 600; font-size: 18px;">$${midTermRevenue.toFixed(2)}</span>
                </p>` : ''}
                ${midTermBookings && midTermBookings.length > 0 ? `
                <p style="color: #6c757d; font-size: 15px; margin: 0 0 12px 0;">
                  Active Tenant: <span style="color: #8B5CF6; font-weight: 600; font-size: 16px;">${midTermBookings[0].tenant_name}</span>
                </p>` : ''}
                <p style="color: #6c757d; font-size: 15px; margin: 0;">
                  Total Revenue: <span style="color: #27ae60; font-weight: 700; font-size: 20px;">$${totalRevenue.toFixed(2)}</span>
                </p>
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

    // Determine subject and recipients based on email type and mode
    const isPerformanceEmail = emailTypeToSend === 'performance';
    const isOwnerStatement = emailTypeToSend === 'owner_statement';
    
    const performanceSubject = isTestEmail
      ? `[TEST] Property Performance Report - ${property.name} - ${previousMonthName}`
      : `Property Performance Report - ${property.name} - ${previousMonthName}`;

    const statementSubject = isTestEmail
      ? `[TEST] Monthly Owner Statement - ${property.name} - ${previousMonthName}`
      : `Monthly Owner Statement - ${property.name} - ${previousMonthName}`;
    
    // Determine recipients - include both primary and secondary owner emails
    let emailRecipients: string[] = [];
    
    if (isManualMode || isReconciliationMode) {
      // Get owner data with both emails
      const { data: ownerData } = await supabase
        .from("property_owners")
        .select("email, second_owner_email")
        .eq("id", property.owner_id)
        .maybeSingle();
      
      if (ownerData) {
        // Add primary owner email
        if (ownerData.email) {
          emailRecipients.push(ownerData.email);
        }
        // Add second owner email if exists
        if (ownerData.second_owner_email) {
          emailRecipients.push(ownerData.second_owner_email);
        }
      }
      
      // Add info@ if requested in manual mode
      if (isManualMode && sendCopyToInfo) {
        emailRecipients.push("info@peachhausgroup.com");
      }
    } else if (isTestEmail) {
      emailRecipients = [ownerEmail];
    } else {
      emailRecipients = [ownerEmail];
    }

    console.log(`Sending ${isPerformanceEmail ? 'performance' : 'owner statement'} email to: ${emailRecipients.join(', ')}...`);

    // Send performance email (test mode or manual send mode uses performanceEmailBody)
    performanceResponse = await resend.emails.send({
      from: fromEmail,
      to: emailRecipients,
      subject: performanceSubject,
      html: performanceEmailBody,
    });

    console.log("Performance email sent:", performanceResponse);

    if (performanceResponse.error) {
      console.error("Performance email error:", performanceResponse.error);
      throw performanceResponse.error;
    }
    } // End of performance email (NOT reconciliation mode)


    // If in reconciliation mode and NOT a test email, mark items as billed and update reconciliation status
    if (isReconciliationMode && !isTestEmail) {
      // ========== MARK ALL ITEMS AS BILLED ==========
      // Get all approved line items to mark their source records as billed
      const { data: approvedLineItems, error: lineItemsError } = await supabase
        .from("reconciliation_line_items")
        .select("item_id, item_type")
        .eq("reconciliation_id", reconciliation_id)
        .eq("verified", true)
        .eq("excluded", false);
      
      if (lineItemsError) {
        console.error("❌ Error fetching line items for billing:", lineItemsError);
      }
      
      console.log(`📋 BILLING WATCHDOG: Found ${approvedLineItems?.length || 0} approved line items to mark as billed`);
      
      if (approvedLineItems && approvedLineItems.length > 0) {
        // Log all line items for debugging
        approvedLineItems.forEach((item: any, idx: number) => {
          console.log(`  └ Item ${idx + 1}: type=${item.item_type}, id=${item.item_id}`);
        });
        
        // Extract unique visit IDs
        const visitLineItems = approvedLineItems.filter((item: any) => item.item_type === "visit");
        const visitIds = [...new Set(visitLineItems.map((item: any) => item.item_id))].filter(Boolean);
        
        // Extract unique expense IDs
        const expenseLineItems = approvedLineItems.filter((item: any) => item.item_type === "expense");
        const expenseIds = [...new Set(expenseLineItems.map((item: any) => item.item_id))].filter(Boolean);
        
        console.log(`📊 BILLING WATCHDOG: Processing ${visitIds.length} unique visits and ${expenseIds.length} unique expenses`);
        console.log(`  └ Visit IDs: ${JSON.stringify(visitIds)}`);
        console.log(`  └ Expense IDs: ${JSON.stringify(expenseIds)}`);
        
        // Mark visits as billed with reconciliation reference
        if (visitIds.length > 0) {
          const { data: updatedVisits, error: visitError } = await supabase
            .from("visits")
            .update({ 
              billed: true, 
              reconciliation_id: reconciliation_id 
            })
            .in("id", visitIds)
            .select("id");
          
          if (visitError) {
            console.error("❌ Error marking visits as billed:", visitError);
          } else {
            const actuallyUpdated = updatedVisits?.length || 0;
            console.log(`✅ Marked ${actuallyUpdated} visits as BILLED (requested: ${visitIds.length})`);
            
            // WATCHDOG: Check if all visits were marked
            if (actuallyUpdated !== visitIds.length) {
              console.warn(`⚠️ BILLING WATCHDOG: Mismatch! Expected to mark ${visitIds.length} visits, but only ${actuallyUpdated} were updated`);
              console.warn(`  └ Some visit IDs may not exist in visits table`);
            }
          }
        } else {
          console.log("ℹ️ No visits to mark as billed");
        }
        
        // Mark expenses as billed with reconciliation reference
        if (expenseIds.length > 0) {
          const { data: updatedExpenses, error: expenseError } = await supabase
            .from("expenses")
            .update({ 
              billed: true, 
              exported: true,  // Keep legacy field for compatibility
              reconciliation_id: reconciliation_id 
            })
            .in("id", expenseIds)
            .select("id");
          
          if (expenseError) {
            console.error("❌ Error marking expenses as billed:", expenseError);
          } else {
            const actuallyUpdated = updatedExpenses?.length || 0;
            console.log(`✅ Marked ${actuallyUpdated} expenses as BILLED (requested: ${expenseIds.length})`);
            
            // WATCHDOG: Check if all expenses were marked
            if (actuallyUpdated !== expenseIds.length) {
              console.warn(`⚠️ BILLING WATCHDOG: Mismatch! Expected to mark ${expenseIds.length} expenses, but only ${actuallyUpdated} were updated`);
            }
          }
        } else {
          console.log("ℹ️ No expenses to mark as billed");
        }
        
        console.log(`📧 STATEMENT SENT - Billing complete for reconciliation ${reconciliation_id}`);
      } else {
        console.warn("⚠️ No approved line items found to mark as billed");
      }

      // Calculate next month's 5th for deadline using reportDate
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
