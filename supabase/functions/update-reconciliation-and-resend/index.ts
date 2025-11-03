import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { reconciliation_id } = await req.json();

    if (!reconciliation_id) {
      throw new Error('Reconciliation ID is required');
    }

    console.log(`Processing reconciliation: ${reconciliation_id}`);

    // Get reconciliation details
    const { data: reconciliation, error: recError } = await supabase
      .from('monthly_reconciliations')
      .select('*, properties(id)')
      .eq('id', reconciliation_id)
      .single();

    if (recError || !reconciliation) {
      throw new Error('Reconciliation not found');
    }

    const propertyId = reconciliation.properties.id;
    const reconciliationMonth = new Date(reconciliation.month);

    console.log(`Property: ${propertyId}, Month: ${reconciliation.month}`);

    // Calculate date range for the month
    const firstDay = new Date(reconciliationMonth.getFullYear(), reconciliationMonth.getMonth(), 1);
    const lastDay = new Date(reconciliationMonth.getFullYear(), reconciliationMonth.getMonth() + 1, 0);

    // Find unbilled expenses
    const { data: unbilledExpenses, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .eq('property_id', propertyId)
      .gte('date', firstDay.toISOString())
      .lte('date', lastDay.toISOString())
      .is('billed', false);

    // Find unbilled visits
    const { data: unbilledVisits, error: visitsError } = await supabase
      .from('visits')
      .select('*')
      .eq('property_id', propertyId)
      .gte('visit_date', firstDay.toISOString())
      .lte('visit_date', lastDay.toISOString())
      .is('billed', false);

    if (expensesError || visitsError) {
      throw new Error('Error fetching unbilled items');
    }

    console.log(`Found ${unbilledExpenses?.length || 0} unbilled expenses, ${unbilledVisits?.length || 0} unbilled visits`);

    const lineItemsToAdd = [];
    let additionalExpenseTotal = 0;
    let additionalVisitTotal = 0;

    // Create line items for unbilled expenses
    if (unbilledExpenses && unbilledExpenses.length > 0) {
      for (const expense of unbilledExpenses) {
        lineItemsToAdd.push({
          reconciliation_id,
          type: 'expense',
          description: expense.description || 'Expense',
          amount: expense.amount,
          date: expense.date,
          reference_id: expense.id,
          verified: true
        });
        additionalExpenseTotal += expense.amount;
      }
    }

    // Create line items for unbilled visits
    if (unbilledVisits && unbilledVisits.length > 0) {
      for (const visit of unbilledVisits) {
        lineItemsToAdd.push({
          reconciliation_id,
          type: 'visit',
          description: `Visit - ${visit.visit_type || 'Standard'}`,
          amount: visit.visit_fee || 30,
          date: visit.visit_date,
          reference_id: visit.id,
          verified: true
        });
        additionalVisitTotal += visit.visit_fee || 30;
      }
    }

    if (lineItemsToAdd.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No unbilled items found to add' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Insert new line items
    const { error: insertError } = await supabase
      .from('reconciliation_line_items')
      .insert(lineItemsToAdd);

    if (insertError) {
      throw new Error(`Error inserting line items: ${insertError.message}`);
    }

    console.log(`Added ${lineItemsToAdd.length} line items`);

    // Update reconciliation totals
    const newExpenseTotal = (reconciliation.expense_total || 0) + additionalExpenseTotal;
    const newVisitTotal = (reconciliation.visit_total || 0) + additionalVisitTotal;
    const newDueFromOwner = reconciliation.total_revenue - reconciliation.management_fees - reconciliation.order_minimum_fee - newExpenseTotal - newVisitTotal;

    const { error: updateError } = await supabase
      .from('monthly_reconciliations')
      .update({
        expense_total: newExpenseTotal,
        visit_total: newVisitTotal,
        due_from_owner: newDueFromOwner
      })
      .eq('id', reconciliation_id);

    if (updateError) {
      throw new Error(`Error updating reconciliation: ${updateError.message}`);
    }

    // Mark expenses as billed
    if (unbilledExpenses && unbilledExpenses.length > 0) {
      await supabase
        .from('expenses')
        .update({ billed: true })
        .in('id', unbilledExpenses.map(e => e.id));
    }

    // Mark visits as billed
    if (unbilledVisits && unbilledVisits.length > 0) {
      await supabase
        .from('visits')
        .update({ billed: true })
        .in('id', unbilledVisits.map(v => v.id));
    }

    console.log(`Updated reconciliation totals. New expense total: ${newExpenseTotal}, New visit total: ${newVisitTotal}, New due from owner: ${newDueFromOwner}`);

    // Send revised statement
    console.log('Sending revised statement...');
    const { data: emailData, error: emailError } = await supabase.functions.invoke('send-monthly-report', {
      body: {
        mode: 'reconciliation',
        reconciliation_id
      }
    });

    if (emailError) {
      console.error('Error sending statement:', emailError);
      throw new Error(`Error sending statement: ${emailError.message}`);
    }

    console.log('Revised statement sent successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Added ${lineItemsToAdd.length} items and sent revised statement`,
        added: {
          expenses: unbilledExpenses?.length || 0,
          visits: unbilledVisits?.length || 0
        },
        newTotals: {
          expense_total: newExpenseTotal,
          visit_total: newVisitTotal,
          due_from_owner: newDueFromOwner
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in update-reconciliation-and-resend:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
