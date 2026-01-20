import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PAYMENT-LINK] ${step}${detailsStr}`);
};

/**
 * Creates a Stripe payment link for a lead and sends it via email/SMS.
 * Uses the Professional Property Verification product/price.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { leadId, sendVia } = await req.json();
    
    logStep("Request received", { leadId, sendVia });

    if (!leadId) {
      throw new Error("leadId is required");
    }

    // Get lead details
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      throw new Error("Lead not found");
    }

    logStep("Lead found", { name: lead.name, email: lead.email, phone: lead.phone });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Use the existing Professional Property Verification price
    const priceId = "price_1SF3omAQgLXUZe0irvH0RoJn";

    // Get or create Stripe customer
    let customerId: string | undefined;
    if (lead.email) {
      const existingCustomers = await stripe.customers.list({ 
        email: lead.email, 
        limit: 1 
      });

      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id;
        logStep("Found existing customer", { customerId });
      } else {
        const customer = await stripe.customers.create({
          email: lead.email,
          name: lead.name,
          phone: lead.phone || undefined,
          metadata: { 
            lead_id: leadId,
            source: "payment_link"
          },
        });
        customerId = customer.id;
        logStep("Created new customer", { customerId });
      }
    }

    // Build success/cancel URLs
    const origin = req.headers.get("origin") || "https://propertycentral.lovable.app";
    
    // Create a Checkout Session for the payment
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : lead.email || undefined,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}&lead_id=${leadId}`,
      cancel_url: `${origin}/payment-cancelled?lead_id=${leadId}`,
      metadata: {
        lead_id: leadId,
        lead_name: lead.name,
        property_address: lead.property_address || "",
      },
      payment_intent_data: {
        metadata: {
          lead_id: leadId,
          service: "property_verification",
        },
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    const paymentUrl = session.url;

    // Add timeline entry
    await supabase.from("lead_timeline").insert({
      lead_id: leadId,
      action: `Payment link created for Property Verification ($299)`,
      metadata: { 
        checkout_session_id: session.id,
        payment_url: paymentUrl,
        send_via: sendVia 
      }
    });

    // Send the payment link via email or SMS
    if (sendVia === "email" && lead.email) {
      // Send email with payment link
      const { error: emailError } = await supabase.functions.invoke('send-lead-email', {
        body: {
          leadId,
          email: lead.email,
          subject: "Complete Your Property Verification Payment - PeachHaus",
          body: `Hi ${lead.name || "there"},

Thank you for your interest in our property verification service!

To complete your booking, please click the link below to make your payment of $299:

${paymentUrl}

This payment covers our professional property inspection, which includes:
• In-person property verification
• Quality, safety, and comfort standards assessment
• Detailed inspection report
• MTR network eligibility review

If you have any questions, please don't hesitate to reach out.

Best regards,
The PeachHaus Team`,
        }
      });

      if (emailError) {
        logStep("Email send error", { error: emailError.message });
      } else {
        logStep("Payment link sent via email");
        
        // Log communication
        await supabase.from("lead_communications").insert({
          lead_id: leadId,
          communication_type: "email",
          direction: "outbound",
          subject: "Complete Your Property Verification Payment - PeachHaus",
          body: `Payment link sent: ${paymentUrl}`,
          status: "sent",
        });
      }
    } else if (sendVia === "sms" && lead.phone) {
      // Send SMS with payment link
      const { error: smsError } = await supabase.functions.invoke('ghl-send-sms', {
        body: {
          leadId,
          phone: lead.phone,
          message: `Hi ${lead.name || "there"}! Complete your PeachHaus property verification payment ($299) here: ${paymentUrl}`,
          fromNumber: "+14048006804",
        }
      });

      if (smsError) {
        logStep("SMS send error", { error: smsError.message });
      } else {
        logStep("Payment link sent via SMS");
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        url: paymentUrl,
        sessionId: session.id,
        sentVia: sendVia
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
