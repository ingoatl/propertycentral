import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { expenseId, token, filePath } = await req.json();

    console.log("Receipt URL request:", { expenseId, filePath, hasToken: !!token });

    // Validate session if token provided
    if (token) {
      const { data: sessionData, error: sessionError } = await supabase
        .from("owner_portal_sessions")
        .select("owner_id, property_id, expires_at")
        .eq("token", token)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (sessionError || !sessionData) {
        console.error("Session validation failed:", sessionError);
        return new Response(
          JSON.stringify({ error: "Invalid or expired session" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("Session validated for owner:", sessionData.owner_id);
    }

    // Use provided filePath or fetch from expense
    let receiptPath = filePath;
    
    if (!receiptPath && expenseId) {
      const { data: expense, error: expenseError } = await supabase
        .from("expenses")
        .select("email_screenshot_path, file_path, original_receipt_path")
        .eq("id", expenseId)
        .single();

      if (expenseError || !expense) {
        console.error("Expense fetch failed:", expenseError);
        return new Response(
          JSON.stringify({ error: "Expense not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Priority: email_screenshot_path > file_path > original_receipt_path
      receiptPath = expense.email_screenshot_path || expense.file_path || expense.original_receipt_path;
    }

    if (!receiptPath) {
      return new Response(
        JSON.stringify({ error: "No receipt file available" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate signed URL using service role key (bypasses RLS)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("expense-documents")
      .createSignedUrl(receiptPath, 600); // 10 minutes

    if (signedUrlError) {
      console.error("Failed to create signed URL:", signedUrlError);
      return new Response(
        JSON.stringify({ error: "Failed to generate receipt URL" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Signed URL generated successfully for:", receiptPath);

    return new Response(
      JSON.stringify({ 
        signedUrl: signedUrlData.signedUrl,
        path: receiptPath
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Owner receipt URL error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
