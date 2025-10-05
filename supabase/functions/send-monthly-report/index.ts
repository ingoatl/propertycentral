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
    const reportDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    let emailBody = `<h1>PeachHaus Property Report - ${reportDate}</h1>`;
    emailBody += `<h2>SUMMARY</h2>`;
    emailBody += `<table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">`;
    emailBody += `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Total Properties:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${properties?.length || 0}</td></tr>`;
    emailBody += `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Total Visits:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${totalVisits}</td></tr>`;
    emailBody += `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Total Revenue:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">$${totalRevenue.toFixed(2)}</td></tr>`;
    emailBody += `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Total Expenses:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">$${totalExpenses.toFixed(2)}</td></tr>`;
    emailBody += `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Net Balance:</strong></td><td style="padding: 8px; border: 1px solid #ddd;"><strong>$${totalNet.toFixed(2)}</strong></td></tr>`;
    emailBody += `</table>`;

    emailBody += `<h2>PROPERTY PERFORMANCE</h2>`;
    summaries.forEach(summary => {
      emailBody += `<div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; background-color: #f9f9f9;">`;
      emailBody += `<h3>${summary.name}</h3>`;
      emailBody += `<p><strong>Address:</strong> ${summary.address}</p>`;
      emailBody += `<p><strong>Visit Rate:</strong> $${summary.visitPrice.toFixed(2)}</p>`;
      emailBody += `<p><strong>Visits:</strong> ${summary.visitCount} | <strong>Revenue:</strong> $${summary.visitTotal.toFixed(2)}</p>`;
      emailBody += `<p><strong>Expenses:</strong> $${summary.expenseTotal.toFixed(2)} | <strong>Net:</strong> $${summary.netBalance.toFixed(2)}</p>`;
      emailBody += `</div>`;
    });

    emailBody += `<h2>DETAILED VISITS LOG</h2>`;
    emailBody += `<table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">`;
    emailBody += `<tr><th style="padding: 8px; border: 1px solid #ddd; background-color: #f0f0f0;">Date</th><th style="padding: 8px; border: 1px solid #ddd; background-color: #f0f0f0;">Property</th><th style="padding: 8px; border: 1px solid #ddd; background-color: #f0f0f0;">Amount</th><th style="padding: 8px; border: 1px solid #ddd; background-color: #f0f0f0;">Notes</th></tr>`;
    (visits || []).forEach(visit => {
      const property = properties?.find(p => p.id === visit.property_id);
      emailBody += `<tr><td style="padding: 8px; border: 1px solid #ddd;">${visit.date}</td><td style="padding: 8px; border: 1px solid #ddd;">${property?.name || 'Unknown'}</td><td style="padding: 8px; border: 1px solid #ddd;">$${Number(visit.price).toFixed(2)}</td><td style="padding: 8px; border: 1px solid #ddd;">${visit.notes || '-'}</td></tr>`;
    });
    emailBody += `</table>`;

    emailBody += `<h2>DETAILED EXPENSES LOG</h2>`;
    emailBody += `<table style="border-collapse: collapse; width: 100%;">`;
    emailBody += `<tr><th style="padding: 8px; border: 1px solid #ddd; background-color: #f0f0f0;">Date</th><th style="padding: 8px; border: 1px solid #ddd; background-color: #f0f0f0;">Property</th><th style="padding: 8px; border: 1px solid #ddd; background-color: #f0f0f0;">Amount</th><th style="padding: 8px; border: 1px solid #ddd; background-color: #f0f0f0;">Purpose</th></tr>`;
    (expenses || []).forEach(expense => {
      const property = properties?.find(p => p.id === expense.property_id);
      emailBody += `<tr><td style="padding: 8px; border: 1px solid #ddd;">${expense.date}</td><td style="padding: 8px; border: 1px solid #ddd;">${property?.name || 'Unknown'}</td><td style="padding: 8px; border: 1px solid #ddd;">$${Number(expense.amount).toFixed(2)}</td><td style="padding: 8px; border: 1px solid #ddd;">${expense.purpose || '-'}</td></tr>`;
    });
    emailBody += `</table>`;

    console.log("Email body generated, sending via Resend...");

    // Send email via Resend
    // Note: Currently sending to admin@peachhausgroup.com (your verified email)
    // To send to anja@peachhausgroup.com, verify your domain at resend.com/domains
    const emailResponse = await resend.emails.send({
      from: "PeachHaus Reports <onboarding@resend.dev>",
      to: ["admin@peachhausgroup.com"], // Sending to verified email
      subject: `PeachHaus Monthly Report - ${reportDate}`,
      html: emailBody,
    });

    console.log("Resend response:", emailResponse);

    if (emailResponse.error) {
      throw emailResponse.error;
    }

    console.log("Monthly report sent successfully to admin@peachhausgroup.com!");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Monthly report sent successfully to admin@peachhausgroup.com",
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
