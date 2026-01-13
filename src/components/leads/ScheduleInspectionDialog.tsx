import { useState } from "react";
import { Calendar, Clock, Phone, Video, Home, Wrench, Shield, Lock } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addDays, setHours, setMinutes, isBefore, addMinutes } from "date-fns";

interface ScheduleInspectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  leadEmail?: string;
  propertyAddress?: string;
  propertyImage?: string;
  onScheduled?: () => void;
}

const INSPECTION_DURATION = 60; // 60 minute inspections

// Generate time slots from 11 AM to 3 PM
const generateTimeSlots = () => {
  const slots: string[] = [];
  for (let hour = 11; hour < 15; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
      slots.push(time);
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

const INSPECTION_TYPES = [
  { value: "in_person", label: "In-Person Walkthrough", description: "We'll meet at the property", icon: Home },
  { value: "virtual", label: "Virtual Inspection", description: "Video call walkthrough", icon: Video },
];

export function ScheduleInspectionDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  leadEmail,
  propertyAddress,
  propertyImage,
  onScheduled,
}: ScheduleInspectionDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [inspectionType, setInspectionType] = useState<"in_person" | "virtual">("in_person");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  // Fetch existing scheduled inspections to block those times
  const { data: existingInspections = [] } = useQuery({
    queryKey: ["inspections-scheduled"],
    queryFn: async () => {
      const { data } = await supabase
        .from("discovery_calls")
        .select("scheduled_at, duration_minutes")
        .eq("status", "scheduled")
        .eq("meeting_type", "inspection")
        .gte("scheduled_at", new Date().toISOString());
      return data || [];
    },
    enabled: open,
  });

  // Check if a time slot is already booked
  const isTimeSlotBooked = (date: Date, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const slotStart = setMinutes(setHours(date, hours), minutes);
    const slotEnd = addMinutes(slotStart, 30);

    return existingInspections.some((inspection) => {
      const inspStart = new Date(inspection.scheduled_at);
      const inspEnd = addMinutes(inspStart, inspection.duration_minutes || 60);
      return (
        (slotStart >= inspStart && slotStart < inspEnd) ||
        (slotEnd > inspStart && slotEnd <= inspEnd)
      );
    });
  };

  // Check if time slot is in the past
  const isTimeSlotPast = (date: Date, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const slotTime = setMinutes(setHours(date, hours), minutes);
    return isBefore(slotTime, new Date());
  };

  // Only allow Tuesdays (2) and Thursdays (4)
  const isAllowedDay = (date: Date) => {
    const day = date.getDay();
    return day === 2 || day === 4;
  };

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !selectedTime) throw new Error("Select date and time");

      const [hours, minutes] = selectedTime.split(":").map(Number);
      const scheduledAt = setMinutes(setHours(selectedDate, hours), minutes);

      const { data: user } = await supabase.auth.getUser();
      
      if (!user.user) {
        throw new Error("Please log in to schedule an inspection");
      }

      // Insert inspection as a discovery_call with meeting_type = 'inspection'
      const { data: newInspection, error } = await supabase.from("discovery_calls").insert({
        lead_id: leadId,
        scheduled_by: user.user?.id,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: INSPECTION_DURATION,
        meeting_notes: notes || null,
        meeting_type: inspectionType === "virtual" ? "virtual_inspection" : "inspection",
        google_meet_link: inspectionType === "virtual" ? "https://meet.google.com/jww-deey-iaa" : null,
        service_interest: "onboarding_inspection",
      }).select().single();

      if (error) throw error;

      // Update lead's inspection date
      await supabase.from("leads").update({
        inspection_date: scheduledAt.toISOString(),
      }).eq("id", leadId);

      // Timeline entry
      try {
        await supabase.from("lead_timeline").insert({
          lead_id: leadId,
          action: "inspection_scheduled",
          metadata: {
            scheduled_at: scheduledAt.toISOString(),
            duration: INSPECTION_DURATION,
            inspection_type: inspectionType,
            property_address: propertyAddress,
          },
        });
      } catch (timelineError) {
        console.warn("Timeline entry failed but booking succeeded:", timelineError);
      }

      // Send confirmation email and admin notification
      try {
        await supabase.functions.invoke("inspection-notifications", {
          body: { 
            inspectionId: newInspection.id, 
            leadId,
            notificationType: "confirmation",
            inspectionType,
            scheduledAt: scheduledAt.toISOString(),
          },
        });
      } catch (notifError) {
        console.warn("Notification sending failed:", notifError);
      }

      return { scheduledAt, inspectionType };
    },
    onSuccess: ({ scheduledAt, inspectionType }) => {
      const typeLabel = inspectionType === "virtual" ? "Virtual Inspection" : "In-Person Inspection";
      toast.success(`${typeLabel} scheduled for ${format(scheduledAt, "EEEE, MMM d 'at' h:mm a")}`);
      queryClient.invalidateQueries({ queryKey: ["inspections-scheduled"] });
      queryClient.invalidateQueries({ queryKey: ["lead-timeline"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      onScheduled?.();
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      console.error("Inspection booking error:", error);
      toast.error(`Failed to book: ${error.message}`);
    },
  });

  const resetForm = () => {
    setSelectedDate(undefined);
    setSelectedTime(null);
    setInspectionType("in_person");
    setNotes("");
  };

  const availableTimeSlots = selectedDate
    ? TIME_SLOTS.filter(
        (time) =>
          !isTimeSlotBooked(selectedDate, time) &&
          !isTimeSlotPast(selectedDate, time)
      )
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Schedule Onboarding Inspection
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Lead & Property info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            {propertyImage ? (
              <img 
                src={propertyImage} 
                alt={propertyAddress || "Property"} 
                className="h-16 w-20 rounded-lg object-cover"
              />
            ) : (
              <div className="p-2 rounded-full bg-primary/10">
                <Home className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className="flex-1">
              <p className="font-medium">{leadName}</p>
              {propertyAddress && (
                <p className="text-sm text-muted-foreground">{propertyAddress}</p>
              )}
            </div>
            <Badge>60 min</Badge>
          </div>

          {/* What happens during inspection */}
          <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-600" />
              What We'll Cover During the Inspection
            </h4>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li className="flex items-start gap-2">
                <Wrench className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <span><strong>Safety & Onboarding Check</strong> - Record all appliance serial numbers, verify safety equipment (fire extinguishers, smoke detectors)</span>
              </li>
              <li className="flex items-start gap-2">
                <Home className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <span><strong>Property Readiness</strong> - Ensure all essentials are in place and property is guest-ready</span>
              </li>
              <li className="flex items-start gap-2">
                <Lock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <span><strong>Smart Lock Setup</strong> - Verify smart lock is connected and working properly</span>
              </li>
            </ul>
            <div className="mt-3 p-2 bg-white/50 dark:bg-black/20 rounded text-xs">
              <strong>Need a smart lock?</strong> We recommend the{" "}
              <a 
                href="https://www.amazon.com/Yale-Security-Connected-Back-Up-YRD410-WF1-BSP/dp/B0B9HWYMV5" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Yale Security Smart Lock
              </a>
              . We can install it at no extra charge!
            </div>
          </div>

          {/* Inspection Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Inspection Type</Label>
            <RadioGroup
              value={inspectionType}
              onValueChange={(value) => setInspectionType(value as "in_person" | "virtual")}
              className="grid grid-cols-2 gap-3"
            >
              {INSPECTION_TYPES.map((type) => (
                <Label
                  key={type.value}
                  htmlFor={`type-${type.value}`}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    inspectionType === type.value
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-muted-foreground/30"
                  }`}
                >
                  <RadioGroupItem value={type.value} id={`type-${type.value}`} />
                  <type.icon className="h-5 w-5" />
                  <div>
                    <p className="font-medium text-sm">{type.label}</p>
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </div>

          {/* Calendar - only Tuesdays & Thursdays */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Select a Date <span className="text-xs text-muted-foreground">(Tue & Thu only)</span>
            </Label>
            <div className="flex justify-center">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => 
                  isBefore(date, addDays(new Date(), -1)) || 
                  !isAllowedDay(date)
                }
                className="rounded-md border"
              />
            </div>
          </div>

          {/* Time slots */}
          {selectedDate && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Available Times for {format(selectedDate, "EEEE, MMM d, yyyy")}
              </Label>
              <p className="text-xs text-muted-foreground">Inspections available 11 AM - 3 PM EST</p>
              {availableTimeSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No available slots for this date
                </p>
              ) : (
                <ScrollArea className="h-24">
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
          <div className="space-y-2">
            <Label className="text-sm font-medium">Additional Notes (optional)</Label>
            <Textarea
              placeholder="Any special access instructions, parking details, or specific concerns..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => scheduleMutation.mutate()}
              disabled={!selectedDate || !selectedTime || scheduleMutation.isPending}
            >
              {scheduleMutation.isPending ? "Scheduling..." : "Schedule Inspection"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ScheduleInspectionDialog;
