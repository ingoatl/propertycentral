import { useState, useEffect } from "react";
import { format, parseISO, addDays, isSameDay, setHours, setMinutes } from "date-fns";
import { Calendar as CalendarIcon, Clock, Loader2, AlertCircle, CheckCircle, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AdminRescheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  appointmentType: "discovery_call" | "inspection" | "visit";
  currentScheduledAt: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  onRescheduleComplete?: () => void;
}

// Generate time slots from 8am to 8pm
const TIME_SLOTS = Array.from({ length: 25 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const minute = (i % 2) * 30;
  const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  const displayTime = new Date(2024, 0, 1, hour, minute).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return { value: time, label: displayTime };
});

const RESCHEDULE_REASONS = [
  { value: "client_request", label: "Client requested change" },
  { value: "conflict", label: "Schedule conflict" },
  { value: "emergency", label: "Emergency/urgent matter" },
  { value: "availability", label: "Staff availability" },
  { value: "weather", label: "Weather conditions" },
  { value: "other", label: "Other reason" },
];

export function AdminRescheduleDialog({
  open,
  onOpenChange,
  appointmentId,
  appointmentType,
  currentScheduledAt,
  contactName,
  contactEmail,
  contactPhone,
  onRescheduleComplete,
}: AdminRescheduleDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [sendNotification, setSendNotification] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);

  const currentDate = parseISO(currentScheduledAt);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedDate(currentDate);
      setSelectedTime(format(currentDate, "HH:mm"));
      setReason("");
      setNotes("");
      setSendNotification(true);
      setConflicts([]);
    }
  }, [open, currentScheduledAt]);

  // Check for conflicts when date/time changes
  useEffect(() => {
    if (selectedDate && selectedTime) {
      checkForConflicts();
    }
  }, [selectedDate, selectedTime]);

  const checkForConflicts = async () => {
    if (!selectedDate || !selectedTime) return;

    setCheckingConflicts(true);
    try {
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const newDateTime = setMinutes(setHours(selectedDate, hours), minutes);
      
      // Check discovery calls for conflicts
      const { data: callConflicts } = await supabase
        .from("discovery_calls")
        .select("id, leads(name)")
        .neq("id", appointmentId)
        .in("status", ["scheduled", "confirmed"])
        .gte("scheduled_at", new Date(newDateTime.getTime() - 30 * 60 * 1000).toISOString())
        .lte("scheduled_at", new Date(newDateTime.getTime() + 30 * 60 * 1000).toISOString());

      if (callConflicts && callConflicts.length > 0) {
        setConflicts(callConflicts.map((c: any) => c.leads?.name || "Unknown").filter(Boolean));
      } else {
        setConflicts([]);
      }
    } catch (error) {
      console.error("Error checking conflicts:", error);
    } finally {
      setCheckingConflicts(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) {
      toast.error("Please select a date and time");
      return;
    }

    if (!reason) {
      toast.error("Please select a reason for rescheduling");
      return;
    }

    setIsSubmitting(true);

    try {
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const newScheduledAt = setMinutes(setHours(selectedDate, hours), minutes);

      // Call the edge function to handle the reschedule
      const { data, error } = await supabase.functions.invoke("admin-reschedule-appointment", {
        body: {
          appointmentId,
          appointmentType,
          newScheduledAt: newScheduledAt.toISOString(),
          reason,
          notes,
          sendNotification,
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success("Appointment rescheduled successfully", {
        description: sendNotification 
          ? `${contactName} will be notified of the change.`
          : "No notification was sent.",
      });

      onOpenChange(false);
      onRescheduleComplete?.();
    } catch (error: any) {
      console.error("Error rescheduling:", error);
      toast.error("Failed to reschedule appointment", {
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasChanges = () => {
    if (!selectedDate || !selectedTime) return false;
    const [hours, minutes] = selectedTime.split(":").map(Number);
    const newDateTime = setMinutes(setHours(selectedDate, hours), minutes);
    return newDateTime.getTime() !== currentDate.getTime();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Reschedule Appointment
          </DialogTitle>
          <DialogDescription>
            Reschedule the appointment with <strong>{contactName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Appointment Info */}
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs font-medium text-muted-foreground mb-1">Current Schedule</p>
            <p className="font-medium">{format(currentDate, "EEEE, MMMM d, yyyy 'at' h:mm a")}</p>
          </div>

          {/* New Date Selection */}
          <div className="space-y-2">
            <Label>New Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* New Time Selection */}
          <div className="space-y-2">
            <Label>New Time</Label>
            <Select value={selectedTime} onValueChange={setSelectedTime}>
              <SelectTrigger>
                <SelectValue placeholder="Select time">
                  {selectedTime && (
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {TIME_SLOTS.find(t => t.value === selectedTime)?.label || selectedTime}
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((slot) => (
                  <SelectItem key={slot.value} value={slot.value}>
                    {slot.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Conflict Warning */}
          {checkingConflicts && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Checking for conflicts...
            </div>
          )}
          
          {conflicts.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Potential conflict detected
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Existing appointment(s): {conflicts.join(", ")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reason Selection */}
          <div className="space-y-2">
            <Label>Reason for Rescheduling <span className="text-destructive">*</span></Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {RESCHEDULE_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Additional Notes (optional)</Label>
            <Textarea
              placeholder="Add any additional details about this reschedule..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Notification Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
            <div>
              <p className="font-medium text-sm">Send notification</p>
              <p className="text-xs text-muted-foreground">
                {contactEmail ? `Email to ${contactEmail}` : ""}
                {contactEmail && contactPhone ? " & " : ""}
                {contactPhone ? `SMS to ${contactPhone}` : ""}
              </p>
            </div>
            <Switch
              checked={sendNotification}
              onCheckedChange={setSendNotification}
            />
          </div>

          {/* Change Summary */}
          {hasChanges() && selectedDate && selectedTime && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    New Schedule
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-300">
                    {format(
                      setMinutes(setHours(selectedDate, parseInt(selectedTime.split(":")[0])), parseInt(selectedTime.split(":")[1])),
                      "EEEE, MMMM d, yyyy 'at' h:mm a"
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !hasChanges() || !reason}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Rescheduling...
              </>
            ) : (
              "Confirm Reschedule"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
