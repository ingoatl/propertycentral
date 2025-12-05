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

    const {
      templateId,
      documentName,
      recipientName,
      recipientEmail,
      propertyId,
      bookingId,
      preFillData,
      guestFields,
    } = await req.json();

    console.log("Creating draft document:", { templateId, documentName, recipientName });

    // Get template details
    const { data: template, error: templateError } = await supabase
      .from("document_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (templateError || !template) {
      throw new Error("Template not found");
    }

    // Build placeholder fields array for SignWell text tag replacement
    const placeholderFields: Array<{ api_id: string; value: string }> = [];
    
    // Add guest info fields
    if (recipientName) {
      placeholderFields.push({ api_id: "guest_name", value: recipientName });
      placeholderFields.push({ api_id: "tenant_name", value: recipientName });
    }
    if (recipientEmail) {
      placeholderFields.push({ api_id: "guest_email", value: recipientEmail });
      placeholderFields.push({ api_id: "tenant_email", value: recipientEmail });
    }
    
    // Add property and lease details from pre-fill data
    if (preFillData) {
      if (preFillData.propertyAddress) {
        placeholderFields.push({ api_id: "property_address", value: preFillData.propertyAddress });
      }
      if (preFillData.brandName) {
        placeholderFields.push({ api_id: "brand_name", value: preFillData.brandName });
        placeholderFields.push({ api_id: "property_name", value: preFillData.brandName });
      }
      if (preFillData.monthlyRent) {
        placeholderFields.push({ api_id: "monthly_rent", value: `$${preFillData.monthlyRent}` });
        placeholderFields.push({ api_id: "rent_amount", value: `$${preFillData.monthlyRent}` });
      }
      if (preFillData.securityDeposit) {
        placeholderFields.push({ api_id: "security_deposit", value: `$${preFillData.securityDeposit}` });
        placeholderFields.push({ api_id: "deposit_amount", value: `$${preFillData.securityDeposit}` });
      }
      if (preFillData.leaseStartDate) {
        const startDate = new Date(preFillData.leaseStartDate);
        const formattedStart = startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        placeholderFields.push({ api_id: "lease_start_date", value: formattedStart });
        placeholderFields.push({ api_id: "start_date", value: formattedStart });
      }
      if (preFillData.leaseEndDate) {
        const endDate = new Date(preFillData.leaseEndDate);
        const formattedEnd = endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        placeholderFields.push({ api_id: "lease_end_date", value: formattedEnd });
        placeholderFields.push({ api_id: "end_date", value: formattedEnd });
      }
      if (preFillData.maxOccupants) {
        placeholderFields.push({ api_id: "max_occupants", value: preFillData.maxOccupants });
      }
      if (preFillData.petPolicy) {
        placeholderFields.push({ api_id: "pet_policy", value: preFillData.petPolicy });
      }
      if (preFillData.additionalTerms) {
        placeholderFields.push({ api_id: "additional_terms", value: preFillData.additionalTerms });
      }
    }
    
    // Add today's date for agreement date field
    const today = new Date();
    const formattedToday = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    placeholderFields.push({ api_id: "agreement_date", value: formattedToday });
    placeholderFields.push({ api_id: "todays_date", value: formattedToday });

    console.log("Placeholder fields being sent:", JSON.stringify(placeholderFields, null, 2));

    // Create document in SignWell with draft mode
    const signwellPayload: Record<string, unknown> = {
      test_mode: false,
      draft: true, // Create as draft for visual editing
      with_signature_page: false,
      reminders: false,
      apply_signing_order: true,
      embedded_signing: true,
      embedded_signing_notifications: false,
      name: documentName || template.name,
      recipients: [
        {
          id: "guest",
          email: recipientEmail,
          name: recipientName,
          signing_order: 1,
          send_email: false,
        },
        {
          id: "host",
          email: "anja@peachhausgroup.com",
          name: "PeachHaus Group",
          signing_order: 2,
          send_email: false,
        },
      ],
      files: template.signwell_template_id
        ? undefined
        : [
            {
              // SignWell requires the file name to include the extension
              name: template.file_path.includes(".")
                ? `${template.name.trim()}.${template.file_path.split(".").pop()}`
                : template.name,
              // Check if file_path is already a full URL or just a relative path
              file_url: template.file_path.startsWith("http")
                ? template.file_path
                : `${SUPABASE_URL}/storage/v1/object/public/onboarding-documents/${template.file_path}`,
            },
          ],
      template_id: template.signwell_template_id || undefined,
    };
    
    // Add placeholder fields if we have any - this fills in text tags in the document
    if (placeholderFields.length > 0) {
      signwellPayload.placeholder_fields = placeholderFields;
    }

    console.log("SignWell payload:", JSON.stringify(signwellPayload, null, 2));

    const signwellResponse = await fetch("https://www.signwell.com/api/v1/documents/", {
      method: "POST",
      headers: {
        "X-Api-Key": SIGNWELL_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(signwellPayload),
    });

    if (!signwellResponse.ok) {
      const errorText = await signwellResponse.text();
      console.error("SignWell API error:", errorText);
      throw new Error(`SignWell API error: ${errorText}`);
    }

    const signwellData = await signwellResponse.json();
    console.log("SignWell response:", JSON.stringify(signwellData, null, 2));

    // Get current user
    const authHeader = req.headers.get("Authorization");
    let userId = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabase.auth.getUser(token);
      userId = userData?.user?.id;
    }

    // Create document record in database
    const { data: docRecord, error: docError } = await supabase
      .from("booking_documents")
      .insert({
        template_id: templateId,
        booking_id: bookingId || null,
        property_id: propertyId || null,
        document_name: documentName || template.name,
        recipient_name: recipientName,
        recipient_email: recipientEmail,
        signwell_document_id: signwellData.id,
        embedded_edit_url: signwellData.embedded_edit_url,
        is_draft: true,
        status: "draft",
        field_configuration: { preFillData, guestFields },
        created_by: userId,
      })
      .select()
      .single();

    if (docError) {
      console.error("Database error:", docError);
      throw new Error("Failed to save document record");
    }

    // Log audit entry
    await supabase.from("document_audit_log").insert({
      document_id: docRecord.id,
      action: "draft_created",
      performed_by: userId || "system",
      metadata: { signwellDocumentId: signwellData.id },
    });

    return new Response(
      JSON.stringify({
        success: true,
        documentId: docRecord.id,
        signwellDocumentId: signwellData.id,
        embeddedEditUrl: signwellData.embedded_edit_url,
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
