import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// EST timezone constant
const EST_TIMEZONE = 'America/New_York';

// Convert an EST time to UTC
function estToUTC(year: number, month: number, day: number, hour: number, minute: number): Date {
  // Create a date string in EST
  const estString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
  
  // Use Intl to determine the offset for this specific date in EST
  const testDate = new Date(estString + 'Z'); // Treat as UTC temporarily
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: EST_TIMEZONE,
    hour: 'numeric',
    hour12: false
  });
  
  // Determine if EST (-5) or EDT (-4) by checking the hour difference
  const parts = formatter.formatToParts(testDate);
  const estHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const utcHour = testDate.getUTCHours();
  const offset = (estHour - utcHour + 24) % 24;
  
  // Standard EST is -5 (offset would show as 19), EDT is -4 (offset would show as 20)
  const hoursToAdd = offset <= 12 ? offset : offset - 24;
  
  // Create the actual EST time and add the offset to get UTC
  const estDate = new Date(Date.UTC(year, month, day, hour, minute, 0, 0));
  // Adjust: if EST is -5, we need to add 5 hours to get UTC
  const isDST = isESTinDST(new Date(year, month, day));
  const utcDate = new Date(estDate.getTime() + (isDST ? 4 : 5) * 60 * 60 * 1000);
  
  return utcDate;
}

// Check if a date is in EDT (Daylight Saving Time)
function isESTinDST(date: Date): boolean {
  const jan = new Date(date.getFullYear(), 0, 1);
  const jul = new Date(date.getFullYear(), 6, 1);
  const janOffset = jan.getTimezoneOffset();
  const julOffset = jul.getTimezoneOffset();
  const maxOffset = Math.max(janOffset, julOffset);
  return date.getTimezoneOffset() < maxOffset;
}

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
          name,
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

    // Get current time in EST for proper comparison
    const nowUTC = now.getTime();

    for (let dayOffset = 1; dayOffset <= 30; dayOffset++) {
      const futureDate = new Date(now);
      futureDate.setDate(futureDate.getDate() + dayOffset);
      
      // Get the EST date for this future date
      const estDateStr = futureDate.toLocaleDateString('en-CA', { timeZone: EST_TIMEZONE });
      const [yearStr, monthStr, dayStr] = estDateStr.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr) - 1;
      const day = parseInt(dayStr);
      
      // Skip blocked dates (comparing in EST)
      if (blockedDateSet.has(estDateStr)) continue;
      
      // Get day of week in EST
      const estDayOfWeek = new Date(year, month, day).getDay();
      
      // Find availability for this day
      const daySlots = availabilitySlots?.filter(s => s.day_of_week === estDayOfWeek) || [];
      
      for (const slot of daySlots) {
        // Generate 30-minute intervals within this slot (times are in EST)
        const [startHour, startMin] = slot.start_time.split(":").map(Number);
        const [endHour, endMin] = slot.end_time.split(":").map(Number);
        
        let currentHour = startHour;
        let currentMin = startMin;
        
        while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
          // Convert EST slot time to UTC
          const slotTimeUTC = estToUTC(year, month, day, currentHour, currentMin);
          
          // Check if this slot conflicts with any booked call
          const duration = call.duration_minutes || 30;
          const slotEndUTC = new Date(slotTimeUTC.getTime() + duration * 60 * 1000);
          
          const hasConflict = bookedCalls?.some(booked => {
            const bookedStart = new Date(booked.scheduled_at);
            const bookedEnd = new Date(bookedStart.getTime() + (booked.duration_minutes || 30) * 60 * 1000);
            return slotTimeUTC < bookedEnd && slotEndUTC > bookedStart;
          });
          
          // Only add if not conflicting and in the future
          if (!hasConflict && slotTimeUTC.getTime() > nowUTC) {
            availableSlots.push(slotTimeUTC.toISOString());
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

    console.log(`Generated ${availableSlots.length} available slots`);

    return new Response(
      JSON.stringify({
        canReschedule: true,
        call: {
          id: call.id,
          scheduledAt: call.scheduled_at,
          durationMinutes: call.duration_minutes || 30,
          meetingType: call.meeting_type || "video",
          firstName: lead?.name?.split(' ')[0] || "Guest",
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
