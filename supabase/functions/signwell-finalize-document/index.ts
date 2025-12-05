import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const SIGNWELL_API_KEY = Deno.env.get("SIGNWELL_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SIGNWELL_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { signwellDocumentId } = await req.json();

    if (!signwellDocumentId) {
      throw new Error("signwellDocumentId is required");
    }

    console.log("Finalizing document:", signwellDocumentId);

    // Send the document (finalize it) via SignWell API
    const sendResponse = await fetch(
      `https://www.signwell.com/api/v1/documents/${signwellDocumentId}/send/`,
      {
        method: "POST",
        headers: {
          "X-Api-Key": SIGNWELL_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      console.error("SignWell send error:", errorText);
      throw new Error(`Failed to finalize document: ${errorText}`);
    }

    // Get the updated document with signing URLs
    const docResponse = await fetch(
      `https://www.signwell.com/api/v1/documents/${signwellDocumentId}/`,
      {
        method: "GET",
        headers: {
          "X-Api-Key": SIGNWELL_API_KEY,
        },
      }
    );

    if (!docResponse.ok) {
      throw new Error("Failed to fetch document details");
    }

    const docData = await docResponse.json();
    console.log("Document data:", JSON.stringify(docData, null, 2));

    // Extract signing URLs for each recipient
    let guestSigningUrl = null;
    let hostSigningUrl = null;

    if (docData.recipients && Array.isArray(docData.recipients)) {
      for (const recipient of docData.recipients) {
        if (recipient.id === "guest" || recipient.signing_order === 1) {
          guestSigningUrl = recipient.embedded_signing_url;
        } else if (recipient.id === "host" || recipient.signing_order === 2) {
          hostSigningUrl = recipient.embedded_signing_url;
        }
      }
    }

    // Get current user
    const authHeader = req.headers.get("Authorization");
    let userId = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabase.auth.getUser(token);
      userId = userData?.user?.id;
    }

    // Update document in database
    const { data: updatedDoc, error: updateError } = await supabase
      .from("booking_documents")
      .update({
        is_draft: false,
        status: "pending_guest",
        guest_signing_url: guestSigningUrl,
        host_signing_url: hostSigningUrl,
        sent_at: new Date().toISOString(),
      })
      .eq("signwell_document_id", signwellDocumentId)
      .select()
      .single();

    if (updateError) {
      console.error("Database update error:", updateError);
      throw new Error("Failed to update document record");
    }

    // Log audit entry
    await supabase.from("document_audit_log").insert({
      document_id: updatedDoc.id,
      action: "finalized",
      performed_by: userId || "system",
      metadata: { guestSigningUrl: !!guestSigningUrl, hostSigningUrl: !!hostSigningUrl },
    });

    return new Response(
      JSON.stringify({
        success: true,
        documentId: updatedDoc.id,
        guestSigningUrl,
        hostSigningUrl,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
