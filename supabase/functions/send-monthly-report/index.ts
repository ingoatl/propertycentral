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
    console.log("Starting test monthly statement generation for Villa 14...");
    
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

    // Fetch Villa 14 property
    const { data: properties, error: propertiesError } = await supabase
      .from("properties")
      .select("*")
      .ilike("name", "%villa%14%");

    if (propertiesError) throw propertiesError;
    
    if (!properties || properties.length === 0) {
      throw new Error("Villa 14 not found");
    }

    const villa14 = properties[0];
    console.log("Found Villa 14:", villa14);

    // Fetch visits and expenses for this property (all time for demo)
    const { data: visits, error: visitsError } = await supabase
      .from("visits")
      .select("*")
      .eq("property_id", villa14.id)
      .order("date", { ascending: false });

    if (visitsError) throw visitsError;

    const { data: expenses, error: expensesError } = await supabase
      .from("expenses")
      .select("*")
      .eq("property_id", villa14.id)
      .order("date", { ascending: false });

    if (expensesError) throw expensesError;

    const { data: bookings, error: bookingsError } = await supabase
      .from("ownerrez_bookings")
      .select("*")
      .eq("property_id", villa14.id);

    if (bookingsError) throw bookingsError;

    console.log(`Found ${visits?.length || 0} visits, ${expenses?.length || 0} expenses, ${bookings?.length || 0} bookings`);

    // Generate signed URLs for expense documents
    const expenseDocuments: { [key: string]: string } = {};
    for (const expense of expenses || []) {
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

    // Calculate totals
    const visitTotal = (visits || []).reduce((sum, v) => sum + Number(v.price), 0);
    const expenseTotal = (expenses || []).reduce((sum, e) => sum + Number(e.amount), 0);
    const bookingRevenue = (bookings || []).reduce((sum, b) => sum + Number(b.total_amount), 0);
    const managementFees = (bookings || []).reduce((sum, b) => sum + Number(b.management_fee), 0);
    const netIncome = bookingRevenue - managementFees - expenseTotal;

    // Generate beautiful, friendly email
    let emailBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
          </style>
        </head>
        <body style="margin: 0; padding: 0; background: #f8f9fa;">
          <div style="max-width: 680px; margin: 0 auto; background: white;">
            
            <!-- Hero Header -->
            <div style="background: linear-gradient(135deg, #FF6B9D 0%, #C86DD7 50%, #8B5CF6 100%); padding: 50px 40px; text-align: center; position: relative; overflow: hidden;">
              <div style="position: relative; z-index: 2;">
                <div style="background: white; width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 25px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(0,0,0,0.15);">
                  <span style="font-size: 42px;">🏡</span>
                </div>
                <h1 style="margin: 0 0 12px 0; font-size: 36px; color: white; font-weight: 700; letter-spacing: -0.5px; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  Your Property Update
                </h1>
                <p style="margin: 0; font-size: 20px; color: rgba(255,255,255,0.95); font-weight: 300;">
                  ${previousMonthName}
                </p>
              </div>
            </div>

            <!-- Welcome Message -->
            <div style="padding: 45px 40px 35px;">
              <p style="font-size: 18px; line-height: 1.7; color: #2c3e50; margin: 0 0 20px 0; font-weight: 500;">
                Hello! 👋
              </p>
              
              <p style="font-size: 16px; line-height: 1.8; color: #34495e; margin: 0 0 30px 0;">
                We hope this message finds you well! We're excited to share your property's performance for <strong style="color: #8B5CF6;">${previousMonthName}</strong>. 
                Your trust means everything to us, and we're committed to maximizing your investment while keeping you informed every step of the way.
              </p>

              <!-- Property Info Card -->
              <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 16px; padding: 25px; margin-bottom: 35px; border: 1px solid #dee2e6;">
                <div style="display: flex; align-items: start; gap: 15px;">
                  <div style="background: linear-gradient(135deg, #FF6B9D, #C86DD7); width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <span style="font-size: 24px;">🏠</span>
                  </div>
                  <div style="flex: 1;">
                    <h2 style="margin: 0 0 8px 0; font-size: 22px; color: #2c3e50; font-weight: 600;">
                      ${villa14.name}
                    </h2>
                    <p style="margin: 0; color: #6c757d; font-size: 15px; line-height: 1.5;">
                      📍 ${villa14.address}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Financial Summary -->
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 35px; border-radius: 16px; margin-bottom: 35px; box-shadow: 0 10px 30px rgba(102, 126, 234, 0.25);">
                <h2 style="color: white; margin: 0 0 25px 0; font-size: 24px; font-weight: 600; text-align: center;">
                  💰 Financial Summary
                </h2>
                <table style="width: 100%; border-collapse: separate; border-spacing: 0 12px;">
                  <tr>
                    <td style="background: rgba(255,255,255,0.15); padding: 18px 22px; border-radius: 10px; backdrop-filter: blur(10px);">
                      <p style="margin: 0 0 8px 0; color: rgba(255,255,255,0.9); font-size: 13px; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 500;">Booking Revenue</p>
                      <p style="margin: 0; color: white; font-size: 32px; font-weight: 700;">${bookingRevenue > 0 ? '$' + bookingRevenue.toFixed(2) : '$0.00'}</p>
                    </td>
                  </tr>
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

    // Add Visits Section if there are any
    if (visits && visits.length > 0) {
      emailBody += `
              <div style="margin-bottom: 35px;">
                <h3 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 22px; font-weight: 600; display: flex; align-items: center; gap: 10px;">
                  <span style="background: linear-gradient(135deg, #667eea, #764ba2); width: 38px; height: 38px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 18px;">🏃</span>
                  Property Visits
                </h3>
                <p style="color: #6c757d; margin: 0 0 20px 0; font-size: 15px;">
                  Our team made ${visits.length} visit${visits.length > 1 ? 's' : ''} to ensure your property is in perfect condition.
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

    // Closing Message
    emailBody += `
              <div style="background: linear-gradient(to right, #f8f9fa, #e9ecef); border-radius: 16px; padding: 30px; margin-top: 40px; border-left: 5px solid #8B5CF6;">
                <h3 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 20px; font-weight: 600;">
                  Thank You for Your Trust! 🙏
                </h3>
                <p style="margin: 0 0 15px 0; color: #34495e; font-size: 15px; line-height: 1.7;">
                  We're honored to manage your property and remain dedicated to providing exceptional service. 
                  Your property is in great hands, and we're always working to maximize your returns while maintaining the highest standards of care.
                </p>
                <p style="margin: 0 0 20px 0; color: #34495e; font-size: 15px; line-height: 1.7;">
                  Have questions or want to discuss anything? We're just a message away! Feel free to reach out anytime.
                </p>
                <p style="margin: 0; color: #2c3e50; font-size: 15px; line-height: 1.5;">
                  <strong style="color: #8B5CF6; font-size: 16px;">Warm regards,</strong><br>
                  <strong>The PeachHaus Team</strong> 🍑<br>
                  <span style="color: #6c757d; font-size: 14px;">Your Partner in Property Excellence</span>
                </p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background: linear-gradient(135deg, #2c3e50, #34495e); padding: 30px 40px; text-align: center; color: #ecf0f1;">
              <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 500;">
                📊 Statement Generated: ${reportDate}
              </p>
              <p style="margin: 0; color: #95a5a6; font-size: 13px;">
                © ${new Date().getFullYear()} PeachHaus Property Management | Excellence in Every Detail
              </p>
            </div>
          </div>
        </body>
      </html>`;

    console.log("Sending beautiful test email to ingo@peachhausgroup.com...");

    // Send email via Resend
    const emailResponse = await resend.emails.send({
      from: "PeachHaus Property Management <reports@peachhausgroup.com>",
      to: ["ingo@peachhausgroup.com"],
      subject: `🏡 Your ${villa14.name} Update for ${previousMonthName}`,
      html: emailBody,
    });

    console.log("Email sent:", emailResponse);

    if (emailResponse.error) {
      throw emailResponse.error;
    }

    console.log("Test email sent successfully!");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Test email sent successfully to ingo@peachhausgroup.com",
        emailId: emailResponse.data?.id,
        property: villa14.name,
        stats: {
          visits: visits?.length || 0,
          expenses: expenses?.length || 0,
          revenue: bookingRevenue,
          netIncome: netIncome
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
