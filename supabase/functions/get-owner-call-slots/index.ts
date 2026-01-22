import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Convert EST time to UTC
function estToUTC(year: number, month: number, day: number, hour: number, minute: number): Date {
  const estDate = new Date(year, month, day, hour, minute, 0, 0);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(estDate);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
  
  // This gives us what the local time would look like in EST
  // We need to find the UTC time that corresponds to our desired EST time
  const isDST = isESTinDST(estDate);
  const offsetHours = isDST ? 4 : 5; // EDT = UTC-4, EST = UTC-5
  
  return new Date(Date.UTC(year, month, day, hour + offsetHours, minute, 0, 0));
}

function isESTinDST(date: Date): boolean {
  const jan = new Date(date.getFullYear(), 0, 1);
  const jul = new Date(date.getFullYear(), 6, 1);
  const stdOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  
  // Create a date in EST timezone to check DST
  const estFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric'
  });
  
  // Check if the offset for this date in EST is different from standard
  const month = date.getMonth();
  // Rough DST check: March-November in EST
  return month >= 2 && month <= 10;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { date } = await req.json();
    
    if (!date) {
      return new Response(
        JSON.stringify({ error: "Date is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse the requested date
    const [year, month, day] = date.split('-').map(Number);
    const requestedDate = new Date(year, month - 1, day);
    const dayOfWeek = requestedDate.getDay();

    // Owner calls: Mon-Fri only (1-5)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return new Response(
        JSON.stringify({ slots: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get availability slots for owner calendar
    const { data: availabilitySlots, error: slotsError } = await supabase
      .from('availability_slots')
      .select('*')
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .eq('calendar_type', 'owner');

    if (slotsError) {
      console.error('Error fetching availability slots:', slotsError);
      throw slotsError;
    }

    // Default to 11am-5pm if no specific slots configured
    const slots = availabilitySlots?.length ? availabilitySlots : [
      { start_time: '11:00', end_time: '17:00' }
    ];

    // Calculate date range for conflict checking (the full day in UTC)
    const dayStart = estToUTC(year, month - 1, day, 0, 0);
    const dayEnd = estToUTC(year, month - 1, day, 23, 59);

    // Get existing discovery calls for this day
    const { data: discoveryConflicts } = await supabase
      .from('discovery_calls')
      .select('scheduled_at, duration_minutes')
      .gte('scheduled_at', dayStart.toISOString())
      .lte('scheduled_at', dayEnd.toISOString())
      .in('status', ['scheduled', 'confirmed']);

    // Get existing owner calls for this day
    const { data: ownerConflicts } = await supabase
      .from('owner_calls')
      .select('scheduled_at, duration_minutes')
      .gte('scheduled_at', dayStart.toISOString())
      .lte('scheduled_at', dayEnd.toISOString())
      .in('status', ['scheduled', 'confirmed']);

    // Combine all conflicts
    const allConflicts = [
      ...(discoveryConflicts || []),
      ...(ownerConflicts || [])
    ];

    // Generate 30-minute time slots
    const availableTimeSlots: string[] = [];
    const now = new Date();
    const SLOT_DURATION = 30; // minutes
    const BUFFER_MINUTES = 15; // Buffer between calls

    for (const slot of slots) {
      const [startHour, startMinute] = slot.start_time.split(':').map(Number);
      const [endHour, endMinute] = slot.end_time.split(':').map(Number);

      let currentHour = startHour;
      let currentMinute = startMinute;

      while (currentHour < endHour || (currentHour === endHour && currentMinute < endMinute)) {
        const slotTimeUTC = estToUTC(year, month - 1, day, currentHour, currentMinute);
        
        // Skip past times
        if (slotTimeUTC <= now) {
          currentMinute += SLOT_DURATION;
          if (currentMinute >= 60) {
            currentHour += Math.floor(currentMinute / 60);
            currentMinute = currentMinute % 60;
          }
          continue;
        }

        // Check for conflicts (including buffer time)
        const slotEnd = new Date(slotTimeUTC.getTime() + (SLOT_DURATION + BUFFER_MINUTES) * 60 * 1000);
        const hasConflict = allConflicts.some(conflict => {
          const conflictStart = new Date(conflict.scheduled_at);
          const conflictEnd = new Date(conflictStart.getTime() + (conflict.duration_minutes || 30) * 60 * 1000);
          
          // Add buffer before the conflict too
          const conflictStartWithBuffer = new Date(conflictStart.getTime() - BUFFER_MINUTES * 60 * 1000);
          
          return slotTimeUTC < conflictEnd && slotEnd > conflictStartWithBuffer;
        });

        if (!hasConflict) {
          availableTimeSlots.push(slotTimeUTC.toISOString());
        }

        // Move to next slot
        currentMinute += SLOT_DURATION;
        if (currentMinute >= 60) {
          currentHour += Math.floor(currentMinute / 60);
          currentMinute = currentMinute % 60;
        }
      }
    }

    console.log(`Generated ${availableTimeSlots.length} slots for ${date}`);

    return new Response(
      JSON.stringify({ slots: availableTimeSlots }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-owner-call-slots:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
