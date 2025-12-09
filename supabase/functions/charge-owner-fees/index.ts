import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LineItem {
  category: string;
  description: string;
  amount: number;
}

interface ChargeRequest {
  ownerId: string;
  lineItems: LineItem[];
  statementDate: string;
  statementNotes?: string;
  isDraft?: boolean;
}

const QBO_ACCOUNT_MAPPING: Record<string, string> = {
  "Security Deposit": "2210",
  "Onboarding Fee": "4010",
  "Management Fee": "4000",
  "Late Fee": "4090",
  "Service Fee": "4090",
  "Design Setup": "4030",
  "Other": "4090",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { ownerId, lineItems, statementDate, statementNotes, isDraft } = await req.json() as ChargeRequest;

    console.log("Processing charge request:", { ownerId, lineItems, statementDate, isDraft });

    // Validate
    if (!ownerId || !lineItems || lineItems.length === 0) {
      throw new Error("Owner ID and at least one line item are required");
    }

    // Get owner details
    const { data: owner, error: ownerError } = await supabaseClient
      .from("property_owners")
      .select("*")
      .eq("id", ownerId)
      .single();

    if (ownerError || !owner) {
      throw new Error(`Owner not found: ${ownerError?.message}`);
    }

    // Calculate total
    const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);
    console.log("Total amount:", totalAmount);

    let chargeStatus = isDraft ? "draft" : "pending";
    let stripePaymentIntentId = null;

    // If not a draft and owner has Stripe, charge them
    if (!isDraft && owner.stripe_customer_id && owner.payment_method === "stripe") {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2023-10-16",
      });

      // Get payment methods
      const paymentMethods = await stripe.paymentMethods.list({
        customer: owner.stripe_customer_id,
        type: "us_bank_account",
      });

      if (paymentMethods.data.length > 0) {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(totalAmount * 100),
          currency: "usd",
          customer: owner.stripe_customer_id,
          payment_method: paymentMethods.data[0].id,
          off_session: true,
          confirm: true,
          description: `PeachHaus Fees - ${lineItems.map(i => i.category).join(", ")}`,
          metadata: {
            owner_id: ownerId,
            owner_name: owner.name,
          },
        });

        stripePaymentIntentId = paymentIntent.id;
        chargeStatus = paymentIntent.status === "succeeded" ? "paid" : "pending";
        console.log("Stripe payment created:", paymentIntent.id, paymentIntent.status);
      } else {
        console.log("No payment method found, creating pending charge");
      }
    }

    // Create the charge record
    const { data: charge, error: chargeError } = await supabaseClient
      .from("monthly_charges")
      .insert({
        owner_id: ownerId,
        charge_month: statementDate,
        total_management_fees: totalAmount,
        charge_status: chargeStatus,
        stripe_payment_intent_id: stripePaymentIntentId,
        charged_at: isDraft ? null : new Date().toISOString(),
        is_multi_line: true,
        statement_notes: statementNotes,
        statement_date: statementDate,
        category: lineItems.length === 1 ? lineItems[0].category : "Multiple Fees",
      })
      .select()
      .single();

    if (chargeError) {
      throw new Error(`Failed to create charge: ${chargeError.message}`);
    }

    console.log("Charge created:", charge.id);

    // Create line items
    const lineItemsToInsert = lineItems.map(item => ({
      charge_id: charge.id,
      category: item.category,
      description: item.description,
      amount: item.amount,
      qbo_account_code: QBO_ACCOUNT_MAPPING[item.category] || "4090",
    }));

    const { error: lineItemError } = await supabaseClient
      .from("charge_line_items")
      .insert(lineItemsToInsert);

    if (lineItemError) {
      console.error("Failed to create line items:", lineItemError);
    }

    // Send statement email if not a draft
    if (!isDraft) {
      try {
        const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

        const lineItemsHtml = lineItems.map(item => `
          <tr>
            <td style="padding: 12px; border-bottom: 1px solid #e5e5e5;">
              <strong>${item.category}</strong>
              ${item.description ? `<br><span style="color: #666; font-size: 14px;">${item.description}</span>` : ""}
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #e5e5e5; text-align: right;">
              $${item.amount.toFixed(2)}
            </td>
          </tr>
        `).join("");

        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <title>PeachHaus Account Statement</title>
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
            <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #f97316; margin: 0;">🍑 PeachHaus</h1>
                <p style="color: #666; margin-top: 5px;">Property Management</p>
              </div>
              
              <h2 style="color: #333; border-bottom: 2px solid #f97316; padding-bottom: 10px;">Account Statement</h2>
              
              <p>Dear ${owner.name},</p>
              
              <p>The following charges have been processed on your account:</p>
              
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                  <tr style="background-color: #f8f9fa;">
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #f97316;">Description</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #f97316;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${lineItemsHtml}
                </tbody>
                <tfoot>
                  <tr style="background-color: #fff7ed;">
                    <td style="padding: 12px; font-weight: bold; font-size: 16px;">TOTAL CHARGED</td>
                    <td style="padding: 12px; text-align: right; font-weight: bold; font-size: 16px; color: #f97316;">$${totalAmount.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
              
              ${statementNotes ? `<p style="background-color: #f8f9fa; padding: 15px; border-radius: 4px;"><strong>Notes:</strong> ${statementNotes}</p>` : ""}
              
              <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 4px;">
                <p style="margin: 5px 0;"><strong>Statement Date:</strong> ${new Date(statementDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
                ${stripePaymentIntentId ? `<p style="margin: 5px 0;"><strong>Transaction ID:</strong> ${stripePaymentIntentId}</p>` : ""}
                <p style="margin: 5px 0;"><strong>Payment Status:</strong> ${chargeStatus === "paid" ? "✅ Paid" : chargeStatus === "draft" ? "📝 Draft" : "⏳ Pending"}</p>
              </div>
              
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e5e5;">
              
              <p style="color: #666; font-size: 14px;">
                Thank you for choosing PeachHaus for your property management needs!<br>
                If you have any questions about this statement, please contact us at info@peachhausgroup.com
              </p>
            </div>
          </body>
          </html>
        `;

        const recipients = [owner.email];
        if (owner.second_owner_email) {
          recipients.push(owner.second_owner_email);
        }

        await resend.emails.send({
          from: "PeachHaus <info@peachhausgroup.com>",
          to: recipients,
          cc: ["info@peachhausgroup.com"],
          subject: `PeachHaus Account Statement - ${new Date(statementDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
          html: emailHtml,
        });

        console.log("Statement email sent to:", recipients);
      } catch (emailError) {
        console.error("Failed to send statement email:", emailError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        chargeId: charge.id,
        status: chargeStatus,
        totalAmount,
        stripePaymentIntentId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error in charge-owner-fees:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
