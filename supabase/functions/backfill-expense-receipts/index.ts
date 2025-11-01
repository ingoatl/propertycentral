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

    console.log('Starting expense receipts backfill...');

    // Find all expenses without email screenshots
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select('*, email_insights!inner(subject, sender_email, email_date, summary, category)')
      .is('email_screenshot_path', null)
      .not('email_insights', 'is', null);

    if (expensesError) {
      console.error('Error fetching expenses:', expensesError);
      throw expensesError;
    }

    if (!expenses || expenses.length === 0) {
      console.log('No expenses to backfill');
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No expenses need receipts' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${expenses.length} expenses to backfill`);

    let processed = 0;
    let failed = 0;

    for (const expense of expenses) {
      try {
        const insight = (expense as any).email_insights;
        
        // Generate HTML receipt
        const emailContent = `
          <html>
            <head>
              <meta charset="utf-8">
              <title>${insight.subject || 'Expense Receipt'}</title>
              <style>
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                  padding: 40px;
                  max-width: 800px;
                  margin: 0 auto;
                  background: #f5f5f5;
                }
                .receipt {
                  background: white;
                  padding: 30px;
                  border-radius: 8px;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .header {
                  border-bottom: 3px solid #333;
                  padding-bottom: 20px;
                  margin-bottom: 30px;
                }
                .header h1 {
                  margin: 0 0 10px 0;
                  color: #333;
                  font-size: 24px;
                }
                .meta {
                  color: #666;
                  font-size: 14px;
                  margin: 5px 0;
                }
                .meta strong {
                  color: #333;
                }
                .section {
                  margin: 20px 0;
                }
                .section-title {
                  font-weight: bold;
                  color: #333;
                  margin-bottom: 10px;
                  font-size: 16px;
                }
                .amount {
                  font-size: 32px;
                  font-weight: bold;
                  color: #e53e3e;
                  margin: 20px 0;
                }
                .items {
                  background: #f9f9f9;
                  padding: 15px;
                  border-radius: 4px;
                  margin: 15px 0;
                }
                .item-row {
                  display: flex;
                  justify-content: space-between;
                  padding: 8px 0;
                  border-bottom: 1px solid #e0e0e0;
                }
                .item-row:last-child {
                  border-bottom: none;
                }
              </style>
            </head>
            <body>
              <div class="receipt">
                <div class="header">
                  <h1>${insight.subject || 'Expense Receipt'}</h1>
                  <div class="meta"><strong>From:</strong> ${insight.sender_email}</div>
                  <div class="meta"><strong>Date:</strong> ${new Date(insight.email_date).toLocaleString()}</div>
                  <div class="meta"><strong>Category:</strong> ${insight.category || 'N/A'}</div>
                </div>
                
                <div class="amount">$${expense.amount.toFixed(2)}</div>
                
                ${expense.vendor ? `
                  <div class="section">
                    <div class="section-title">Vendor</div>
                    <div>${expense.vendor}</div>
                  </div>
                ` : ''}
                
                ${expense.order_number ? `
                  <div class="section">
                    <div class="section-title">Order Number</div>
                    <div>${expense.order_number}</div>
                  </div>
                ` : ''}
                
                ${expense.line_items?.items ? `
                  <div class="section">
                    <div class="section-title">Items Purchased</div>
                    <div class="items">
                      ${expense.line_items.items.map((item: any) => `
                        <div class="item-row">
                          <span>${item.name}</span>
                          <span><strong>$${item.price.toFixed(2)}</strong></span>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                ` : expense.items_detail ? `
                  <div class="section">
                    <div class="section-title">Items</div>
                    <div>${expense.items_detail}</div>
                  </div>
                ` : ''}
                
                ${expense.delivery_address ? `
                  <div class="section">
                    <div class="section-title">Delivery Address</div>
                    <div>${expense.delivery_address}</div>
                  </div>
                ` : ''}
                
                ${expense.purpose ? `
                  <div class="section">
                    <div class="section-title">Description</div>
                    <div>${expense.purpose}</div>
                  </div>
                ` : ''}
                
                ${insight.summary ? `
                  <div class="section">
                    <div class="section-title">Summary</div>
                    <div>${insight.summary}</div>
                  </div>
                ` : ''}
              </div>
            </body>
          </html>
        `;
        
        const fileName = `receipt-${expense.id}-${Date.now()}.html`;
        const filePath = `${expense.property_id}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('expense-documents')
          .upload(filePath, emailContent, {
            contentType: 'text/html',
            upsert: false
          });
        
        if (uploadError) {
          console.error(`Failed to upload receipt for expense ${expense.id}:`, uploadError);
          failed++;
          continue;
        }
        
        // Update expense with receipt path
        const { error: updateError } = await supabase
          .from('expenses')
          .update({ email_screenshot_path: filePath })
          .eq('id', expense.id);
        
        if (updateError) {
          console.error(`Failed to update expense ${expense.id}:`, updateError);
          failed++;
          continue;
        }
        
        processed++;
        console.log(`Created receipt for expense ${expense.id}`);
        
      } catch (err) {
        console.error(`Error processing expense ${expense.id}:`, err);
        failed++;
      }
    }

    console.log(`Backfill completed: ${processed} receipts created, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        failed,
        total: expenses.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in backfill-expense-receipts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
