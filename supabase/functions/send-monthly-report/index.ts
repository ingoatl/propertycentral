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
    console.log("Starting monthly report generation...");
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all data
    const { data: properties, error: propertiesError } = await supabase
      .from("properties")
      .select("*")
      .order("name");

    if (propertiesError) throw propertiesError;

    const { data: visits, error: visitsError } = await supabase
      .from("visits")
      .select("*");

    if (visitsError) throw visitsError;

    const { data: expenses, error: expensesError } = await supabase
      .from("expenses")
      .select("*");

    if (expensesError) throw expensesError;

    console.log(`Found ${properties?.length || 0} properties, ${visits?.length || 0} visits, ${expenses?.length || 0} expenses`);

    // Calculate summaries
    const summaries = (properties || []).map(property => {
      const propertyVisits = (visits || []).filter(v => v.property_id === property.id);
      const propertyExpenses = (expenses || []).filter(e => e.property_id === property.id);
      
      const visitTotal = propertyVisits.reduce((sum, v) => sum + Number(v.price), 0);
      const expenseTotal = propertyExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

      return {
        name: property.name,
        address: property.address,
        visitPrice: Number(property.visit_price),
        visitCount: propertyVisits.length,
        visitTotal,
        expenseTotal,
        netBalance: visitTotal - expenseTotal,
      };
    });

    const totalVisits = summaries.reduce((sum, s) => sum + s.visitCount, 0);
    const totalRevenue = summaries.reduce((sum, s) => sum + s.visitTotal, 0);
    const totalExpenses = summaries.reduce((sum, s) => sum + s.expenseTotal, 0);
    const totalNet = totalRevenue - totalExpenses;

    // Generate email body with formatted report
    const now = new Date();
    const currentMonth = now.toLocaleDateString('en-US', { 
      month: 'long',
      year: 'numeric'
    });
    
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonthName = previousMonth.toLocaleDateString('en-US', { 
      month: 'long',
      year: 'numeric'
    });

    const reportDate = now.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    let emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; color: white;">
          <h1 style="margin: 0 0 10px 0; font-size: 28px;">PeachHaus Property Report</h1>
          <p style="margin: 0; font-size: 16px; opacity: 0.9;">${previousMonthName} - ${currentMonth}</p>
        </div>
        
        <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-top: none;">
          <p style="font-size: 16px; line-height: 1.6; color: #333; margin-top: 0;">Dear Anja,</p>
          
          <p style="font-size: 16px; line-height: 1.6; color: #333;">
            I hope this email finds you well! Please find below the comprehensive property report for 
            <strong>${previousMonthName}</strong> through <strong>${currentMonth}</strong>.
          </p>
          
          <p style="font-size: 16px; line-height: 1.6; color: #333; background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; border-radius: 4px;">
            <strong>⚠️ Action Required:</strong> Please review the visit logs below and proceed with billing the respective clients accordingly. 
            All visit details and corresponding properties are listed for your reference.
          </p>

          <h2 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px; margin-top: 30px;">📊 Executive Summary</h2>
          <table style="border-collapse: collapse; width: 100%; margin-bottom: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <tr style="background: #f8f9fa;">
              <td style="padding: 15px; border: 1px solid #ddd; font-weight: bold; color: #495057;">Total Properties</td>
              <td style="padding: 15px; border: 1px solid #ddd; text-align: right; font-size: 18px;">${properties?.length || 0}</td>
            </tr>
            <tr>
              <td style="padding: 15px; border: 1px solid #ddd; font-weight: bold; color: #495057;">Total Visits</td>
              <td style="padding: 15px; border: 1px solid #ddd; text-align: right; font-size: 18px;">${totalVisits}</td>
            </tr>
            <tr style="background: #f8f9fa;">
              <td style="padding: 15px; border: 1px solid #ddd; font-weight: bold; color: #495057;">Total Revenue</td>
              <td style="padding: 15px; border: 1px solid #ddd; text-align: right; font-size: 18px; color: #28a745; font-weight: bold;">$${totalRevenue.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 15px; border: 1px solid #ddd; font-weight: bold; color: #495057;">Total Expenses</td>
              <td style="padding: 15px; border: 1px solid #ddd; text-align: right; font-size: 18px; color: #dc3545;">$${totalExpenses.toFixed(2)}</td>
            </tr>
          </table>

          <h2 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px; margin-top: 30px;">🏠 Property Performance</h2>`;
    
    summaries.forEach(summary => {
      emailBody += `
        <div style="border: 1px solid #e0e0e0; padding: 20px; margin-bottom: 20px; background: linear-gradient(to right, #f8f9fa, #ffffff); border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
          <h3 style="color: #667eea; margin-top: 0; font-size: 20px;">${summary.name}</h3>
          <p style="color: #6c757d; margin: 5px 0;"><strong>📍 Address:</strong> ${summary.address}</p>
          <p style="color: #6c757d; margin: 5px 0;"><strong>💰 Visit Rate:</strong> $${summary.visitPrice.toFixed(2)}</p>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 15px;">
            <div style="background: white; padding: 10px; border-radius: 4px; border-left: 3px solid #17a2b8;">
              <strong>Visits:</strong> ${summary.visitCount} | <strong style="color: #28a745;">Revenue:</strong> $${summary.visitTotal.toFixed(2)}
            </div>
            <div style="background: white; padding: 10px; border-radius: 4px; border-left: 3px solid #dc3545;">
              <strong style="color: #dc3545;">Expenses:</strong> $${summary.expenseTotal.toFixed(2)}
            </div>
          </div>
        </div>`;
    });

    emailBody += `
          <h2 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px; margin-top: 40px;">📋 Detailed Visits Log</h2>
          <p style="color: #6c757d; margin-bottom: 15px;">Please use this information to bill the respective clients.</p>
          <table style="border-collapse: collapse; width: 100%; margin-bottom: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <tr style="background: #667eea; color: white;">
              <th style="padding: 12px; border: 1px solid #5568d3; text-align: left;">Date</th>
              <th style="padding: 12px; border: 1px solid #5568d3; text-align: left;">Property</th>
              <th style="padding: 12px; border: 1px solid #5568d3; text-align: right;">Amount</th>
              <th style="padding: 12px; border: 1px solid #5568d3; text-align: left;">Notes</th>
            </tr>`;
    
    (visits || []).forEach((visit, index) => {
      const property = properties?.find(p => p.id === visit.property_id);
      const bgColor = index % 2 === 0 ? '#f8f9fa' : '#ffffff';
      emailBody += `
            <tr style="background: ${bgColor};">
              <td style="padding: 12px; border: 1px solid #ddd;">${new Date(visit.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
              <td style="padding: 12px; border: 1px solid #ddd;"><strong>${property?.name || 'Unknown'}</strong></td>
              <td style="padding: 12px; border: 1px solid #ddd; text-align: right; color: #28a745; font-weight: bold;">$${Number(visit.price).toFixed(2)}</td>
              <td style="padding: 12px; border: 1px solid #ddd; color: #6c757d;">${visit.notes || '-'}</td>
            </tr>`;
    });
    
    emailBody += `
          </table>

          <h2 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px; margin-top: 40px;">💳 Detailed Expenses Log</h2>
          <table style="border-collapse: collapse; width: 100%; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <tr style="background: #dc3545; color: white;">
              <th style="padding: 12px; border: 1px solid #c82333; text-align: left;">Date</th>
              <th style="padding: 12px; border: 1px solid #c82333; text-align: left;">Property</th>
              <th style="padding: 12px; border: 1px solid #c82333; text-align: right;">Amount</th>
              <th style="padding: 12px; border: 1px solid #c82333; text-align: left;">Purpose</th>
            </tr>`;
    
    (expenses || []).forEach((expense, index) => {
      const property = properties?.find(p => p.id === expense.property_id);
      const bgColor = index % 2 === 0 ? '#f8f9fa' : '#ffffff';
      emailBody += `
            <tr style="background: ${bgColor};">
              <td style="padding: 12px; border: 1px solid #ddd;">${new Date(expense.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
              <td style="padding: 12px; border: 1px solid #ddd;"><strong>${property?.name || 'Unknown'}</strong></td>
              <td style="padding: 12px; border: 1px solid #ddd; text-align: right; color: #dc3545; font-weight: bold;">$${Number(expense.amount).toFixed(2)}</td>
              <td style="padding: 12px; border: 1px solid #ddd; color: #6c757d;">${expense.purpose || '-'}</td>
            </tr>`;
    });
    
    emailBody += `
          </table>

          <div style="margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 4px solid #667eea;">
            <p style="margin: 0 0 10px 0; color: #333; font-size: 16px;">
              Please review the above information and proceed with client billing at your earliest convenience. 
              If you have any questions or need clarification on any of the entries, please don't hesitate to reach out.
            </p>
            <p style="margin: 0; color: #333; font-size: 16px;">
              Best regards,<br>
              <strong>PeachHaus Property Management System</strong>
            </p>
          </div>
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 10px 10px; color: #6c757d; font-size: 14px;">
          Report generated on ${reportDate}
        </div>
      </div>`;

    console.log("Email body generated, sending via Resend to anja@peachhausgroup.com...");

    // Send email via Resend - using verified domain
    const emailResponse = await resend.emails.send({
      from: "PeachHaus Reports <reports@peachhausgroup.com>",
      to: ["anja@peachhausgroup.com"],
      subject: `Property Report ${previousMonthName} - ${currentMonth} | Please Bill Clients`,
      html: emailBody,
    });

    console.log("Resend response:", emailResponse);

    if (emailResponse.error) {
      throw emailResponse.error;
    }

    console.log("Monthly report sent successfully to anja@peachhausgroup.com!");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Monthly report sent successfully to anja@peachhausgroup.com",
        emailId: emailResponse.data?.id,
        stats: {
          properties: properties?.length || 0,
          visits: totalVisits,
          revenue: totalRevenue,
          expenses: totalExpenses,
          net: totalNet
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
    console.error("Error generating/sending monthly report:", error);
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
