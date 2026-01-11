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
          field_configuration,
          document_templates (
            id,
            name,
            file_path,
            contract_type,
            field_mappings
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
      // Check if file_path is a full URL or a relative path
      if (template.file_path.startsWith('http')) {
        // It's already a full URL - use it directly
        // Check if it's a PDF that can be previewed
        if (template.file_path.toLowerCase().endsWith('.pdf')) {
          pdfUrl = template.file_path;
        } else {
          // For non-PDF files (docx, etc.), we can't preview them in iframe
          // Could potentially use Google Docs viewer as fallback
          pdfUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(template.file_path)}&embedded=true`;
        }
      } else {
        // It's a relative path - create signed URL
        const bucketName = template.file_path.includes('signed-documents') ? 'signed-documents' : 'onboarding-documents';
        const { data: signedUrl } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(template.file_path, 3600); // 1 hour
        
        if (signedUrl?.signedUrl) {
          if (template.file_path.toLowerCase().endsWith('.pdf')) {
            pdfUrl = signedUrl.signedUrl;
          } else {
            pdfUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(signedUrl.signedUrl)}&embedded=true`;
          }
        }
      }
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

    // Get field mappings with positions and filter by signer type
    const allFieldMappings = template?.field_mappings || [];
    let savedFieldValues = signingToken.booking_documents?.field_configuration || {};
    
    // For admin/manager signers, filter out any saved signature data - they sign fresh
    const isAdminSigner = signingToken.signer_type === "manager" || signingToken.signer_type === "host";
    if (isAdminSigner && savedFieldValues) {
      const filteredValues: Record<string, any> = {};
      for (const [key, value] of Object.entries(savedFieldValues)) {
        // Don't pass signature data to manager - they need to sign fresh
        if (key.toLowerCase().includes("signature") && typeof value === "string" && value.startsWith("data:image")) {
          continue;
        }
        // Don't pass manager date fields - they'll be auto-filled on their side
        if (key.toLowerCase().includes("manager") && key.toLowerCase().includes("date")) {
          continue;
        }
        filteredValues[key] = value;
      }
      savedFieldValues = filteredValues;
      console.log("Filtered saved values for admin signer - removed signature data");
    }
    
    // Map signer_type to filled_by value
    const signerTypeToFilledBy: Record<string, string> = {
      "owner": "guest",
      "second_owner": "guest",
      "guest": "guest",
      "manager": "admin",
      "host": "admin",
    };
    
    const filledByValue = signerTypeToFilledBy[signingToken.signer_type] || "guest";
    
    // Filter fields that this signer needs to fill OR see (admin-filled for context)
    // For the signing UI, we show all fields but only make guest-filled fields editable
    const signerFields = Array.isArray(allFieldMappings) 
      ? allFieldMappings.map((f: any) => ({
          ...f,
          // Include position data
          api_id: f.api_id,
          label: f.label,
          type: f.type || "text",
          page: f.page || 1,
          x: f.x || 10,
          y: f.y || 10,
          width: f.width || 30,
          height: f.height || 4,
          filled_by: f.filled_by || "guest",
          required: f.required !== false,
        }))
      : [];

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
        fields: signerFields,
        savedFieldValues,
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
