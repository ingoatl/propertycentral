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
    const reconciliationMonthStr = reconciliation.reconciliation_month;

    console.log(`Property: ${propertyId}, Month: ${reconciliationMonthStr}`);

    // Parse the date string properly (it's stored as YYYY-MM-DD)
    const [year, month] = reconciliationMonthStr.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    // Format dates as YYYY-MM-DD for date column comparison
    const firstDayStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

    console.log(`Date range: ${firstDayStr} to ${lastDayStr}`);

    // Get existing line items to avoid duplicates
    const { data: existingLineItems, error: lineItemsError } = await supabase
      .from('reconciliation_line_items')
      .select('item_id')
      .eq('reconciliation_id', reconciliation_id);

    if (lineItemsError) {
      console.error('Error fetching existing line items:', lineItemsError);
      throw new Error(`Error fetching existing line items: ${lineItemsError.message}`);
    }

    const existingExpenseIds = existingLineItems
      ?.filter(item => item.item_id)
      .map(item => item.item_id) || [];

    console.log(`Found ${existingExpenseIds.length} existing line items`);

    // Find unbilled expenses
    const { data: unbilledExpenses, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .eq('property_id', propertyId)
      .gte('date', firstDayStr)
      .lte('date', lastDayStr)
      .eq('exported', false);

    if (expensesError) {
      console.error('Error fetching expenses:', expensesError);
      throw new Error(`Error fetching unbilled expenses: ${expensesError.message}`);
    }

    // Filter out expenses that are already in line items
    const newExpenses = unbilledExpenses?.filter(
      expense => !existingExpenseIds.includes(expense.id)
    ) || [];

    // Find unbilled visits
    const { data: unbilledVisits, error: visitsError } = await supabase
      .from('visits')
      .select('*')
      .eq('property_id', propertyId)
      .gte('date', firstDayStr)
      .lte('date', lastDayStr)
      .is('billed', false);

    if (visitsError) {
      console.error('Error fetching visits:', visitsError);
      throw new Error(`Error fetching unbilled visits: ${visitsError.message}`);
    }

    // Filter out visits that are already in line items
    const newVisits = unbilledVisits?.filter(
      visit => !existingExpenseIds.includes(visit.id)
    ) || [];

    console.log(`Found ${newExpenses.length} new unbilled expenses, ${newVisits.length} new unbilled visits`);

    const lineItemsToAdd = [];
    let additionalExpenseTotal = 0;
    let additionalVisitTotal = 0;

    // Create line items for new unbilled expenses
    if (newExpenses && newExpenses.length > 0) {
      for (const expense of newExpenses) {
        lineItemsToAdd.push({
          reconciliation_id,
          item_type: 'expense',
          description: expense.purpose || expense.description || 'Expense',
          amount: expense.amount,
          date: expense.date,
          item_id: expense.id,
          verified: true
        });
        additionalExpenseTotal += expense.amount;
      }
    }

    // Create line items for new unbilled visits
    if (newVisits && newVisits.length > 0) {
      for (const visit of newVisits) {
        lineItemsToAdd.push({
          reconciliation_id,
          item_type: 'visit',
          description: `Visit - ${visit.visited_by || 'Standard'}`,
          amount: visit.price || 30,
          date: visit.date,
          item_id: visit.id,
          verified: true
        });
        additionalVisitTotal += visit.price || 30;
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
    const newExpenseTotal = (reconciliation.total_expenses || 0) + additionalExpenseTotal;
    const newVisitTotal = (reconciliation.visit_fees || 0) + additionalVisitTotal;
    const newDueFromOwner = reconciliation.total_revenue - reconciliation.management_fee - reconciliation.order_minimum_fee - newExpenseTotal - newVisitTotal;

    const { error: updateError } = await supabase
      .from('monthly_reconciliations')
      .update({
        total_expenses: newExpenseTotal,
        visit_fees: newVisitTotal,
        net_to_owner: newDueFromOwner
      })
      .eq('id', reconciliation_id);

    if (updateError) {
      throw new Error(`Error updating reconciliation: ${updateError.message}`);
    }

    // Mark new expenses as exported
    if (newExpenses && newExpenses.length > 0) {
      await supabase
        .from('expenses')
        .update({ exported: true })
        .in('id', newExpenses.map(e => e.id));
    }

    // Mark new visits as billed
    if (newVisits && newVisits.length > 0) {
      await supabase
        .from('visits')
        .update({ billed: true })
        .in('id', newVisits.map(v => v.id));
    }

    console.log(`Updated reconciliation totals. New expense total: ${newExpenseTotal}, New visit total: ${newVisitTotal}, New due from owner: ${newDueFromOwner}`);

    // Send revised statement
    console.log('Sending revised statement...');
    const { data: emailData, error: emailError } = await supabase.functions.invoke('send-monthly-report', {
      body: {
        reconciliation_id,
        is_revised: true,
        added_items: lineItemsToAdd.map(item => ({
          description: item.description,
          amount: item.amount,
          date: item.date,
          type: item.item_type
        }))
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
          expenses: newExpenses?.length || 0,
          visits: newVisits?.length || 0
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
