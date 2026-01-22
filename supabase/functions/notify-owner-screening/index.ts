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
    const { screeningId } = await req.json();

    if (!screeningId) {
      return new Response(
        JSON.stringify({ error: 'screeningId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch screening with property and owner info
    const { data: screening, error: screeningError } = await supabase
      .from('guest_screenings')
      .select(`
        *,
        property:properties(
          id,
          name,
          address,
          owner_id
        ),
        booking:ownerrez_bookings(
          id,
          guest_name,
          check_in,
          check_out
        )
      `)
      .eq('id', screeningId)
      .single();

    if (screeningError || !screening) {
      console.error('Screening not found:', screeningError);
      return new Response(
        JSON.stringify({ error: 'Screening not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already notified
    if (screening.owner_notified) {
      console.log('Owner already notified for screening:', screeningId);
      return new Response(
        JSON.stringify({ success: true, message: 'Already notified' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get owner info
    const { data: owner, error: ownerError } = await supabase
      .from('property_owners')
      .select('id, name, email, second_owner_email')
      .eq('id', screening.property.owner_id)
      .single();

    if (ownerError || !owner) {
      console.error('Owner not found:', ownerError);
      return new Response(
        JSON.stringify({ error: 'Owner not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format check-in date
    const checkInDate = screening.booking?.check_in
      ? new Date(screening.booking.check_in).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'Not specified';

    // Build status message
    const statusEmoji = screening.screening_status === 'passed' ? '✅' : 
                        screening.screening_status === 'flagged' ? '⚠️' : '❌';
    const statusText = screening.screening_status === 'passed' ? 'Verified' : 
                       screening.screening_status === 'flagged' ? 'Flagged for Review' : 'Failed';

    // Build verification badges
    const verificationBadges = [];
    if (screening.id_verified) verificationBadges.push('ID Verified');
    if (screening.background_passed) verificationBadges.push('Background Check Passed');
    if (screening.watchlist_clear) verificationBadges.push('Watchlist Clear');

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send email to owner
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
            .content { background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 12px 12px; }
            .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: 600; margin-bottom: 20px; }
            .status-passed { background: #d1fae5; color: #059669; }
            .status-flagged { background: #fef3c7; color: #d97706; }
            .status-failed { background: #fee2e2; color: #dc2626; }
            .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f3f4f6; }
            .detail-label { color: #6b7280; }
            .detail-value { font-weight: 600; }
            .badge { display: inline-block; background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-right: 4px; }
            .cta { display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 24px;">${statusEmoji} Guest Verification Complete</h1>
            </div>
            <div class="content">
              <p>Hi ${owner.name.split(' ')[0]},</p>
              
              <p>Great news! Your upcoming guest has completed their verification process.</p>
              
              <div class="status-badge status-${screening.screening_status}">
                ${statusText}
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Guest</span>
                <span class="detail-value">${screening.guest_name}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Property</span>
                <span class="detail-value">${screening.property.name}</span>
              </div>
              
              <div class="detail-row">
                <span class="detail-label">Check-in</span>
                <span class="detail-value">${checkInDate}</span>
              </div>
              
              ${verificationBadges.length > 0 ? `
              <div style="margin-top: 20px;">
                <p class="detail-label" style="margin-bottom: 8px;">Verifications Completed:</p>
                ${verificationBadges.map(b => `<span class="badge">✓ ${b}</span>`).join(' ')}
              </div>
              ` : ''}
              
              ${screening.notes ? `
              <div style="margin-top: 20px; padding: 16px; background: #f9fafb; border-radius: 8px;">
                <p class="detail-label" style="margin: 0 0 8px 0;">Notes:</p>
                <p style="margin: 0;">${screening.notes}</p>
              </div>
              ` : ''}
              
              <p style="margin-top: 24px;">You can view full details in your Owner Portal.</p>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
                Best regards,<br>
                PeachHaus Group Property Management
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Collect recipient emails
    const recipients = [owner.email];
    if (owner.second_owner_email) {
      recipients.push(owner.second_owner_email);
    }

    // Send via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PeachHaus Group <admin@peachhausgroup.com>',
        to: recipients,
        subject: `${statusEmoji} Guest Verified for ${screening.property.name} - ${checkInDate}`,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      console.error('Failed to send email:', error);
      throw new Error('Failed to send notification email');
    }

    // Mark as notified
    await supabase
      .from('guest_screenings')
      .update({ owner_notified: true })
      .eq('id', screeningId);

    console.log('Owner notification sent for screening:', screeningId);

    return new Response(
      JSON.stringify({ success: true, recipients }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in notify-owner-screening:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
