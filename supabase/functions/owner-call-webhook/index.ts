import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CALENDAR_SYNC_USER_ID = Deno.env.get('CALENDAR_SYNC_USER_ID');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, email, phone, topic, topicDetails, scheduledAt, propertyId, meetingType } = await req.json();

    // Validate required fields
    if (!name || !email || !topic || !scheduledAt) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: name, email, topic, and scheduledAt are required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate phone for phone calls
    if (meetingType === 'phone' && !phone) {
      return new Response(
        JSON.stringify({ error: "Phone number required for phone calls" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to find existing owner by email
    const { data: existingOwner } = await supabase
      .from('property_owners')
      .select('id, name')
      .ilike('email', email)
      .maybeSingle();

    // Get property info if provided
    let propertyInfo = null;
    if (propertyId) {
      const { data: prop } = await supabase
        .from('properties')
        .select('id, name, address')
        .eq('id', propertyId)
        .maybeSingle();
      propertyInfo = prop;
    }

    // Create the owner call record
    const { data: ownerCall, error: callError } = await supabase
      .from('owner_calls')
      .insert({
        owner_id: existingOwner?.id || null,
        contact_name: name,
        contact_email: email.toLowerCase(),
        contact_phone: phone || null,
        topic,
        topic_details: topicDetails || null,
        scheduled_at: scheduledAt,
        status: 'scheduled',
        duration_minutes: 30,
        meeting_type: meetingType || 'video',
      })
      .select()
      .single();

    if (callError) {
      console.error('Error creating owner call:', callError);
      throw callError;
    }

    console.log('Owner call created:', ownerCall.id, 'Meeting type:', meetingType);

    // Topic labels for calendar event
    const topicLabels: Record<string, string> = {
      monthly_statement: "Monthly Statement Questions",
      maintenance: "Maintenance & Repairs",
      guest_concerns: "Guest Concerns",
      pricing: "Pricing Discussion",
      general_checkin: "General Check-in",
      property_update: "Property Updates",
      other: "Other"
    };

    // Create Google Calendar event using google-calendar-sync
    let calendarEventId: string | null = null;
    let googleMeetLink: string | null = null;
    
    try {
      const isVideoCall = meetingType !== 'phone';
      const eventTitle = `Owner Call: ${name}${existingOwner ? '' : ' (New)'}${isVideoCall ? '' : ' 📞'}`;
      const eventDescription = `
📋 Topic: ${topicLabels[topic] || topic}
${topicDetails ? `\n📝 Details: ${topicDetails}` : ''}

👤 Contact: ${name}
📧 Email: ${email}
${phone ? `📱 Phone: ${phone}` : ''}
${isVideoCall ? '🎥 Meeting Type: Video Call' : `📞 Meeting Type: Phone Call - Call ${phone}`}
${propertyInfo ? `\n🏠 Property: ${propertyInfo.name}\n📍 Address: ${propertyInfo.address}` : ''}
${existingOwner ? `\n✅ Existing Owner ID: ${existingOwner.id}` : '\n⚠️ Owner not found in system - may be a new inquiry'}
      `.trim();

      const startTime = new Date(scheduledAt);
      const endTime = new Date(startTime.getTime() + 30 * 60000); // 30 minutes

      // Use the admin user ID for calendar sync
      if (CALENDAR_SYNC_USER_ID) {
        console.log('Creating calendar event via google-calendar-sync...');
        
        const { data: calResult, error: calError } = await supabase.functions.invoke('google-calendar-sync', {
          body: {
            action: 'create-event-direct',
            userId: CALENDAR_SYNC_USER_ID,
            summary: eventTitle,
            description: eventDescription,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            attendeeEmail: email,
            addConferenceData: isVideoCall, // Only add Meet link for video calls
          }
        });

        if (calError) {
          console.error('Calendar sync error:', calError);
        } else if (calResult) {
          console.log('Calendar sync result:', JSON.stringify(calResult));
          calendarEventId = calResult.eventId || null;
          googleMeetLink = calResult.meetLink || null;
          
          // Update the owner call with the calendar event ID and meet link
          if (calendarEventId || googleMeetLink) {
            await supabase
              .from('owner_calls')
              .update({
                google_calendar_event_id: calendarEventId,
                google_meet_link: isVideoCall ? googleMeetLink : null
              })
              .eq('id', ownerCall.id);
            
            console.log('Updated owner call with calendar event ID:', calendarEventId, 'Meet link:', googleMeetLink);
          }
        }
      } else {
        console.warn('CALENDAR_SYNC_USER_ID not configured - skipping calendar sync');
      }
    } catch (calendarError) {
      console.error('Failed to create calendar event:', calendarError);
      // Don't fail the booking if calendar sync fails
    }

    // Trigger notification function (it will fetch the updated record with meet link)
    try {
      await supabase.functions.invoke('owner-call-notifications', {
        body: {
          ownerCallId: ownerCall.id,
          notificationType: 'confirmation'
        }
      });
    } catch (notifyError) {
      console.error('Failed to send notification:', notifyError);
      // Don't fail the booking if notification fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        ownerCallId: ownerCall.id,
        isExistingOwner: !!existingOwner,
        meetingType: meetingType || 'video',
        googleMeetLink: googleMeetLink,
        calendarEventId: calendarEventId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in owner-call-webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
