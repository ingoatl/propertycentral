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
    console.log("Starting monthly statement generation...");
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current and previous month dates
    const now = new Date();
    const firstDayOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfPreviousMonth = new Date(firstDayOfCurrentMonth.getTime() - 1);
    const firstDayOfPreviousMonth = new Date(lastDayOfPreviousMonth.getFullYear(), lastDayOfPreviousMonth.getMonth(), 1);
    
    const previousMonthName = firstDayOfPreviousMonth.toLocaleDateString('en-US', { 
      month: 'long',
      year: 'numeric'
    });

    const reportDate = now.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Fetch property owners
    const { data: owners, error: ownersError } = await supabase
      .from("property_owners")
      .select("*");

    if (ownersError) throw ownersError;

    // Fetch all properties with owner relationships
    const { data: properties, error: propertiesError } = await supabase
      .from("properties")
      .select("*")
      .order("name");

    if (propertiesError) throw propertiesError;

    // Fetch visits and expenses for the previous month
    const { data: visits, error: visitsError } = await supabase
      .from("visits")
      .select("*")
      .gte("date", firstDayOfPreviousMonth.toISOString().split('T')[0])
      .lte("date", lastDayOfPreviousMonth.toISOString().split('T')[0]);

    if (visitsError) throw visitsError;

    const { data: expenses, error: expensesError } = await supabase
      .from("expenses")
      .select("*")
      .gte("date", firstDayOfPreviousMonth.toISOString().split('T')[0])
      .lte("date", lastDayOfPreviousMonth.toISOString().split('T')[0]);

    if (expensesError) throw expensesError;

    const { data: bookings, error: bookingsError } = await supabase
      .from("ownerrez_bookings")
      .select("*");

    if (bookingsError) throw bookingsError;

    console.log(`Found ${owners?.length || 0} owners, ${properties?.length || 0} properties, ${visits?.length || 0} visits, ${expenses?.length || 0} expenses`);

    // Group properties by owner and send individual statements
    const emailsSent = [];
    
    for (const owner of owners || []) {
      const ownerProperties = (properties || []).filter(p => p.owner_id === owner.id);
      
      if (ownerProperties.length === 0) {
        console.log(`Owner ${owner.name} has no properties, skipping...`);
        continue;
      }

      // Calculate owner's property summaries
      const ownerSummaries = ownerProperties.map(property => {
        const propertyVisits = (visits || []).filter(v => v.property_id === property.id);
        const propertyExpenses = (expenses || []).filter(e => e.property_id === property.id);
        const propertyBookings = (bookings || []).filter(b => b.property_id === property.id);
        
        const visitTotal = propertyVisits.reduce((sum, v) => sum + Number(v.price), 0);
        const expenseTotal = propertyExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
        const bookingRevenue = propertyBookings.reduce((sum, b) => sum + Number(b.total_amount), 0);
        const managementFees = propertyBookings.reduce((sum, b) => sum + Number(b.management_fee), 0);

        return {
          property,
          visitCount: propertyVisits.length,
          visitTotal,
          expenseTotal,
          bookingRevenue,
          managementFees,
          visits: propertyVisits,
          expenses: propertyExpenses,
        };
      });

      const ownerTotalVisits = ownerSummaries.reduce((sum, s) => sum + s.visitCount, 0);
      const ownerTotalExpenses = ownerSummaries.reduce((sum, s) => sum + s.expenseTotal, 0);
      const ownerTotalRevenue = ownerSummaries.reduce((sum, s) => sum + s.bookingRevenue, 0);
      const ownerTotalManagementFees = ownerSummaries.reduce((sum, s) => sum + s.managementFees, 0);
      const ownerNetIncome = ownerTotalRevenue - ownerTotalManagementFees - ownerTotalExpenses;

      // Generate signed URLs for expense documents
      const expenseDocuments: { [key: string]: string } = {};
      for (const summary of ownerSummaries) {
        for (const expense of summary.expenses) {
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
      }

      // Generate professional monthly statement email
      let emailBody = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 900px; margin: 0 auto; background: #f5f5f5;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #FF6B9D 0%, #C86DD7 100%); padding: 40px 30px; text-align: center;">
            <div style="background: white; width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 20px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <span style="font-size: 30px;">🏠</span>
            </div>
            <h1 style="margin: 0 0 10px 0; font-size: 32px; color: white; font-weight: 600; letter-spacing: -0.5px;">Monthly Property Statement</h1>
            <p style="margin: 0; font-size: 18px; color: rgba(255,255,255,0.95); font-weight: 300;">${previousMonthName}</p>
          </div>
          
          <div style="background: white; padding: 40px 30px;">
            <!-- Greeting -->
            <p style="font-size: 18px; line-height: 1.8; color: #2c3e50; margin: 0 0 20px 0;">Dear ${owner.name},</p>
            
            <p style="font-size: 16px; line-height: 1.8; color: #34495e; margin: 0 0 30px 0;">
              We're pleased to present your monthly property statement for <strong>${previousMonthName}</strong>. 
              We continue to work diligently to maximize your returns while maintaining the highest standards of property care.
            </p>

            <!-- Financial Summary Card -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; margin-bottom: 35px; box-shadow: 0 6px 20px rgba(102, 126, 234, 0.3);">
              <h2 style="color: white; margin: 0 0 25px 0; font-size: 24px; font-weight: 600;">📊 Financial Summary</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="background: rgba(255,255,255,0.15); padding: 20px; border-radius: 8px; width: 48%; vertical-align: top;">
                    <p style="margin: 0 0 8px 0; color: rgba(255,255,255,0.9); font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Total Revenue</p>
                    <p style="margin: 0; color: white; font-size: 28px; font-weight: bold;">$${ownerTotalRevenue.toFixed(2)}</p>
                  </td>
                  <td style="width: 4%;"></td>
                  <td style="background: rgba(255,255,255,0.15); padding: 20px; border-radius: 8px; width: 48%; vertical-align: top;">
                    <p style="margin: 0 0 8px 0; color: rgba(255,255,255,0.9); font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Management Fees</p>
                    <p style="margin: 0; color: white; font-size: 28px; font-weight: bold;">$${ownerTotalManagementFees.toFixed(2)}</p>
                  </td>
                </tr>
                <tr><td colspan="3" style="height: 20px;"></td></tr>
                <tr>
                  <td style="background: rgba(255,255,255,0.15); padding: 20px; border-radius: 8px; vertical-align: top;">
                    <p style="margin: 0 0 8px 0; color: rgba(255,255,255,0.9); font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Total Expenses</p>
                    <p style="margin: 0; color: white; font-size: 28px; font-weight: bold;">$${ownerTotalExpenses.toFixed(2)}</p>
                  </td>
                  <td></td>
                  <td style="background: rgba(255,255,255,0.15); padding: 20px; border-radius: 8px; vertical-align: top;">
                    <p style="margin: 0 0 8px 0; color: rgba(255,255,255,0.9); font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Net Income</p>
                    <p style="margin: 0; color: ${ownerNetIncome >= 0 ? '#4ade80' : '#f87171'}; font-size: 28px; font-weight: bold;">$${ownerNetIncome.toFixed(2)}</p>
                  </td>
                </tr>
              </table>
              <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.2);">
                <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                  <strong>Property Visits This Month:</strong> ${ownerTotalVisits} visits
                </p>
              </div>
            </div>`;
      
      // Add property details
      ownerSummaries.forEach(summary => {
        const propertyNetIncome = summary.bookingRevenue - summary.managementFees - summary.expenseTotal;
        
        emailBody += `
            <!-- Property Card -->
            <div style="border: 1px solid #e0e0e0; padding: 25px; margin-bottom: 25px; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 2px solid #f0f0f0;">
                <tr>
                  <td style="vertical-align: top;">
                    <h3 style="color: #2c3e50; margin: 0 0 8px 0; font-size: 22px; font-weight: 600;">${summary.property.name}</h3>
                    <p style="color: #7f8c8d; margin: 0; font-size: 15px;">📍 ${summary.property.address}</p>
                  </td>
                  <td style="text-align: right; vertical-align: top;">
                    <p style="margin: 0 0 5px 0; color: #95a5a6; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Net Income</p>
                    <p style="margin: 0; color: ${propertyNetIncome >= 0 ? '#27ae60' : '#e74c3c'}; font-size: 26px; font-weight: bold;">$${propertyNetIncome.toFixed(2)}</p>
                  </td>
                </tr>
              </table>
              
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr>
                  <td style="background: #ecf0f1; padding: 15px; border-radius: 8px; text-align: center; width: 31%;">
                    <p style="margin: 0 0 5px 0; color: #7f8c8d; font-size: 12px; text-transform: uppercase;">Revenue</p>
                    <p style="margin: 0; color: #2c3e50; font-size: 20px; font-weight: 600;">$${summary.bookingRevenue.toFixed(2)}</p>
                  </td>
                  <td style="width: 3.5%;"></td>
                  <td style="background: #ecf0f1; padding: 15px; border-radius: 8px; text-align: center; width: 31%;">
                    <p style="margin: 0 0 5px 0; color: #7f8c8d; font-size: 12px; text-transform: uppercase;">Mgmt Fees</p>
                    <p style="margin: 0; color: #2c3e50; font-size: 20px; font-weight: 600;">$${summary.managementFees.toFixed(2)}</p>
                  </td>
                  <td style="width: 3.5%;"></td>
                  <td style="background: #ecf0f1; padding: 15px; border-radius: 8px; text-align: center; width: 31%;">
                    <p style="margin: 0 0 5px 0; color: #7f8c8d; font-size: 12px; text-transform: uppercase;">Visits</p>
                    <p style="margin: 0; color: #2c3e50; font-size: 20px; font-weight: 600;">${summary.visitCount}</p>
                  </td>
                </tr>
              </table>`;

        // Add visit details for this property
        if (summary.visits.length > 0) {
          emailBody += `
              <div style="margin-top: 20px;">
                <h4 style="color: #667eea; margin: 0 0 12px 0; font-size: 16px;">Visit Details</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">`;
          
          summary.visits.forEach((visit, idx) => {
            const bgColor = idx % 2 === 0 ? '#f8f9fa' : '#ffffff';
            emailBody += `
                  <tr style="background: ${bgColor};">
                    <td style="padding: 10px; border: 1px solid #dee2e6;">${new Date(visit.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td style="padding: 10px; border: 1px solid #dee2e6; text-align: right; color: #27ae60; font-weight: 600;">$${Number(visit.price).toFixed(2)}</td>
                    <td style="padding: 10px; border: 1px solid #dee2e6; color: #7f8c8d;">${visit.notes || 'No notes'}</td>
                  </tr>`;
          });
          
          emailBody += `
                </table>
              </div>`;
        }

        // Add expense details for this property
        if (summary.expenses.length > 0) {
          emailBody += `
              <div style="margin-top: 20px;">
                <h4 style="color: #e74c3c; margin: 0 0 12px 0; font-size: 16px;">💳 Expense Details</h4>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">`;
          
          summary.expenses.forEach((expense, idx) => {
            const bgColor = idx % 2 === 0 ? '#f8f9fa' : '#ffffff';
            const hasReceipt = expenseDocuments[expense.id];
            
            emailBody += `
                  <tr style="background: ${bgColor};">
                    <td style="padding: 10px; border: 1px solid #dee2e6;">${new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td style="padding: 10px; border: 1px solid #dee2e6; text-align: right; color: #e74c3c; font-weight: 600;">$${Number(expense.amount).toFixed(2)}</td>
                    <td style="padding: 10px; border: 1px solid #dee2e6; color: #7f8c8d;">${expense.purpose || 'No description'}</td>
                    <td style="padding: 10px; border: 1px solid #dee2e6; text-align: center;">
                      ${hasReceipt ? `<a href="${expenseDocuments[expense.id]}" style="color: #667eea; text-decoration: none; font-weight: 600;">📄 View Receipt</a>` : '—'}
                    </td>
                  </tr>`;
          });
          
          emailBody += `
                </table>
              </div>`;
        }

        emailBody += `
            </div>`;
      });

      // Footer
      emailBody += `
            <div style="margin-top: 40px; padding: 25px; background: linear-gradient(to right, #f8f9fa, #e9ecef); border-radius: 12px; border-left: 4px solid #667eea;">
              <h3 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 18px;">Thank You for Your Trust</h3>
              <p style="margin: 0 0 10px 0; color: #34495e; font-size: 15px; line-height: 1.7;">
                We remain committed to providing exceptional property management services and maximizing your investment returns. 
                If you have any questions about this statement or would like to discuss your properties, please don't hesitate to contact us.
              </p>
              <p style="margin: 0; color: #34495e; font-size: 15px;">
                <strong style="color: #667eea;">PeachHaus Property Management</strong><br>
                Excellence in Property Care & Management
              </p>
            </div>
          </div>
          
          <div style="background: #2c3e50; padding: 20px; text-align: center; color: #ecf0f1; font-size: 13px;">
            <p style="margin: 0 0 5px 0;">Statement generated on ${reportDate}</p>
            <p style="margin: 0; color: #95a5a6;">© ${new Date().getFullYear()} PeachHaus Property Management. All rights reserved.</p>
          </div>
        </div>`;

      console.log(`Sending statement to ${owner.name} (${owner.email})...`);

      // Send email via Resend
      const emailResponse = await resend.emails.send({
        from: "PeachHaus Property Management <reports@peachhausgroup.com>",
        to: [owner.email],
        subject: `Your Property Statement for ${previousMonthName}`,
        html: emailBody,
      });

      console.log(`Email sent to ${owner.email}:`, emailResponse);

      if (emailResponse.error) {
        console.error(`Failed to send to ${owner.email}:`, emailResponse.error);
      } else {
        emailsSent.push({
          owner: owner.name,
          email: owner.email,
          emailId: emailResponse.data?.id,
          properties: ownerProperties.length,
          netIncome: ownerNetIncome
        });
      }
    }

    console.log(`Successfully sent ${emailsSent.length} monthly statements`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Monthly statements sent to ${emailsSent.length} property owners`,
        emailsSent
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
    console.error("Error generating/sending monthly statements:", error);
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
