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
      detectedFields,
    } = await req.json();

    console.log("Creating draft document:", { templateId, documentName, recipientName });
    console.log("Pre-fill data received:", JSON.stringify(preFillData, null, 2));

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
    // These are used to fill in [[field_name]] text tags in the document
    const placeholderFields: Array<{ api_id: string; value: string }> = [];
    
    // Add all pre-fill data fields dynamically
    if (preFillData && typeof preFillData === "object") {
      for (const [key, value] of Object.entries(preFillData)) {
        if (value && typeof value === "string" && value.trim()) {
          // Add the field with its original api_id
          placeholderFields.push({ api_id: key, value: value.trim() });
          
          // Also add common aliases for better text tag matching
          if (key === "property_address") {
            placeholderFields.push({ api_id: "address", value: value.trim() });
          }
          if (key === "monthly_rent") {
            const formattedRent = value.startsWith("$") ? value : `$${value}`;
            placeholderFields.push({ api_id: "rent_amount", value: formattedRent });
            placeholderFields.push({ api_id: "rent", value: formattedRent });
            // Update the original to include $ if needed
            const idx = placeholderFields.findIndex(f => f.api_id === key);
            if (idx >= 0) placeholderFields[idx].value = formattedRent;
          }
          if (key === "security_deposit") {
            const formattedDeposit = value.startsWith("$") ? value : `$${value}`;
            placeholderFields.push({ api_id: "deposit_amount", value: formattedDeposit });
            placeholderFields.push({ api_id: "deposit", value: formattedDeposit });
            const idx = placeholderFields.findIndex(f => f.api_id === key);
            if (idx >= 0) placeholderFields[idx].value = formattedDeposit;
          }
          if (key === "lease_start_date" || key === "start_date") {
            try {
              const startDate = new Date(value);
              if (!isNaN(startDate.getTime())) {
                const formattedStart = startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                placeholderFields.push({ api_id: "start_date", value: formattedStart });
                placeholderFields.push({ api_id: "lease_start", value: formattedStart });
                const idx = placeholderFields.findIndex(f => f.api_id === key);
                if (idx >= 0) placeholderFields[idx].value = formattedStart;
              }
            } catch (e) {
              console.log("Could not parse start date:", value);
            }
          }
          if (key === "lease_end_date" || key === "end_date") {
            try {
              const endDate = new Date(value);
              if (!isNaN(endDate.getTime())) {
                const formattedEnd = endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                placeholderFields.push({ api_id: "end_date", value: formattedEnd });
                placeholderFields.push({ api_id: "lease_end", value: formattedEnd });
                const idx = placeholderFields.findIndex(f => f.api_id === key);
                if (idx >= 0) placeholderFields[idx].value = formattedEnd;
              }
            } catch (e) {
              console.log("Could not parse end date:", value);
            }
          }
          if (key === "brand_name" || key === "property_name") {
            placeholderFields.push({ api_id: "property_name", value: value.trim() });
            placeholderFields.push({ api_id: "brand_name", value: value.trim() });
          }
        }
      }
    }
    
    // Add guest info fields with aliases
    if (recipientName) {
      placeholderFields.push({ api_id: "guest_name", value: recipientName });
      placeholderFields.push({ api_id: "tenant_name", value: recipientName });
      placeholderFields.push({ api_id: "renter_name", value: recipientName });
      placeholderFields.push({ api_id: "lessee_name", value: recipientName });
    }
    if (recipientEmail) {
      placeholderFields.push({ api_id: "guest_email", value: recipientEmail });
      placeholderFields.push({ api_id: "tenant_email", value: recipientEmail });
      placeholderFields.push({ api_id: "renter_email", value: recipientEmail });
    }
    
    // Add today's date for agreement date fields
    const today = new Date();
    const formattedToday = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    placeholderFields.push({ api_id: "agreement_date", value: formattedToday });
    placeholderFields.push({ api_id: "todays_date", value: formattedToday });
    placeholderFields.push({ api_id: "today_date", value: formattedToday });
    placeholderFields.push({ api_id: "current_date", value: formattedToday });

    // Remove duplicates by api_id (keep first occurrence)
    const uniquePlaceholderFields: Array<{ api_id: string; value: string }> = [];
    const seenApiIds = new Set<string>();
    for (const field of placeholderFields) {
      if (!seenApiIds.has(field.api_id)) {
        seenApiIds.add(field.api_id);
        uniquePlaceholderFields.push(field);
      }
    }

    console.log("Placeholder fields being sent:", JSON.stringify(uniquePlaceholderFields, null, 2));

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
    if (uniquePlaceholderFields.length > 0) {
      signwellPayload.placeholder_fields = uniquePlaceholderFields;
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
        field_configuration: { preFillData, guestFields, detectedFields },
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
      metadata: { signwellDocumentId: signwellData.id, fieldsPreFilled: uniquePlaceholderFields.length },
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
