import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Running holiday email scheduler check...');

    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Also check for recurring holidays - match month and day
    const monthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    console.log('Checking for holidays on:', todayStr, 'or matching month-day:', monthDay);

    // Find active holiday templates for today
    const { data: templates, error: templatesError } = await supabase
      .from('holiday_email_templates')
      .select('*')
      .eq('is_active', true);

    if (templatesError) {
      throw new Error(`Failed to fetch templates: ${templatesError.message}`);
    }

    // Filter templates that match today
    const todaysHolidays = templates?.filter(template => {
      const templateDate = template.holiday_date;
      
      // Exact date match
      if (templateDate === todayStr) return true;
      
      // For recurring holidays, match month-day pattern
      if (template.recurring) {
        const templateMonthDay = templateDate.substring(5); // Get MM-DD part
        return templateMonthDay === monthDay;
      }
      
      return false;
    }) || [];

    if (todaysHolidays.length === 0) {
      console.log('No holidays scheduled for today');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No holidays scheduled for today',
          checkedDate: todayStr
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${todaysHolidays.length} holiday(s) for today:`, todaysHolidays.map(h => h.holiday_name));

    const results: any[] = [];

    for (const holiday of todaysHolidays) {
      // Check if we already sent emails for this holiday today
      const { data: existingLogs } = await supabase
        .from('holiday_email_logs')
        .select('id')
        .eq('holiday_template_id', holiday.id)
        .gte('sent_at', todayStr)
        .limit(1);

      if (existingLogs && existingLogs.length > 0) {
        console.log(`Already sent ${holiday.holiday_name} emails today, skipping`);
        results.push({
          holiday: holiday.holiday_name,
          status: 'skipped',
          reason: 'Already sent today'
        });
        continue;
      }

      console.log(`Sending ${holiday.holiday_name} emails to all owners...`);

      // Call send-holiday-email function for this template
      try {
        const sendResponse = await fetch(`${supabaseUrl}/functions/v1/send-holiday-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            holidayTemplateId: holiday.id
          }),
        });

        const sendResult = await sendResponse.json();
        
        if (sendResponse.ok) {
          console.log(`${holiday.holiday_name} emails sent:`, sendResult);
          results.push({
            holiday: holiday.holiday_name,
            status: 'sent',
            ...sendResult
          });
        } else {
          console.error(`Failed to send ${holiday.holiday_name}:`, sendResult);
          results.push({
            holiday: holiday.holiday_name,
            status: 'error',
            error: sendResult.error
          });
        }
      } catch (sendError) {
        console.error(`Error sending ${holiday.holiday_name}:`, sendError);
        results.push({
          holiday: holiday.holiday_name,
          status: 'error',
          error: sendError instanceof Error ? sendError.message : 'Unknown error'
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${todaysHolidays.length} holiday(s)`,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in holiday email scheduler:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
