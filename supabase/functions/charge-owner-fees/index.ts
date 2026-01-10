import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
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
  isTest?: boolean;
  testEmail?: string;
}

const QBO_ACCOUNT_MAPPING: Record<string, string> = {
  "Security Deposit": "2210",
  "Onboarding Fee": "4010",
  "Management Fee": "4000",
  "Late Fee": "4090",
  "Service Fee": "4090",
  "Design Setup": "4030",
  "CC Processing Fee": "4095",
  "Other": "4090",
};

const LOGO_URL = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png";

// 3% CC processing fee
const CC_FEE_PERCENTAGE = 0.03;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { ownerId, lineItems, statementDate, statementNotes, isDraft, isTest, testEmail } = await req.json() as ChargeRequest;

    console.log("Processing charge request:", { ownerId, lineItems, statementDate, isDraft, isTest, testEmail });

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
    let totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);
    
    // Add CC processing fee if payment method is credit card
    const isUsingCC = owner.payment_method === "cc" || owner.payment_method === "card";
    let ccFeeAmount = 0;
    let adjustedLineItems = [...lineItems];
    
    if (isUsingCC && !isDraft) {
      ccFeeAmount = Math.round(totalAmount * CC_FEE_PERCENTAGE * 100) / 100;
      totalAmount += ccFeeAmount;
      
      // Add CC fee as a line item
      adjustedLineItems.push({
        category: "CC Processing Fee",
        description: `3% credit card processing fee`,
        amount: ccFeeAmount
      });
      
      console.log(`Added CC processing fee: $${ccFeeAmount}`);
    }
    
    console.log("Total amount (with fees):", totalAmount);

    // Use valid status values: pending, processing, succeeded, failed, refunded
    let chargeStatus = isDraft ? "pending" : "pending";
    let stripePaymentIntentId = null;
    let chargeId = null;

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // If not a draft, not a test, and owner has Stripe customer, charge them
    if (!isDraft && !isTest && owner.stripe_customer_id) {
      try {
        // Get the customer's default payment method or any payment method
        const customer = await stripe.customers.retrieve(owner.stripe_customer_id);
        
        let paymentMethodId: string | null = null;
        
        // Try to get default payment method
        if (customer && !customer.deleted && customer.invoice_settings?.default_payment_method) {
          paymentMethodId = customer.invoice_settings.default_payment_method as string;
        }
        
        // If no default, try to find any attached payment method
        if (!paymentMethodId) {
          // Try cards first
          const cardMethods = await stripe.paymentMethods.list({
            customer: owner.stripe_customer_id,
            type: "card",
            limit: 1
          });
          
          if (cardMethods.data.length > 0) {
            paymentMethodId = cardMethods.data[0].id;
          } else {
            // Try bank accounts
            const bankMethods = await stripe.paymentMethods.list({
              customer: owner.stripe_customer_id,
              type: "us_bank_account",
              limit: 1
            });
            
            if (bankMethods.data.length > 0) {
              paymentMethodId = bankMethods.data[0].id;
            }
          }
        }

        if (paymentMethodId) {
          console.log(`Charging payment method: ${paymentMethodId}`);
          
          const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(totalAmount * 100), // Convert to cents
            currency: "usd",
            customer: owner.stripe_customer_id,
            payment_method: paymentMethodId,
            off_session: true,
            confirm: true,
            description: `PeachHaus Fees - ${adjustedLineItems.map(i => i.category).join(", ")}`,
            metadata: {
              owner_id: ownerId,
              owner_name: owner.name,
              cc_fee: ccFeeAmount.toString(),
              original_amount: (totalAmount - ccFeeAmount).toString()
            },
          });

          stripePaymentIntentId = paymentIntent.id;
          chargeStatus = paymentIntent.status === "succeeded" ? "succeeded" : "processing";
          console.log("Stripe payment created:", paymentIntent.id, paymentIntent.status);
        } else {
          console.log("No payment method found for customer, creating pending charge");
          chargeStatus = "pending";
        }
      } catch (stripeError: any) {
        console.error("Stripe charge failed:", stripeError.message);
        chargeStatus = "failed";
        // Continue to create the charge record even if payment fails
      }
    }

    // Only create charge record if not a test
    if (!isTest) {
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
          category: adjustedLineItems.length === 1 ? adjustedLineItems[0].category : "Multiple Fees",
        })
        .select()
        .single();

      if (chargeError) {
        throw new Error(`Failed to create charge: ${chargeError.message}`);
      }

      console.log("Charge created:", charge.id);
      chargeId = charge.id;

      // Create line items (including CC fee if applicable)
      const lineItemsToInsert = adjustedLineItems.map(item => ({
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
    }

    // Send statement email if not a draft (or if it's a test)
    if (!isDraft || isTest) {
      try {
        const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

        const lineItemsHtml = adjustedLineItems.map(item => `
          <tr>
            <td style="padding: 16px 20px; border-bottom: 1px solid #eaeaea; font-size: 15px;">
              <div style="font-weight: 600; color: #1a1a1a; margin-bottom: 4px;">${item.category}</div>
              ${item.description ? `<div style="color: #666; font-size: 13px;">${item.description}</div>` : ""}
            </td>
            <td style="padding: 16px 20px; border-bottom: 1px solid #eaeaea; text-align: right; font-size: 15px; font-weight: 600; color: #1a1a1a;">
              $${item.amount.toFixed(2)}
            </td>
          </tr>
        `).join("");

        const formattedDate = new Date(statementDate).toLocaleDateString("en-US", { 
          year: "numeric", 
          month: "long", 
          day: "numeric" 
        });

        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>PeachHaus Account Statement</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; line-height: 1.6;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              
              <!-- Header with Logo -->
              <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); border-radius: 16px 16px 0 0; padding: 40px 30px; text-align: center;">
                <img src="${LOGO_URL}" alt="PeachHaus" style="height: 60px; margin-bottom: 16px;" />
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Account Statement</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 15px;">${formattedDate}</p>
              </div>
              
              <!-- Main Content -->
              <div style="background-color: white; border-radius: 0 0 16px 16px; padding: 40px 30px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                
                <!-- Greeting -->
                <p style="font-size: 16px; color: #374151; margin: 0 0 24px 0;">
                  Dear <strong>${owner.name}</strong>,
                </p>
                
                <p style="font-size: 15px; color: #6b7280; margin: 0 0 24px 0;">
                  Please find below a summary of charges processed on your account. We appreciate your continued partnership with PeachHaus.
                </p>
                
                <!-- Charges Table -->
                <div style="background-color: #fafafa; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                      <tr style="background-color: #f97316;">
                        <th style="padding: 14px 20px; text-align: left; color: white; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Description</th>
                        <th style="padding: 14px 20px; text-align: right; color: white; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${lineItemsHtml}
                    </tbody>
                    <tfoot>
                      <tr style="background-color: #fff7ed;">
                        <td style="padding: 18px 20px; font-weight: 700; font-size: 16px; color: #1a1a1a;">Total Due</td>
                        <td style="padding: 18px 20px; text-align: right; font-weight: 700; font-size: 20px; color: #f97316;">$${totalAmount.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                
                ${statementNotes ? `
                <!-- Notes Section -->
                <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                  <p style="margin: 0; font-size: 14px; color: #0c4a6e;">
                    <strong>Note:</strong> ${statementNotes}
                  </p>
                </div>
                ` : ""}
                
                <!-- Transaction Details -->
                <div style="background-color: #f9fafb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                  <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Transaction Details</h3>
                  <table style="width: 100%;">
                    <tr>
                      <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">Statement Date</td>
                      <td style="padding: 6px 0; font-size: 14px; color: #1a1a1a; text-align: right; font-weight: 500;">${formattedDate}</td>
                    </tr>
                    ${stripePaymentIntentId ? `
                    <tr>
                      <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">Transaction ID</td>
                      <td style="padding: 6px 0; font-size: 14px; color: #1a1a1a; text-align: right; font-family: monospace; font-size: 12px;">${stripePaymentIntentId}</td>
                    </tr>
                    ` : ""}
                    <tr>
                      <td style="padding: 6px 0; font-size: 14px; color: #6b7280;">Payment Status</td>
                      <td style="padding: 6px 0; text-align: right;">
                        <span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; ${
                          chargeStatus === "succeeded" 
                            ? "background-color: #dcfce7; color: #166534;" 
                            : chargeStatus === "processing"
                            ? "background-color: #fef3c7; color: #92400e;"
                            : "background-color: #fef9c3; color: #854d0e;"
                        }">
                          ${chargeStatus === "succeeded" ? "✓ Paid" : chargeStatus === "processing" ? "Processing" : "Pending"}
                        </span>
                      </td>
                    </tr>
                  </table>
                </div>
                
                <!-- Security Deposit Notice (if applicable) -->
                ${lineItems.some(item => item.category === "Security Deposit") ? `
                <div style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;">
                  <p style="margin: 0; font-size: 14px; color: #713f12;">
                    <strong>📋 Security Deposit Notice:</strong> Security deposits are fully refundable upon termination of management agreement, subject to any outstanding balances or damages.
                  </p>
                </div>
                ` : ""}
                
                <!-- Divider -->
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
                
                <!-- Footer -->
                <div style="text-align: center;">
                  <p style="font-size: 14px; color: #6b7280; margin: 0 0 16px 0;">
                    Thank you for trusting PeachHaus with your property management needs.
                  </p>
                  <p style="font-size: 13px; color: #9ca3af; margin: 0;">
                    Questions? Contact us at <a href="mailto:info@peachhausgroup.com" style="color: #f97316; text-decoration: none;">info@peachhausgroup.com</a>
                  </p>
                </div>
              </div>
              
              <!-- Footer Branding -->
              <div style="text-align: center; padding: 24px 0;">
                <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                  © ${new Date().getFullYear()} PeachHaus Property Management. All rights reserved.
                </p>
                <p style="font-size: 11px; color: #d1d5db; margin: 8px 0 0 0;">
                  Houston, Texas
                </p>
              </div>
            </div>
          </body>
          </html>
        `;

        // Determine recipients
        let recipients: string[];
        if (isTest && testEmail) {
          recipients = [testEmail];
        } else {
          recipients = [owner.email];
          if (owner.second_owner_email) {
            recipients.push(owner.second_owner_email);
          }
        }

        await resend.emails.send({
          from: "PeachHaus <info@peachhausgroup.com>",
          to: recipients,
          cc: isTest ? [] : ["info@peachhausgroup.com"],
          subject: `${isTest ? "[TEST] " : ""}PeachHaus Account Statement - ${formattedDate}`,
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
        chargeId,
        status: chargeStatus,
        totalAmount,
        originalAmount: totalAmount - ccFeeAmount,
        ccFeeAmount,
        stripePaymentIntentId,
        isTest,
        paymentMethod: owner.payment_method
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
