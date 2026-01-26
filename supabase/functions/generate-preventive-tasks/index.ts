import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Schedule {
  id: string;
  property_id: string;
  template_id: string;
  is_enabled: boolean;
  preferred_vendor_id: string | null;
  next_due_at: string | null;
  custom_frequency_months: number | null;
  property: { id: string; name: string } | null;
  template: {
    id: string;
    name: string;
    category: string;
    frequency_months: number;
    preferred_months: number[] | null;
    requires_vacancy: boolean;
  } | null;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

async function checkBookingConflict(
  supabase: any,
  propertyId: string,
  targetDate: string
): Promise<boolean> {
  // Check if there's an active booking on this date
  const { data: bookings } = await supabase
    .from("ownerrez_bookings")
    .select("id")
    .eq("property_id", propertyId)
    .lte("arrival_date", targetDate)
    .gte("departure_date", targetDate)
    .in("status", ["confirmed", "arrived"])
    .limit(1);

  return bookings && bookings.length > 0;
}

async function findVacantDate(
  supabase: any,
  propertyId: string,
  preferredDate: string,
  daysToCheck: number = 7
): Promise<string | null> {
  const startDate = new Date(preferredDate + "T12:00:00");

  for (let i = 0; i < daysToCheck; i++) {
    const checkDate = formatDate(addMonths(startDate, 0));
    const dateToCheck = new Date(startDate);
    dateToCheck.setDate(dateToCheck.getDate() + i);
    const formattedDate = formatDate(dateToCheck);

    const hasConflict = await checkBookingConflict(supabase, propertyId, formattedDate);
    if (!hasConflict) {
      return formattedDate;
    }
  }

  // Try before the preferred date
  for (let i = 1; i <= daysToCheck; i++) {
    const dateToCheck = new Date(startDate);
    dateToCheck.setDate(dateToCheck.getDate() - i);
    const formattedDate = formatDate(dateToCheck);

    const hasConflict = await checkBookingConflict(supabase, propertyId, formattedDate);
    if (!hasConflict) {
      return formattedDate;
    }
  }

  return null;
}

async function autoAssignVendor(
  supabase: any,
  propertyId: string,
  category: string,
  preferredVendorId: string | null
): Promise<{ vendorId: string | null; reason: string }> {
  // If preferred vendor specified, use it
  if (preferredVendorId) {
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id, name, status")
      .eq("id", preferredVendorId)
      .in("status", ["active", "preferred"])
      .single();

    if (vendor) {
      return { vendorId: vendor.id, reason: "Preferred vendor" };
    }
  }

  // Find best vendor by rating for this category
  const { data: vendors } = await supabase
    .from("vendors")
    .select("*")
    .in("status", ["active", "preferred"])
    .contains("specialty", [category])
    .order("average_rating", { ascending: false })
    .limit(5);

  if (!vendors || vendors.length === 0) {
    return { vendorId: null, reason: "No vendors available" };
  }

  // Calculate scores and pick the best
  const scored = vendors.map((v: any) => {
    const ratingScore = (v.average_rating || 3) * 8;
    const responseScore = v.average_response_time_hours
      ? (48 - Math.min(v.average_response_time_hours, 48)) * 0.625
      : 15;
    const experienceScore = Math.min(v.total_jobs_completed || 0, 100) * 0.2;
    const insuranceScore = v.insurance_verified ? 10 : 0;
    const preferredBonus = v.status === "preferred" ? 15 : 0;

    return {
      ...v,
      score: ratingScore + responseScore + experienceScore + insuranceScore + preferredBonus,
    };
  });

  scored.sort((a: any, b: any) => b.score - a.score);
  const best = scored[0];

  return {
    vendorId: best.id,
    reason: `Best ${category} vendor (score: ${best.score.toFixed(1)})`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date();
    const thirtyDaysFromNow = addMonths(today, 1);
    const todayStr = formatDate(today);
    const futureStr = formatDate(thirtyDaysFromNow);

    console.log(`Generating preventive maintenance tasks from ${todayStr} to ${futureStr}`);

    // Get all enabled schedules with next_due_at within 30 days
    const { data: schedules, error: scheduleError } = await supabase
      .from("property_maintenance_schedules")
      .select(`
        *,
        property:properties(id, name),
        template:preventive_maintenance_templates(*)
      `)
      .eq("is_enabled", true)
      .lte("next_due_at", futureStr)
      .gte("next_due_at", todayStr);

    if (scheduleError) {
      throw scheduleError;
    }

    console.log(`Found ${schedules?.length || 0} schedules due within 30 days`);

    let tasksCreated = 0;
    let tasksSkipped = 0;

    for (const schedule of schedules || []) {
      if (!schedule.template || !schedule.property) {
        console.log(`Skipping schedule ${schedule.id} - missing template or property`);
        continue;
      }

      // Check if task already exists for this schedule and date
      const { data: existingTask } = await supabase
        .from("scheduled_maintenance_tasks")
        .select("id")
        .eq("schedule_id", schedule.id)
        .eq("scheduled_date", schedule.next_due_at)
        .single();

      if (existingTask) {
        console.log(`Task already exists for schedule ${schedule.id} on ${schedule.next_due_at}`);
        tasksSkipped++;
        continue;
      }

      // Check for booking conflicts if task requires vacancy
      let scheduledDate = schedule.next_due_at;
      if (schedule.template.requires_vacancy) {
        const hasConflict = await checkBookingConflict(
          supabase,
          schedule.property_id,
          schedule.next_due_at
        );

        if (hasConflict) {
          console.log(`Booking conflict on ${schedule.next_due_at} for ${schedule.property.name}`);
          const vacantDate = await findVacantDate(
            supabase,
            schedule.property_id,
            schedule.next_due_at
          );

          if (vacantDate) {
            scheduledDate = vacantDate;
            console.log(`Rescheduled to vacant date: ${vacantDate}`);
          } else {
            console.log(`No vacant date found, using original date anyway`);
          }
        }
      }

      // Auto-assign vendor
      const { vendorId, reason } = await autoAssignVendor(
        supabase,
        schedule.property_id,
        schedule.template.category,
        schedule.preferred_vendor_id
      );

      // Create the scheduled task
      const { error: insertError } = await supabase.from("scheduled_maintenance_tasks").insert({
        schedule_id: schedule.id,
        property_id: schedule.property_id,
        template_id: schedule.template_id,
        assigned_vendor_id: vendorId,
        scheduled_date: scheduledDate,
        status: "scheduled",
        auto_assigned: true,
        assignment_reason: reason,
      });

      if (insertError) {
        console.error(`Failed to create task for schedule ${schedule.id}:`, insertError);
        continue;
      }

      tasksCreated++;
      console.log(
        `Created task for ${schedule.template.name} at ${schedule.property.name} on ${scheduledDate}`
      );

      // Update schedule's next_due_at for the next cycle
      const frequencyMonths = schedule.custom_frequency_months || schedule.template.frequency_months;
      const nextDueDate = addMonths(new Date(schedule.next_due_at + "T12:00:00"), frequencyMonths);

      await supabase
        .from("property_maintenance_schedules")
        .update({
          next_due_at: formatDate(nextDueDate),
          updated_at: new Date().toISOString(),
        })
        .eq("id", schedule.id);
    }

    const result = {
      success: true,
      tasksCreated,
      tasksSkipped,
      schedulesProcessed: schedules?.length || 0,
    };

    console.log("Generation complete:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in generate-preventive-tasks:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
