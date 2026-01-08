import { useState } from "react";
import { Calendar, Clock, Phone, X, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, setHours, setMinutes, isBefore, isToday, addMinutes } from "date-fns";

interface ScheduleDiscoveryCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  leadPhone?: string;
  onScheduled?: () => void;
}

// Generate time slots from 9 AM to 5 PM in 15-minute increments
const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 9; hour < 17; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
      slots.push(time);
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

export function ScheduleDiscoveryCallDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  leadPhone,
  onScheduled,
}: ScheduleDiscoveryCallDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  // Fetch existing scheduled calls to block those times
  const { data: existingCalls = [] } = useQuery({
    queryKey: ["discovery-calls-scheduled"],
    queryFn: async () => {
      const { data } = await supabase
        .from("discovery_calls")
        .select("scheduled_at, duration_minutes")
        .eq("status", "scheduled")
        .gte("scheduled_at", new Date().toISOString());
      return data || [];
    },
    enabled: open,
  });

  // Check if a time slot is already booked
  const isTimeSlotBooked = (date: Date, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const slotStart = setMinutes(setHours(date, hours), minutes);
    const slotEnd = addMinutes(slotStart, 15);

    return existingCalls.some((call) => {
      const callStart = new Date(call.scheduled_at);
      const callEnd = addMinutes(callStart, call.duration_minutes || 15);
      return (
        (slotStart >= callStart && slotStart < callEnd) ||
        (slotEnd > callStart && slotEnd <= callEnd)
      );
    });
  };

  // Check if time slot is in the past
  const isTimeSlotPast = (date: Date, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const slotTime = setMinutes(setHours(date, hours), minutes);
    return isBefore(slotTime, new Date());
  };

  // Self-healing retry logic for calendar booking
  const retryWithFix = async (fn: () => Promise<any>, maxRetries = 3): Promise<any> => {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        console.log(`Calendar booking attempt ${i + 1} failed:`, error.message);
        
        // Self-healing: check if it's an auth issue
        if (error.message?.includes('row-level security') || error.message?.includes('not authenticated')) {
          console.log('Detected auth/RLS issue, refreshing session...');
          await supabase.auth.refreshSession();
          await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay
          continue;
        }
        
        // For other errors, wait a bit before retry
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }
    throw lastError;
  };

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !selectedTime) throw new Error("Select date and time");

      const [hours, minutes] = selectedTime.split(":").map(Number);
      const scheduledAt = setMinutes(setHours(selectedDate, hours), minutes);

      const { data: user } = await supabase.auth.getUser();
      
      if (!user.user) {
        throw new Error("Please log in to schedule a call");
      }

      // Use self-healing retry for the main booking
      await retryWithFix(async () => {
        const { error } = await supabase.from("discovery_calls").insert({
          lead_id: leadId,
          scheduled_by: user.user?.id,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: 15,
          meeting_notes: notes || null,
        });

        if (error) throw error;
      });

      // Timeline entry is non-critical - don't fail the booking if this fails
      try {
        await supabase.from("lead_timeline").insert({
          lead_id: leadId,
          action: "discovery_call_scheduled",
          metadata: {
            scheduled_at: scheduledAt.toISOString(),
            duration: 15,
          },
        });
      } catch (timelineError) {
        console.warn("Timeline entry failed but booking succeeded:", timelineError);
      }

      return scheduledAt;
    },
    onSuccess: (scheduledAt) => {
      toast.success(`Discovery call scheduled for ${format(scheduledAt, "MMM d 'at' h:mm a")}`);
      queryClient.invalidateQueries({ queryKey: ["discovery-calls"] });
      queryClient.invalidateQueries({ queryKey: ["lead-timeline"] });
      onScheduled?.();
      onOpenChange(false);
      setSelectedDate(undefined);
      setSelectedTime(null);
      setNotes("");
    },
    onError: (error: any) => {
      console.error("Calendar booking final error:", error);
      toast.error(`Failed to book: ${error.message}`);
    },
  });

  const availableTimeSlots = selectedDate
    ? TIME_SLOTS.filter(
        (time) =>
          !isTimeSlotBooked(selectedDate, time) &&
          !isTimeSlotPast(selectedDate, time)
      )
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Discovery Call
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Lead info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="p-2 rounded-full bg-primary/10">
              <Phone className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium">{leadName}</p>
              {leadPhone && (
                <p className="text-sm text-muted-foreground">{leadPhone}</p>
              )}
            </div>
            <Badge className="ml-auto">15 min</Badge>
          </div>

          {/* Calendar */}
          <div className="flex justify-center">
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => isBefore(date, addDays(new Date(), -1)) || date.getDay() === 0 || date.getDay() === 6}
              className="rounded-md border"
            />
          </div>

          {/* Time slots */}
          {selectedDate && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Available Times for {format(selectedDate, "MMM d, yyyy")}
              </label>
              {availableTimeSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No available slots for this date
                </p>
              ) : (
                <ScrollArea className="h-32">
                  <div className="grid grid-cols-4 gap-2">
                    {availableTimeSlots.map((time) => (
                      <Button
                        key={time}
                        variant={selectedTime === time ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedTime(time)}
                        className="text-xs"
                      >
                        {format(
                          setMinutes(setHours(new Date(), parseInt(time.split(":")[0])), parseInt(time.split(":")[1])),
                          "h:mm a"
                        )}
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {/* Notes */}
          {selectedTime && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (optional)</label>
              <Textarea
                placeholder="Add any notes about this call..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => scheduleMutation.mutate()}
              disabled={!selectedDate || !selectedTime || scheduleMutation.isPending}
            >
              <Check className="h-4 w-4 mr-2" />
              {scheduleMutation.isPending ? "Scheduling..." : "Schedule Call"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
