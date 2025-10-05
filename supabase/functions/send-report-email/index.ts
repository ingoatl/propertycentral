import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  csvData: string;
  fileName: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { csvData, fileName }: EmailRequest = await req.json();
    
    console.log("Sending report email via FormSubmit to anja@peachhausgroup.com");
    console.log("CSV data length:", csvData.length);

    // Using FormSubmit.co to send email with CSV content in body
    const emailBody = `
PeachHaus Property Report

Report File: ${fileName}
Generated: ${new Date().toISOString()}

CSV Data:
${csvData}
    `;

    const formData = new FormData();
    formData.append("_subject", "PeachHaus Property Report - " + fileName);
    formData.append("_template", "box");
    formData.append("_captcha", "false");
    formData.append("message", emailBody);

    console.log("Calling FormSubmit API...");
    
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

    console.log("Email sent successfully via FormSubmit");

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email sent successfully",
        status: response.status,
        response: responseText
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
    console.error("Error sending email:", error);
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
