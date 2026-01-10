import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(supabaseUrl, supabaseKey);

  try {
    const { ownerId, chargeMonth, amount, description } = await req.json();
    
    console.log("Charging individual owner:", { ownerId, chargeMonth, amount });

    // Get owner details
    const { data: owner, error: ownerError } = await supabaseClient
      .from("property_owners")
      .select("*")
      .eq("id", ownerId)
      .single();

    if (ownerError || !owner) {
      throw new Error("Owner not found");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Get or create Stripe customer
    let customerId = owner.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: owner.email,
        name: owner.name,
        metadata: { owner_id: owner.id },
      });
      customerId = customer.id;

      await supabaseClient
        .from("property_owners")
        .update({ stripe_customer_id: customerId })
        .eq("id", owner.id);

      console.log(`Created Stripe customer ${customerId} for ${owner.name}`);
    }

    // Get payment methods - try both card and bank account
    let paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
      limit: 1,
    });

    // If no cards, try bank accounts
    if (paymentMethods.data.length === 0) {
      paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: "us_bank_account",
        limit: 1,
      });
    }

    if (paymentMethods.data.length === 0) {
      throw new Error("No payment method on file for this owner. Please set up payment first.");
    }

    const paymentMethodId = paymentMethods.data[0].id;
    
    // Create and confirm payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "usd",
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      description: description || `Charge for ${chargeMonth}`,
      metadata: {
        owner_id: owner.id,
        charge_month: chargeMonth,
      },
    });

    console.log(`Payment intent ${paymentIntent.id} status: ${paymentIntent.status}`);

    // Record the charge
    const { data: charge, error: chargeError } = await supabaseClient
      .from("monthly_charges")
      .insert({
        owner_id: owner.id,
        charge_month: chargeMonth,
        total_management_fees: amount,
        stripe_payment_intent_id: paymentIntent.id,
        charge_status: paymentIntent.status === "succeeded" ? "succeeded" : "processing",
        charged_at: paymentIntent.status === "succeeded" ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (chargeError) throw chargeError;

    // Send email notification
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8f9fa;">
          <div style="max-width: 600px; margin: 0 auto; background: white;">
            
            <div style="background: linear-gradient(135deg, #FF6B9D 0%, #C86DD7 50%, #8B5CF6 100%); padding: 40px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; color: white; font-weight: 700;">
                Payment Confirmation
              </h1>
              <p style="margin: 8px 0 0 0; font-size: 16px; color: rgba(255,255,255,0.9);">
                PeachHaus Property Management
              </p>
            </div>

            <div style="padding: 40px;">
              <p style="font-size: 16px; color: #2c3e50; margin: 0 0 20px 0;">
                Hello ${owner.name},
              </p>
              
              <p style="font-size: 15px; color: #34495e; line-height: 1.6; margin: 0 0 25px 0;">
                This email confirms that we have processed a payment on your account.
              </p>

              <div style="background: #f8f9fa; border-left: 4px solid #8B5CF6; padding: 20px; margin-bottom: 25px;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-size: 14px;">Charge Month:</td>
                    <td style="padding: 8px 0; color: #2c3e50; font-size: 14px; font-weight: 600; text-align: right;">
                      ${new Date(chargeMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-size: 14px;">Amount Charged:</td>
                    <td style="padding: 8px 0; color: #2c3e50; font-size: 18px; font-weight: 700; text-align: right;">
                      $${amount.toFixed(2)}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-size: 14px;">Payment Method:</td>
                    <td style="padding: 8px 0; color: #2c3e50; font-size: 14px; font-weight: 600; text-align: right;">
                      ${owner.payment_method === 'ach' ? 'ACH Bank Transfer' : 'Credit Card'}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-size: 14px;">Transaction ID:</td>
                    <td style="padding: 8px 0; color: #6c757d; font-size: 12px; text-align: right; font-family: monospace;">
                      ${paymentIntent.id}
                    </td>
                  </tr>
                  ${description ? `
                  <tr>
                    <td style="padding: 8px 0; color: #6c757d; font-size: 14px;">Description:</td>
                    <td style="padding: 8px 0; color: #2c3e50; font-size: 14px; text-align: right;">
                      ${description}
                    </td>
                  </tr>
                  ` : ''}
                </table>
              </div>

              <p style="font-size: 15px; color: #34495e; line-height: 1.6; margin: 0 0 20px 0;">
                If you have any questions about this charge, please don't hesitate to contact us.
              </p>

              <p style="font-size: 14px; color: #6c757d; margin: 0;">
                Best regards,<br>
                <strong style="color: #2c3e50;">The PeachHaus Team</strong>
              </p>
            </div>

            <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #dee2e6;">
              <p style="margin: 0; font-size: 12px; color: #6c757d;">
                © ${new Date().getFullYear()} PeachHaus Property Management. All rights reserved.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    try {
      await resend.emails.send({
        from: "PeachHaus <info@peachhausgroup.com>",
        to: [owner.email],
        subject: `Payment Confirmation - ${new Date(chargeMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        html: emailHtml,
      });
      console.log(`Confirmation email sent to ${owner.email}`);
    } catch (emailError) {
      console.error("Error sending email:", emailError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        charge,
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error in charge-individual-owner:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
