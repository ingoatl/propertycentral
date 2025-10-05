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
    
    console.log("Sending report email via FormSubmit");

    // Using FormSubmit.co to send email
    const formData = new FormData();
    formData.append("_subject", "PeachHaus Property Report");
    formData.append("_template", "box");
    formData.append("report", csvData);
    formData.append("message", `Please find attached the PeachHaus property report (${fileName}).`);

    const response = await fetch("https://formsubmit.co/anja@peachhausgroup.com", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`FormSubmit returned ${response.status}`);
    }

    console.log("Email sent successfully via FormSubmit");

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
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
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
