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

    // STEP 1: Find and delete fake expenses from internal emails
    console.log('Step 1: Finding fake expenses from internal emails...');
    
    // Get all email insights from internal senders that created expenses
    const { data: internalEmailInsights, error: insightError } = await supabase
      .from('email_insights')
      .select('id, sender_email, expense_description, expense_created')
      .ilike('sender_email', '%@peachhausgroup.com%')
      .eq('expense_created', true);

    if (insightError) {
      console.error('Error finding internal email insights:', insightError);
    } else if (internalEmailInsights && internalEmailInsights.length > 0) {
      console.log(`Found ${internalEmailInsights.length} fake expenses from internal emails`);
      
      const insightIds = internalEmailInsights.map(i => i.id);
      
      // Find expenses linked to these insights
      const { data: fakeExpenses, error: fakeExpError } = await supabase
        .from('expenses')
        .select('id, property_id, amount, purpose, reconciliation_line_items(reconciliation_id)')
        .in('email_insight_id', insightIds);
      
      if (fakeExpError) {
        console.error('Error finding fake expenses:', fakeExpError);
      } else if (fakeExpenses && fakeExpenses.length > 0) {
        console.log(`Deleting ${fakeExpenses.length} fake expenses...`);
        
        // Track affected reconciliations
        for (const exp of fakeExpenses) {
          if (exp.reconciliation_line_items && exp.reconciliation_line_items.length > 0) {
            exp.reconciliation_line_items.forEach((li: any) => {
              affectedReconciliations.add(li.reconciliation_id);
            });
          }
        }
        
        const expenseIds = fakeExpenses.map(e => e.id);
        
        // Delete reconciliation line items first
        const { error: deleteLineItemsError } = await supabase
          .from('reconciliation_line_items')
          .delete()
          .in('item_id', expenseIds)
          .eq('item_type', 'expense');
        
        if (deleteLineItemsError) {
          console.error('Error deleting line items:', deleteLineItemsError);
        } else {
          deletedLineItems += fakeExpenses.reduce((sum, exp) => 
            sum + (exp.reconciliation_line_items?.length || 0), 0);
        }
        
        // Delete the fake expenses
        const { error: deleteExpError } = await supabase
          .from('expenses')
          .delete()
          .in('id', expenseIds);
        
        if (deleteExpError) {
          console.error('Error deleting expenses:', deleteExpError);
        } else {
          deletedExpenses += fakeExpenses.length;
        }
        
        // Update insights to mark expenses as not created
        await supabase
          .from('email_insights')
          .update({ expense_created: false })
          .in('id', insightIds);
      }
    }

    // STEP 2: Find and delete expenses with suspicious descriptions
    console.log('Step 2: Finding expenses with suspicious descriptions...');
    
    // Get all expenses first, then filter in JavaScript for better pattern matching
    const { data: allExpensesForCheck, error: checkExpError } = await supabase
      .from('expenses')
      .select('id, property_id, purpose, items_detail, reconciliation_line_items(reconciliation_id)');
    
    if (checkExpError) {
      console.error('Error fetching expenses for check:', checkExpError);
    }
    
    const suspiciousExpenses = allExpensesForCheck?.filter(exp => {
      const purpose = (exp.purpose || '').toLowerCase();
      const items = (exp.items_detail || '').toLowerCase();
      return purpose.includes('multiple expenses logged') ||
             purpose.includes('multiple properties') ||
             items.includes('multiple expenses logged') ||
             items.includes('multiple properties');
    }) || [];
    
    if (suspiciousExpenses && suspiciousExpenses.length > 0) {
      console.log(`Found ${suspiciousExpenses.length} expenses with suspicious descriptions`);
      
      for (const exp of suspiciousExpenses) {
        if (exp.reconciliation_line_items && exp.reconciliation_line_items.length > 0) {
          exp.reconciliation_line_items.forEach((li: any) => {
            affectedReconciliations.add(li.reconciliation_id);
          });
        }
      }
      
      const suspExpIds = suspiciousExpenses.map(e => e.id);
      
      // Delete line items
      const { error: delLineError } = await supabase
        .from('reconciliation_line_items')
        .delete()
        .in('item_id', suspExpIds)
        .eq('item_type', 'expense');
      
      if (!delLineError) {
        deletedLineItems += suspiciousExpenses.reduce((sum, exp) => 
          sum + (exp.reconciliation_line_items?.length || 0), 0);
      }
      
      // Delete expenses
      const { error: delSuspError } = await supabase
        .from('expenses')
        .delete()
        .in('id', suspExpIds);
      
      if (!delSuspError) {
        deletedExpenses += suspiciousExpenses.length;
      }
    }

    // STEP 3: Find and delete duplicate expenses (e.g., 4x $872.70 for Villa 14)
    console.log('Step 3: Finding and deleting duplicate expenses...');
    
    // Find duplicates by property_id, amount, date, and order_number
    const { data: allExpenses, error: dupExpError } = await supabase
      .from('expenses')
      .select('id, property_id, amount, date, order_number, created_at, reconciliation_line_items(reconciliation_id)')
      .order('created_at', { ascending: true });
    
    if (!dupExpError && allExpenses) {
      const seen = new Map<string, string>(); // key -> first expense ID
      const duplicateIds: string[] = [];
      
      for (const exp of allExpenses) {
        if (exp.order_number) {
          // For expenses with order numbers, use order_number as unique key
          const key = `${exp.property_id}-${exp.order_number}`;
          if (seen.has(key)) {
            // This is a duplicate
            duplicateIds.push(exp.id);
            if (exp.reconciliation_line_items && exp.reconciliation_line_items.length > 0) {
              exp.reconciliation_line_items.forEach((li: any) => {
                affectedReconciliations.add(li.reconciliation_id);
              });
            }
          } else {
            seen.set(key, exp.id);
          }
        } else {
          // For expenses without order numbers, use property + amount + date as key
          const key = `${exp.property_id}-${exp.amount}-${exp.date}`;
          if (seen.has(key)) {
            // This is a potential duplicate
            duplicateIds.push(exp.id);
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
      
      if (duplicateIds.length > 0) {
        console.log(`Found ${duplicateIds.length} duplicate expenses`);
        
        // Delete line items for duplicates
        const { error: dupLineError } = await supabase
          .from('reconciliation_line_items')
          .delete()
          .in('item_id', duplicateIds)
          .eq('item_type', 'expense');
        
        if (!dupLineError) {
          // Count deleted line items
          const dupsWithLineItems = allExpenses.filter(e => 
            duplicateIds.includes(e.id) && e.reconciliation_line_items && e.reconciliation_line_items.length > 0
          );
          deletedLineItems += dupsWithLineItems.reduce((sum, exp) => 
            sum + (exp.reconciliation_line_items?.length || 0), 0);
        }
        
        // Delete duplicate expenses
        const { error: dupExpError } = await supabase
          .from('expenses')
          .delete()
          .in('id', duplicateIds);
        
        if (!dupExpError) {
          deletedExpenses += duplicateIds.length;
        }
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
