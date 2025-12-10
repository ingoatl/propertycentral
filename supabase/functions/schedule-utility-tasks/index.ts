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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    console.log('Running scheduled utility tasks...');

    const results = {
      scan: { success: false, error: null as string | null },
      anomalyDetection: { success: false, error: null as string | null },
      providerRecommendations: { success: false, error: null as string | null },
    };

    // 1. Run utility inbox scan (12 months of data)
    try {
      console.log('Starting utility inbox scan...');
      const scanResponse = await fetch(`${supabaseUrl}/functions/v1/scan-utilities-inbox`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ months: 12 }),
      });
      
      if (scanResponse.ok) {
        results.scan.success = true;
        console.log('Utility inbox scan completed successfully');
      } else {
        results.scan.error = await scanResponse.text();
        console.error('Utility inbox scan failed:', results.scan.error);
      }
    } catch (scanError) {
      results.scan.error = scanError instanceof Error ? scanError.message : 'Unknown error';
      console.error('Utility scan error:', scanError);
    }

    // 2. Run anomaly detection
    try {
      console.log('Starting anomaly detection...');
      const anomalyResponse = await fetch(`${supabaseUrl}/functions/v1/utility-anomaly-detector`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      
      if (anomalyResponse.ok) {
        results.anomalyDetection.success = true;
        console.log('Anomaly detection completed successfully');
      } else {
        results.anomalyDetection.error = await anomalyResponse.text();
        console.error('Anomaly detection failed:', results.anomalyDetection.error);
      }
    } catch (anomalyError) {
      results.anomalyDetection.error = anomalyError instanceof Error ? anomalyError.message : 'Unknown error';
      console.error('Anomaly detection error:', anomalyError);
    }

    // 3. Run provider recommendations
    try {
      console.log('Starting provider recommendations analysis...');
      const recsResponse = await fetch(`${supabaseUrl}/functions/v1/utility-provider-recommendations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      
      if (recsResponse.ok) {
        results.providerRecommendations.success = true;
        console.log('Provider recommendations completed successfully');
      } else {
        results.providerRecommendations.error = await recsResponse.text();
        console.error('Provider recommendations failed:', results.providerRecommendations.error);
      }
    } catch (recsError) {
      results.providerRecommendations.error = recsError instanceof Error ? recsError.message : 'Unknown error';
      console.error('Provider recommendations error:', recsError);
    }

    console.log('Scheduled utility tasks completed:', results);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Scheduled utility tasks completed',
      results,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in schedule-utility-tasks:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
