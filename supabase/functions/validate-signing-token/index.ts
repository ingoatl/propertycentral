import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Validating signing token:", token.substring(0, 8) + "...");

    // Get the signing token
    const { data: signingToken, error: tokenError } = await supabase
      .from("signing_tokens")
      .select(`
        *,
        booking_documents (
          id,
          document_name,
          template_id,
          contract_type,
          recipient_name,
          recipient_email,
          status,
          document_templates (
            id,
            name,
            file_path,
            contract_type
          )
        )
      `)
      .eq("token", token)
      .single();

    if (tokenError || !signingToken) {
      console.error("Token not found:", tokenError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired signing link" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(signingToken.expires_at);
    if (now > expiresAt) {
      console.log("Token expired:", signingToken.expires_at);
      return new Response(
        JSON.stringify({ error: "This signing link has expired. Please request a new one." }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already signed
    if (signingToken.signed_at) {
      return new Response(
        JSON.stringify({ error: "You have already signed this document." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if document is already completed
    if (signingToken.booking_documents?.status === "completed") {
      return new Response(
        JSON.stringify({ error: "This document has already been completed." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check signing order - make sure previous signers have signed
    const { data: allTokens } = await supabase
      .from("signing_tokens")
      .select("*")
      .eq("document_id", signingToken.document_id)
      .order("signing_order");

    const previousSignersComplete = allTokens?.filter(
      t => t.signing_order < signingToken.signing_order
    ).every(t => t.signed_at !== null) ?? true;

    if (!previousSignersComplete) {
      return new Response(
        JSON.stringify({ error: "Waiting for previous signers to complete." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get IP and user agent from request headers
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Log document viewed event
    await supabase.from("document_audit_log").insert({
      document_id: signingToken.document_id,
      action: "document_viewed",
      metadata: {
        signer_email: signingToken.signer_email,
        signer_name: signingToken.signer_name,
        signer_type: signingToken.signer_type,
      },
      ip_address: ipAddress,
      user_agent: userAgent,
    });

    // Get the PDF URL from storage
    const template = signingToken.booking_documents?.document_templates;
    let pdfUrl = null;
    
    if (template?.file_path) {
      const { data: signedUrl } = await supabase.storage
        .from("onboarding-documents")
        .createSignedUrl(template.file_path, 3600); // 1 hour
      
      pdfUrl = signedUrl?.signedUrl;
    }

    // Get all signers for this document with their status
    const signers = allTokens?.map(t => ({
      name: t.signer_name,
      email: t.signer_email,
      type: t.signer_type,
      order: t.signing_order,
      signed: !!t.signed_at,
      signedAt: t.signed_at,
    })) || [];

    return new Response(
      JSON.stringify({
        valid: true,
        tokenId: signingToken.id,
        documentId: signingToken.document_id,
        documentName: signingToken.booking_documents?.document_name || template?.name || "Agreement",
        contractType: signingToken.booking_documents?.contract_type || template?.contract_type,
        signerName: signingToken.signer_name,
        signerEmail: signingToken.signer_email,
        signerType: signingToken.signer_type,
        pdfUrl,
        signers,
        expiresAt: signingToken.expires_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error validating token:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
