import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { reconciliation_id, payout_reference } = await req.json();

    if (!reconciliation_id) {
      throw new Error('reconciliation_id is required');
    }

    console.log(`Processing payout for reconciliation: ${reconciliation_id}`);

    // Fetch the reconciliation with owner info
    const { data: reconciliation, error: recError } = await supabase
      .from('monthly_reconciliations')
      .select(`
        *,
        properties(id, name, address),
        property_owners(id, name, email, service_type, payout_method, payout_bank_account_id)
      `)
      .eq('id', reconciliation_id)
      .single();

    if (recError || !reconciliation) {
      throw new Error(`Reconciliation not found: ${recError?.message}`);
    }

    // Verify this is a full-service client
    const serviceType = reconciliation.property_owners?.service_type;
    if (serviceType !== 'full_service') {
      throw new Error(`Cannot process payout for ${serviceType} clients. Payouts are only for full-service management.`);
    }

    // Verify reconciliation status
    if (reconciliation.status !== 'approved' && reconciliation.status !== 'statement_sent') {
      throw new Error(`Reconciliation must be approved before processing payout. Current status: ${reconciliation.status}`);
    }

    // Check if already paid out
    if (reconciliation.payout_status === 'completed') {
      throw new Error('This reconciliation has already been paid out');
    }

    // Fetch line items to calculate payout
    const { data: lineItems, error: lineItemsError } = await supabase
      .from('reconciliation_line_items')
      .select('*')
      .eq('reconciliation_id', reconciliation_id);

    if (lineItemsError) {
      throw new Error(`Failed to fetch line items: ${lineItemsError.message}`);
    }

    // Calculate payout amount
    // For full-service: Payout = Revenue - Management Fee - Visit Fees - Expenses
    const approvedItems = (lineItems || []).filter((item: any) => item.verified && !item.excluded);
    
    const visitFees = approvedItems
      .filter((item: any) => item.item_type === 'visit')
      .reduce((sum: number, item: any) => sum + Math.abs(item.amount || 0), 0);
    
    const totalExpenses = approvedItems
      .filter((item: any) => item.item_type === 'expense')
      .reduce((sum: number, item: any) => sum + Math.abs(item.amount || 0), 0);

    const totalRevenue = reconciliation.total_revenue || 0;
    const managementFee = reconciliation.management_fee || 0;
    
    const payoutAmount = totalRevenue - managementFee - visitFees - totalExpenses;

    console.log(`Payout calculation:
      Revenue: $${totalRevenue}
      - Management Fee: $${managementFee}
      - Visit Fees: $${visitFees}
      - Expenses: $${totalExpenses}
      = Payout: $${payoutAmount}
    `);

    if (payoutAmount <= 0) {
      throw new Error(`No payout due. Calculated payout: $${payoutAmount.toFixed(2)}`);
    }

    // Generate payout reference if not provided
    const reference = payout_reference || `PAYOUT-${reconciliation.property_owners?.name?.substring(0, 4).toUpperCase() || 'OWNER'}-${Date.now()}`;

    // Update reconciliation with payout info
    const { error: updateError } = await supabase
      .from('monthly_reconciliations')
      .update({
        payout_to_owner: payoutAmount,
        payout_status: 'completed',
        payout_at: new Date().toISOString(),
        payout_reference: reference,
        status: 'charged', // Mark as finalized
        updated_at: new Date().toISOString()
      })
      .eq('id', reconciliation_id);

    if (updateError) {
      throw new Error(`Failed to update reconciliation: ${updateError.message}`);
    }

    // Log in audit trail
    await supabase.from('reconciliation_audit_log').insert({
      reconciliation_id,
      action: 'payout_processed',
      user_id: user.id,
      notes: `Payout of $${payoutAmount.toFixed(2)} processed. Reference: ${reference}`
    });

    console.log(`Payout processed successfully: $${payoutAmount.toFixed(2)}`);

    return new Response(
      JSON.stringify({
        success: true,
        amount: payoutAmount,
        reference,
        owner_name: reconciliation.property_owners?.name,
        property_name: reconciliation.properties?.name
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error processing payout:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
