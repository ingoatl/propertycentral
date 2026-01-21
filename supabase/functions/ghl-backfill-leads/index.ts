import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Backfill missing contact info for leads from GHL
 * 1. For leads WITH ghl_contact_id but missing phone/email - fetch from GHL
 * 2. For leads WITHOUT ghl_contact_id - search GHL by name/email to find and link
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ghlApiKey = Deno.env.get("GHL_API_KEY");
    const ghlLocationId = Deno.env.get("GHL_LOCATION_ID");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!ghlApiKey || !ghlLocationId) {
      throw new Error("GHL_API_KEY and GHL_LOCATION_ID are required");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all leads missing phone or email
    const { data: leadsToUpdate, error: fetchError } = await supabase
      .from("leads")
      .select("id, name, email, phone, ghl_contact_id")
      .or("phone.is.null,email.is.null")
      .limit(100);

    if (fetchError) {
      throw new Error(`Failed to fetch leads: ${fetchError.message}`);
    }

    console.log(`Found ${leadsToUpdate?.length || 0} leads missing contact info`);

    const results = {
      updated: 0,
      notFound: 0,
      errors: 0,
      details: [] as Array<{ name: string; status: string; phone?: string; email?: string }>,
    };

    for (const lead of leadsToUpdate || []) {
      try {
        let contactData = null;

        // If lead has ghl_contact_id, fetch directly
        if (lead.ghl_contact_id) {
          console.log(`Fetching GHL contact ${lead.ghl_contact_id} for lead "${lead.name}"`);
          
          const response = await fetch(
            `https://services.leadconnectorhq.com/contacts/${lead.ghl_contact_id}`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${ghlApiKey}`,
                Version: "2021-07-28",
                "Content-Type": "application/json",
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            contactData = data.contact;
          } else {
            console.log(`GHL contact ${lead.ghl_contact_id} not found`);
          }
        }

        // If no ghl_contact_id or not found, search by name
        if (!contactData && lead.name) {
          console.log(`Searching GHL for lead "${lead.name}"`);
          
          const searchResponse = await fetch(
            `https://services.leadconnectorhq.com/contacts/search`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${ghlApiKey}`,
                Version: "2021-07-28",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                locationId: ghlLocationId,
                query: lead.name,
                limit: 5,
              }),
            }
          );

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const contacts = searchData.contacts || [];
            
            // Find best match by name
            const nameLower = lead.name.toLowerCase().trim();
            for (const contact of contacts) {
              const contactName = (contact.name || contact.firstName || "").toLowerCase().trim();
              const fullName = `${contact.firstName || ""} ${contact.lastName || ""}`.toLowerCase().trim();
              
              if (contactName === nameLower || fullName === nameLower || 
                  contactName.includes(nameLower) || nameLower.includes(contactName)) {
                contactData = contact;
                console.log(`Found matching contact: ${contact.name || fullName}`);
                break;
              }
            }
          }
        }

        // Update lead if we found contact data
        if (contactData) {
          const updates: Record<string, string> = {};
          
          if (!lead.phone && contactData.phone) {
            updates.phone = contactData.phone;
          }
          if (!lead.email && contactData.email) {
            updates.email = contactData.email;
          }
          if (!lead.ghl_contact_id && contactData.id) {
            updates.ghl_contact_id = contactData.id;
          }

          if (Object.keys(updates).length > 0) {
            const { error: updateError } = await supabase
              .from("leads")
              .update(updates)
              .eq("id", lead.id);

            if (updateError) {
              console.error(`Failed to update lead ${lead.name}:`, updateError);
              results.errors++;
              results.details.push({ name: lead.name, status: "error" });
            } else {
              console.log(`✓ Updated lead "${lead.name}" with:`, updates);
              results.updated++;
              results.details.push({ 
                name: lead.name, 
                status: "updated",
                phone: updates.phone,
                email: updates.email,
              });
            }
          } else {
            console.log(`No new data to update for "${lead.name}"`);
            results.notFound++;
            results.details.push({ name: lead.name, status: "no_new_data" });
          }
        } else {
          console.log(`No GHL contact found for "${lead.name}"`);
          results.notFound++;
          results.details.push({ name: lead.name, status: "not_found" });
        }

        // Rate limit - GHL has limits
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (leadError) {
        console.error(`Error processing lead ${lead.name}:`, leadError);
        results.errors++;
        results.details.push({ name: lead.name, status: "error" });
      }
    }

    console.log(`=== Backfill Complete ===`);
    console.log(`Updated: ${results.updated}, Not Found: ${results.notFound}, Errors: ${results.errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        totalProcessed: leadsToUpdate?.length || 0,
        ...results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in ghl-backfill-leads:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
