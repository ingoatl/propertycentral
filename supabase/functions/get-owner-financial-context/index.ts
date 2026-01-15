import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export interface OwnerFinancialContext {
  // Payment method status
  hasPaymentMethod: boolean;
  paymentMethodType: "card" | "bank" | null;
  paymentMethodBrand: string | null;
  paymentMethodLast4: string | null;
  paymentMethodCount: number;
  
  // Outstanding charges
  hasOutstandingCharges: boolean;
  outstandingAmount: number;
  outstandingChargesCount: number;
  oldestUnpaidDate: string | null;
  unpaidCharges: Array<{
    id: string;
    amount: number;
    description: string;
    charge_date: string;
  }>;
  
  // Payment history
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
  totalPaidThisYear: number;
  paymentHistoryStatus: "excellent" | "good" | "late" | "delinquent" | "new";
  paymentCount: number;
  
  // Pending payouts
  pendingPayoutAmount: number;
  pendingPayoutCount: number;
  lastPayoutDate: string | null;
  lastPayoutAmount: number | null;
  
  // Derived status
  financialHealthScore: "excellent" | "good" | "attention_needed" | "critical";
  financialHealthDetails: string;
  
  // Card issues
  cardExpiringSoon: boolean;
  cardExpMonth: number | null;
  cardExpYear: number | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { ownerId } = await req.json();
    
    if (!ownerId) {
      throw new Error("Owner ID is required");
    }

    console.log("Building financial context for owner:", ownerId);

    // 1. Get owner details
    const { data: owner, error: ownerError } = await supabaseClient
      .from("property_owners")
      .select("id, name, stripe_customer_id, has_payment_method")
      .eq("id", ownerId)
      .single();

    if (ownerError) throw ownerError;
    if (!owner) {
      return new Response(
        JSON.stringify({ error: "Owner not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize context with defaults
    const context: OwnerFinancialContext = {
      hasPaymentMethod: false,
      paymentMethodType: null,
      paymentMethodBrand: null,
      paymentMethodLast4: null,
      paymentMethodCount: 0,
      hasOutstandingCharges: false,
      outstandingAmount: 0,
      outstandingChargesCount: 0,
      oldestUnpaidDate: null,
      unpaidCharges: [],
      lastPaymentDate: null,
      lastPaymentAmount: null,
      totalPaidThisYear: 0,
      paymentHistoryStatus: "new",
      paymentCount: 0,
      pendingPayoutAmount: 0,
      pendingPayoutCount: 0,
      lastPayoutDate: null,
      lastPayoutAmount: null,
      financialHealthScore: "good",
      financialHealthDetails: "",
      cardExpiringSoon: false,
      cardExpMonth: null,
      cardExpYear: null,
    };

    // 2. Get payment methods from Stripe if customer exists
    if (owner.stripe_customer_id) {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (stripeKey) {
        try {
          const stripe = new Stripe(stripeKey, {
            apiVersion: "2025-08-27.basil",
          });

          const [cardMethods, bankMethods] = await Promise.all([
            stripe.paymentMethods.list({
              customer: owner.stripe_customer_id,
              type: "card",
            }),
            stripe.paymentMethods.list({
              customer: owner.stripe_customer_id,
              type: "us_bank_account",
            }),
          ]);

          const allMethods = [...cardMethods.data, ...bankMethods.data];
          context.paymentMethodCount = allMethods.length;
          context.hasPaymentMethod = allMethods.length > 0;

          if (allMethods.length > 0) {
            const primaryMethod = allMethods[0];
            
            if (primaryMethod.type === "card" && primaryMethod.card) {
              context.paymentMethodType = "card";
              context.paymentMethodBrand = primaryMethod.card.brand || null;
              context.paymentMethodLast4 = primaryMethod.card.last4 || null;
              context.cardExpMonth = primaryMethod.card.exp_month || null;
              context.cardExpYear = primaryMethod.card.exp_year || null;
              
              // Check if card expires within 2 months
              if (context.cardExpMonth && context.cardExpYear) {
                const now = new Date();
                const expDate = new Date(context.cardExpYear, context.cardExpMonth - 1, 1);
                const twoMonthsFromNow = new Date(now.getFullYear(), now.getMonth() + 2, 1);
                context.cardExpiringSoon = expDate <= twoMonthsFromNow;
              }
            } else if (primaryMethod.type === "us_bank_account" && primaryMethod.us_bank_account) {
              context.paymentMethodType = "bank";
              context.paymentMethodBrand = primaryMethod.us_bank_account.bank_name || null;
              context.paymentMethodLast4 = primaryMethod.us_bank_account.last4 || null;
            }
          }

          console.log("Stripe payment methods found:", context.paymentMethodCount);
        } catch (stripeError) {
          console.error("Error fetching Stripe payment methods:", stripeError);
        }
      }
    } else {
      context.hasPaymentMethod = owner.has_payment_method || false;
    }

    // 3. Get outstanding charges from monthly_charges
    const { data: unpaidCharges } = await supabaseClient
      .from("monthly_charges")
      .select("id, amount, charge_description, charge_date, charge_status")
      .eq("owner_id", ownerId)
      .in("charge_status", ["pending", "unpaid", "overdue"])
      .order("charge_date", { ascending: true });

    if (unpaidCharges && unpaidCharges.length > 0) {
      context.hasOutstandingCharges = true;
      context.outstandingChargesCount = unpaidCharges.length;
      context.outstandingAmount = unpaidCharges.reduce((sum, c) => sum + (c.amount || 0), 0);
      context.oldestUnpaidDate = unpaidCharges[0].charge_date;
      context.unpaidCharges = unpaidCharges.map(c => ({
        id: c.id,
        amount: c.amount || 0,
        description: c.charge_description || "Charge",
        charge_date: c.charge_date,
      }));
    }

    // 4. Get payment history (paid charges)
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
    const { data: paidCharges } = await supabaseClient
      .from("monthly_charges")
      .select("id, amount, paid_at, charge_date")
      .eq("owner_id", ownerId)
      .eq("charge_status", "paid")
      .gte("paid_at", yearStart)
      .order("paid_at", { ascending: false });

    if (paidCharges && paidCharges.length > 0) {
      context.paymentCount = paidCharges.length;
      context.lastPaymentDate = paidCharges[0].paid_at;
      context.lastPaymentAmount = paidCharges[0].amount;
      context.totalPaidThisYear = paidCharges.reduce((sum, c) => sum + (c.amount || 0), 0);
      
      // Determine payment status based on history
      if (context.paymentCount > 6) {
        context.paymentHistoryStatus = context.hasOutstandingCharges ? "good" : "excellent";
      } else if (context.paymentCount > 0) {
        context.paymentHistoryStatus = "good";
      }
    }

    // Check for late payments
    if (context.hasOutstandingCharges && context.oldestUnpaidDate) {
      const oldestDate = new Date(context.oldestUnpaidDate);
      const daysPastDue = Math.floor((Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysPastDue > 60) {
        context.paymentHistoryStatus = "delinquent";
      } else if (daysPastDue > 30) {
        context.paymentHistoryStatus = "late";
      }
    }

    // 5. Get pending payouts from owner_distributions
    const { data: distributions } = await supabaseClient
      .from("owner_distributions")
      .select("id, amount, created_at, status")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });

    if (distributions) {
      const pending = distributions.filter(d => d.status === "pending");
      const paid = distributions.find(d => d.status === "paid");
      
      context.pendingPayoutAmount = pending.reduce((sum, d) => sum + (d.amount || 0), 0);
      context.pendingPayoutCount = pending.length;
      
      if (paid) {
        context.lastPayoutDate = paid.created_at;
        context.lastPayoutAmount = paid.amount;
      }
    }

    // 6. Calculate financial health score
    let healthScore = 100;
    const healthDetails: string[] = [];

    // No payment method is critical
    if (!context.hasPaymentMethod) {
      healthScore -= 40;
      healthDetails.push("No payment method on file");
    }

    // Outstanding charges
    if (context.hasOutstandingCharges) {
      if (context.paymentHistoryStatus === "delinquent") {
        healthScore -= 30;
        healthDetails.push("Account significantly overdue");
      } else if (context.paymentHistoryStatus === "late") {
        healthScore -= 20;
        healthDetails.push("Payment overdue");
      } else {
        healthScore -= 10;
        healthDetails.push("Outstanding balance");
      }
    }

    // Card expiring
    if (context.cardExpiringSoon) {
      healthScore -= 10;
      healthDetails.push("Card expiring soon");
    }

    // Determine final score
    if (healthScore >= 90) {
      context.financialHealthScore = "excellent";
    } else if (healthScore >= 70) {
      context.financialHealthScore = "good";
    } else if (healthScore >= 50) {
      context.financialHealthScore = "attention_needed";
    } else {
      context.financialHealthScore = "critical";
    }

    context.financialHealthDetails = healthDetails.length > 0 
      ? healthDetails.join("; ") 
      : "Account in good standing";

    console.log("Financial context built:", {
      ownerId,
      hasPaymentMethod: context.hasPaymentMethod,
      outstandingAmount: context.outstandingAmount,
      financialHealthScore: context.financialHealthScore,
    });

    return new Response(
      JSON.stringify(context),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in get-owner-financial-context:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
