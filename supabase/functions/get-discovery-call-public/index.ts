import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { callId } = await req.json();

    if (!callId) {
      return new Response(
        JSON.stringify({ error: "Call ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch discovery call with limited public data
    const { data: call, error: callError } = await supabase
      .from("discovery_calls")
      .select(`
        id,
        scheduled_at,
        duration_minutes,
        meeting_type,
        google_meet_link,
        status,
        lead:leads!discovery_calls_lead_id_fkey (
          first_name,
          email,
          phone
        )
      `)
      .eq("id", callId)
      .single();

    if (callError || !call) {
      console.error("Error fetching call:", callError);
      return new Response(
        JSON.stringify({ error: "Discovery call not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only allow rescheduling for future, non-cancelled calls
    const scheduledAt = new Date(call.scheduled_at);
    const now = new Date();
    
    if (call.status === "cancelled") {
      return new Response(
        JSON.stringify({ error: "This call has been cancelled", canReschedule: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (call.status === "completed") {
      return new Response(
        JSON.stringify({ error: "This call has already been completed", canReschedule: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Allow rescheduling up to 1 hour before the call
    const oneHourBefore = new Date(scheduledAt.getTime() - 60 * 60 * 1000);
    if (now > oneHourBefore) {
      return new Response(
        JSON.stringify({ 
          error: "Cannot reschedule within 1 hour of the scheduled time",
          canReschedule: false,
          scheduledAt: call.scheduled_at
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch available time slots (next 30 days, excluding already booked times)
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const { data: bookedCalls } = await supabase
      .from("discovery_calls")
      .select("scheduled_at, duration_minutes")
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", thirtyDaysFromNow.toISOString())
      .in("status", ["scheduled", "confirmed"])
      .neq("id", callId);

    // Fetch availability slots
    const { data: availabilitySlots } = await supabase
      .from("availability_slots")
      .select("*")
      .eq("is_active", true);

    // Fetch blocked dates
    const { data: blockedDates } = await supabase
      .from("blocked_dates")
      .select("date")
      .gte("date", now.toISOString().split("T")[0])
      .lte("date", thirtyDaysFromNow.toISOString().split("T")[0]);

    const blockedDateSet = new Set(blockedDates?.map(b => b.date) || []);

    // Generate available slots for the next 30 days
    const availableSlots: string[] = [];
    const lead = call.lead as any;

    for (let dayOffset = 1; dayOffset <= 30; dayOffset++) {
      const date = new Date(now);
      date.setDate(date.getDate() + dayOffset);
      const dateStr = date.toISOString().split("T")[0];
      
      // Skip blocked dates
      if (blockedDateSet.has(dateStr)) continue;
      
      const dayOfWeek = date.getDay();
      
      // Find availability for this day
      const daySlots = availabilitySlots?.filter(s => s.day_of_week === dayOfWeek) || [];
      
      for (const slot of daySlots) {
        // Generate 30-minute intervals within this slot
        const [startHour, startMin] = slot.start_time.split(":").map(Number);
        const [endHour, endMin] = slot.end_time.split(":").map(Number);
        
        let currentHour = startHour;
        let currentMin = startMin;
        
        while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
          const slotTime = new Date(date);
          slotTime.setHours(currentHour, currentMin, 0, 0);
          
          // Check if this slot conflicts with any booked call
          const duration = call.duration_minutes || 30;
          const slotEnd = new Date(slotTime.getTime() + duration * 60 * 1000);
          
          const hasConflict = bookedCalls?.some(booked => {
            const bookedStart = new Date(booked.scheduled_at);
            const bookedEnd = new Date(bookedStart.getTime() + (booked.duration_minutes || 30) * 60 * 1000);
            return slotTime < bookedEnd && slotEnd > bookedStart;
          });
          
          if (!hasConflict && slotTime > now) {
            availableSlots.push(slotTime.toISOString());
          }
          
          // Move to next 30-minute slot
          currentMin += 30;
          if (currentMin >= 60) {
            currentMin = 0;
            currentHour++;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        canReschedule: true,
        call: {
          id: call.id,
          scheduledAt: call.scheduled_at,
          durationMinutes: call.duration_minutes || 30,
          meetingType: call.meeting_type || "video",
          firstName: lead?.first_name || "Guest",
        },
        availableSlots: availableSlots.slice(0, 100), // Limit to first 100 slots
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in get-discovery-call-public:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
