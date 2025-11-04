import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('Starting contaminated data cleanup...');

    let deletedExpenses = 0;
    let deletedLineItems = 0;
    let affectedReconciliations = new Set<string>();

    // Collect all expense IDs to delete
    const expenseIdsToDelete: string[] = [];

    // STEP 1: Find expenses directly with suspicious patterns
    console.log('Step 1: Finding expenses with suspicious descriptions...');
    
    const { data: suspiciousExpenses, error: suspError } = await supabase
      .from('expenses')
      .select('id, property_id, purpose, items_detail, vendor, email_insight_id, reconciliation_line_items(reconciliation_id)');
    
    if (suspError) {
      console.error('Error fetching expenses:', suspError);
    } else if (suspiciousExpenses) {
      for (const exp of suspiciousExpenses) {
        const purpose = (exp.purpose || '').toLowerCase();
        const items = (exp.items_detail || '').toLowerCase();
        const vendor = (exp.vendor || '').toLowerCase();
        
        // Check for contamination patterns
        const isContaminated = 
          purpose.includes('multiple expenses logged') ||
          purpose.includes('multiple properties') ||
          items.includes('multiple expenses logged') ||
          items.includes('multiple properties') ||
          vendor === 'property central' ||
          vendor === 'peachhausgroup';
        
        if (isContaminated) {
          console.log(`Found contaminated expense: ${exp.id} - ${exp.purpose?.substring(0, 50)}`);
          expenseIdsToDelete.push(exp.id);
          
          if (exp.reconciliation_line_items && exp.reconciliation_line_items.length > 0) {
            exp.reconciliation_line_items.forEach((li: any) => {
              affectedReconciliations.add(li.reconciliation_id);
            });
          }
        }
      }
      
      console.log(`Found ${expenseIdsToDelete.length} contaminated expenses from patterns`);
    }

    // STEP 2: Find expenses from internal emails
    console.log('Step 2: Finding expenses from internal email senders...');
    
    const { data: internalEmailInsights, error: insightError } = await supabase
      .from('email_insights')
      .select('id')
      .ilike('sender_email', '%@peachhausgroup.com%')
      .eq('expense_created', true);

    if (!insightError && internalEmailInsights && internalEmailInsights.length > 0) {
      console.log(`Found ${internalEmailInsights.length} email insights from internal senders`);
      
      const insightIds = internalEmailInsights.map(i => i.id);
      
      const { data: internalExpenses, error: intExpError } = await supabase
        .from('expenses')
        .select('id, reconciliation_line_items(reconciliation_id)')
        .in('email_insight_id', insightIds);
      
      if (!intExpError && internalExpenses) {
        console.log(`Found ${internalExpenses.length} expenses from internal emails`);
        
        for (const exp of internalExpenses) {
          if (!expenseIdsToDelete.includes(exp.id)) {
            expenseIdsToDelete.push(exp.id);
          }
          
          if (exp.reconciliation_line_items && exp.reconciliation_line_items.length > 0) {
            exp.reconciliation_line_items.forEach((li: any) => {
              affectedReconciliations.add(li.reconciliation_id);
            });
          }
        }
      }
    }

    // STEP 3: Find duplicate expenses
    console.log('Step 3: Finding duplicate expenses...');
    
    const { data: allExpenses, error: dupExpError } = await supabase
      .from('expenses')
      .select('id, property_id, amount, date, order_number, created_at, reconciliation_line_items(reconciliation_id)')
      .order('created_at', { ascending: true });
    
    if (!dupExpError && allExpenses) {
      const seen = new Map<string, string>();
      
      for (const exp of allExpenses) {
        if (exp.order_number) {
          const key = `${exp.property_id}-${exp.order_number}`;
          if (seen.has(key) && !expenseIdsToDelete.includes(exp.id)) {
            console.log(`Found duplicate expense: ${exp.id} (order: ${exp.order_number})`);
            expenseIdsToDelete.push(exp.id);
            
            if (exp.reconciliation_line_items && exp.reconciliation_line_items.length > 0) {
              exp.reconciliation_line_items.forEach((li: any) => {
                affectedReconciliations.add(li.reconciliation_id);
              });
            }
          } else {
            seen.set(key, exp.id);
          }
        }
      }
    }

    console.log(`Total expenses to delete: ${expenseIdsToDelete.length}`);

    // DELETE ALL CONTAMINATED EXPENSES
    if (expenseIdsToDelete.length > 0) {
      // First, count and delete line items
      const { data: lineItemsToDelete, error: countError } = await supabase
        .from('reconciliation_line_items')
        .select('id')
        .in('item_id', expenseIdsToDelete)
        .eq('item_type', 'expense');
      
      if (!countError && lineItemsToDelete) {
        deletedLineItems = lineItemsToDelete.length;
        
        const { error: delLineError } = await supabase
          .from('reconciliation_line_items')
          .delete()
          .in('item_id', expenseIdsToDelete)
          .eq('item_type', 'expense');
        
        if (delLineError) {
          console.error('Error deleting line items:', delLineError);
        } else {
          console.log(`Deleted ${deletedLineItems} reconciliation line items`);
        }
      }
      
      // Delete expenses
      const { error: delExpError } = await supabase
        .from('expenses')
        .delete()
        .in('id', expenseIdsToDelete);
      
      if (delExpError) {
        console.error('Error deleting expenses:', delExpError);
      } else {
        deletedExpenses = expenseIdsToDelete.length;
        console.log(`Deleted ${deletedExpenses} contaminated expenses`);
      }
    }
    // STEP 4: Recalculate totals for affected reconciliations
    console.log(`Step 4: Recalculating totals for ${affectedReconciliations.size} affected reconciliations...`);
    
    for (const reconciliationId of affectedReconciliations) {
      // Get all verified line items for this reconciliation
      const { data: lineItems, error: lineError } = await supabase
        .from('reconciliation_line_items')
        .select('item_type, amount, verified, excluded')
        .eq('reconciliation_id', reconciliationId);
      
      if (!lineError && lineItems) {
        const validItems = lineItems.filter(item => item.verified && !item.excluded);
        
        const visitFees = validItems
          .filter(item => item.item_type === 'visit')
          .reduce((sum, item) => sum + Math.abs(item.amount), 0);
        
        const totalExpenses = validItems
          .filter(item => item.item_type === 'expense')
          .reduce((sum, item) => sum + Math.abs(item.amount), 0);
        
        // Update reconciliation totals
        await supabase
          .from('monthly_reconciliations')
          .update({
            visit_fees: visitFees,
            total_expenses: totalExpenses,
            updated_at: new Date().toISOString(),
          })
          .eq('id', reconciliationId);
        
        console.log(`Updated reconciliation ${reconciliationId}: visits=${visitFees}, expenses=${totalExpenses}`);
      }
    }

    const summary = {
      success: true,
      deletedExpenses,
      deletedLineItems,
      affectedReconciliations: affectedReconciliations.size,
      message: `Cleanup complete: Deleted ${deletedExpenses} fake/duplicate expenses, ${deletedLineItems} line items, and updated ${affectedReconciliations.size} reconciliations.`
    };

    console.log(summary.message);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in cleanup-contaminated-expenses:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
