import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

interface AnomalyAlert {
  utility_reading_id: string;
  property_id: string;
  property_name: string;
  alert_type: string;
  severity: string;
  message: string;
  percentage_change: number | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const anomalies: AnomalyAlert[] = [];

    // Get recent utility readings with property info
    const { data: readings, error: readingsError } = await supabase
      .from('utility_readings')
      .select(`
        *,
        properties:property_id (
          id,
          name,
          address,
          property_type
        )
      `)
      .gte('bill_date', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('bill_date', { ascending: false });

    if (readingsError) {
      throw new Error(`Failed to fetch readings: ${readingsError.message}`);
    }

    // Group readings by property and utility type
    const groupedReadings: Record<string, any[]> = {};
    for (const reading of readings || []) {
      if (!reading.property_id) continue;
      const key = `${reading.property_id}-${reading.utility_type}`;
      if (!groupedReadings[key]) {
        groupedReadings[key] = [];
      }
      groupedReadings[key].push(reading);
    }

    // Analyze each group for anomalies
    for (const [key, group] of Object.entries(groupedReadings)) {
      // Sort by bill date descending
      group.sort((a, b) => new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime());
      
      const latestReading = group[0];
      const previousReading = group[1];

      if (!latestReading.properties) continue;

      const propertyName = latestReading.properties.name;

      // Check 1: Usage spike >30% vs previous month
      if (previousReading && latestReading.usage_amount && previousReading.usage_amount) {
        const usageChange = ((latestReading.usage_amount - previousReading.usage_amount) / previousReading.usage_amount) * 100;
        
        if (usageChange > 30) {
          anomalies.push({
            utility_reading_id: latestReading.id,
            property_id: latestReading.property_id,
            property_name: propertyName,
            alert_type: 'usage_spike',
            severity: usageChange > 50 ? 'critical' : 'warning',
            message: `${latestReading.utility_type.toUpperCase()} usage spike: ${usageChange.toFixed(1)}% increase (${previousReading.usage_amount} → ${latestReading.usage_amount} ${latestReading.usage_unit})`,
            percentage_change: usageChange,
          });
        }
      }

      // Check 2: Cost spike >40% vs previous month
      if (previousReading && latestReading.amount_due && previousReading.amount_due) {
        const costChange = ((latestReading.amount_due - previousReading.amount_due) / previousReading.amount_due) * 100;
        
        if (costChange > 40) {
          anomalies.push({
            utility_reading_id: latestReading.id,
            property_id: latestReading.property_id,
            property_name: propertyName,
            alert_type: 'cost_spike',
            severity: costChange > 60 ? 'critical' : 'warning',
            message: `${latestReading.utility_type.toUpperCase()} cost spike: ${costChange.toFixed(1)}% increase ($${previousReading.amount_due.toFixed(2)} → $${latestReading.amount_due.toFixed(2)})`,
            percentage_change: costChange,
          });
        }
      }

      // Check 3: Zero usage during what should be occupied period
      if (latestReading.usage_amount === 0 && latestReading.utility_type !== 'trash') {
        anomalies.push({
          utility_reading_id: latestReading.id,
          property_id: latestReading.property_id,
          property_name: propertyName,
          alert_type: 'zero_usage',
          severity: 'warning',
          message: `${latestReading.utility_type.toUpperCase()}: Zero usage detected. Check if meter reading is correct or if property has issues.`,
          percentage_change: null,
        });
      }

      // Check 4: Unusually high bill (>$500 for most utilities)
      const highThresholds: Record<string, number> = {
        electric: 500,
        gas: 300,
        water: 200,
        internet: 200,
        trash: 150,
      };

      const threshold = highThresholds[latestReading.utility_type] || 500;
      if (latestReading.amount_due > threshold) {
        anomalies.push({
          utility_reading_id: latestReading.id,
          property_id: latestReading.property_id,
          property_name: propertyName,
          alert_type: 'high_bill',
          severity: latestReading.amount_due > threshold * 1.5 ? 'critical' : 'warning',
          message: `${latestReading.utility_type.toUpperCase()}: Unusually high bill of $${latestReading.amount_due.toFixed(2)} (threshold: $${threshold})`,
          percentage_change: null,
        });
      }
    }

    // Check for missing bills (properties without recent readings)
    const { data: properties } = await supabase
      .from('properties')
      .select('id, name')
      .in('property_type', ['Client-Managed', 'Company-Owned']);

    if (properties) {
      for (const property of properties) {
        const propertyReadings = (readings || []).filter(r => r.property_id === property.id);
        
        // Check if we have electric bills in the last 45 days
        const hasRecentElectric = propertyReadings.some(r => 
          r.utility_type === 'electric' && 
          new Date(r.bill_date) > new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
        );

        if (!hasRecentElectric && propertyReadings.length > 0) {
          anomalies.push({
            utility_reading_id: propertyReadings[0]?.id || '',
            property_id: property.id,
            property_name: property.name,
            alert_type: 'missing_bill',
            severity: 'info',
            message: `No electric bill received in the last 45 days. Verify billing is being received.`,
            percentage_change: null,
          });
        }
      }
    }

    // Store anomalies in database
    const newAlerts: any[] = [];
    for (const anomaly of anomalies) {
      // Check if similar alert already exists
      const { data: existingAlert } = await supabase
        .from('utility_anomaly_alerts')
        .select('id')
        .eq('utility_reading_id', anomaly.utility_reading_id)
        .eq('alert_type', anomaly.alert_type)
        .single();

      if (!existingAlert) {
        const { data: insertedAlert, error: insertError } = await supabase
          .from('utility_anomaly_alerts')
          .insert({
            utility_reading_id: anomaly.utility_reading_id || null,
            property_id: anomaly.property_id,
            alert_type: anomaly.alert_type,
            severity: anomaly.severity,
            message: anomaly.message,
            percentage_change: anomaly.percentage_change,
          })
          .select()
          .single();

        if (!insertError && insertedAlert) {
          newAlerts.push({ ...anomaly, id: insertedAlert.id });
        }
      }
    }

    // Send email if there are new critical or warning alerts
    const alertsToEmail = newAlerts.filter(a => a.severity !== 'info');
    
    if (alertsToEmail.length > 0) {
      const alertsHtml = alertsToEmail.map(alert => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px; font-weight: 500;">${alert.property_name}</td>
          <td style="padding: 12px;">
            <span style="
              display: inline-block;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: 500;
              background: ${alert.severity === 'critical' ? '#fee2e2' : '#fef3c7'};
              color: ${alert.severity === 'critical' ? '#dc2626' : '#d97706'};
            ">${alert.severity.toUpperCase()}</span>
          </td>
          <td style="padding: 12px;">${alert.message}</td>
        </tr>
      `).join('');

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; }
            .container { max-width: 800px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #ff8c42 0%, #ff6b35 100%); color: white; padding: 24px; border-radius: 8px 8px 0 0; }
            .content { background: white; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; padding: 12px; background: #f9fafb; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">⚠️ Utility Anomaly Alert</h1>
              <p style="margin: 8px 0 0 0; opacity: 0.9;">${alertsToEmail.length} issue(s) detected requiring attention</p>
            </div>
            <div class="content">
              <table>
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Severity</th>
                    <th>Issue</th>
                  </tr>
                </thead>
                <tbody>
                  ${alertsHtml}
                </tbody>
              </table>
              <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
                Review these anomalies in Property Central's Utilities dashboard.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        await resend.emails.send({
          from: 'PeachHaus <notifications@peachhausgroup.com>',
          to: ['info@peachhausgroup.com'],
          subject: `⚠️ Utility Anomaly Alert: ${alertsToEmail.length} issue(s) detected`,
          html: emailHtml,
        });

        // Mark alerts as email sent
        for (const alert of newAlerts) {
          await supabase
            .from('utility_anomaly_alerts')
            .update({ 
              email_sent: true, 
              email_sent_at: new Date().toISOString() 
            })
            .eq('id', alert.id);
        }

        console.log(`Sent anomaly alert email with ${alertsToEmail.length} issues`);
      } catch (emailError) {
        console.error('Failed to send anomaly alert email:', emailError);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      anomaliesDetected: anomalies.length,
      newAlertsCreated: newAlerts.length,
      emailsSent: alertsToEmail.length > 0 ? 1 : 0,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in utility-anomaly-detector:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
