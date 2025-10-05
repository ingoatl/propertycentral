import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    let emailBody = `PeachHaus Property Report - ${reportDate}\n\n`;
    emailBody += `SUMMARY\n`;
    emailBody += `========================================\n`;
    emailBody += `Total Properties: ${properties?.length || 0}\n`;
    emailBody += `Total Visits: ${totalVisits}\n`;
    emailBody += `Total Revenue: $${totalRevenue.toFixed(2)}\n`;
    emailBody += `Total Expenses: $${totalExpenses.toFixed(2)}\n`;
    emailBody += `Net Balance: $${totalNet.toFixed(2)}\n\n`;

    emailBody += `PROPERTY PERFORMANCE\n`;
    emailBody += `========================================\n\n`;

    summaries.forEach(summary => {
      emailBody += `${summary.name}\n`;
      emailBody += `Address: ${summary.address}\n`;
      emailBody += `Visit Rate: $${summary.visitPrice.toFixed(2)}\n`;
      emailBody += `Visits: ${summary.visitCount}\n`;
      emailBody += `Revenue: $${summary.visitTotal.toFixed(2)}\n`;
      emailBody += `Expenses: $${summary.expenseTotal.toFixed(2)}\n`;
      emailBody += `Net: $${summary.netBalance.toFixed(2)}\n`;
      emailBody += `----------------------------------------\n\n`;
    });

    // Add detailed visit and expense logs
    emailBody += `DETAILED VISITS LOG\n`;
    emailBody += `========================================\n`;
    (visits || []).forEach(visit => {
      const property = properties?.find(p => p.id === visit.property_id);
      emailBody += `${visit.date} - ${property?.name || 'Unknown'} - $${Number(visit.price).toFixed(2)}${visit.notes ? ' - ' + visit.notes : ''}\n`;
    });

    emailBody += `\n\nDETAILED EXPENSES LOG\n`;
    emailBody += `========================================\n`;
    (expenses || []).forEach(expense => {
      const property = properties?.find(p => p.id === expense.property_id);
      emailBody += `${expense.date} - ${property?.name || 'Unknown'} - $${Number(expense.amount).toFixed(2)}${expense.purpose ? ' - ' + expense.purpose : ''}\n`;
    });

    console.log("Email body generated, sending via FormSubmit...");

    // Send email via FormSubmit
    const formData = new FormData();
    formData.append("_subject", `PeachHaus Monthly Report - ${reportDate}`);
    formData.append("_template", "box");
    formData.append("_captcha", "false");
    formData.append("message", emailBody);

    const response = await fetch("https://formsubmit.co/anja@peachhausgroup.com", {
      method: "POST",
      body: formData,
    });

    const responseText = await response.text();
    console.log("FormSubmit response status:", response.status);
    console.log("FormSubmit response:", responseText);

    if (!response.ok) {
      throw new Error(`FormSubmit returned ${response.status}: ${responseText}`);
    }

    console.log("Monthly report sent successfully!");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Monthly report sent successfully",
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
