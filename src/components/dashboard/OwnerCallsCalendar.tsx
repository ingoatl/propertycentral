import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Calendar,
  Phone,
  Video,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  MessageSquare,
  Trash2,
  Copy,
  ExternalLink,
  Building2,
  Check,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  isToday,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { formatInEST, formatInESTWithLabel } from "@/lib/timezone-utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SendEmailDialog } from "@/components/communications/SendEmailDialog";

interface OwnerCall {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  topic: string | null;
  topic_details: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  google_meet_link: string | null;
  google_calendar_event_id: string | null;
  meeting_type: string | null;
  meeting_notes: string | null;
  owner_id: string | null;
  property_owners?: {
    name: string;
    email: string;
  } | null;
}

const TOPIC_LABELS: Record<string, string> = {
  monthly_statement: "Monthly Statement",
  maintenance: "Maintenance",
  guest_concerns: "Guest Concerns",
  pricing: "Pricing",
  general_checkin: "Check-in",
  property_update: "Property Update",
  other: "Other",
};

function getTopicColor(topic: string | null): string {
  const colors: Record<string, string> = {
    monthly_statement: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    maintenance: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
    guest_concerns: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
    pricing: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
    general_checkin: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200",
    property_update: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200",
  };
  return colors[topic || ""] || "bg-muted text-muted-foreground";
}

export function OwnerCallsCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedCall, setSelectedCall] = useState<OwnerCall | null>(null);
  const [deletingCallId, setDeletingCallId] = useState<string | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ["owner-calls-calendar", format(currentMonth, "yyyy-MM")],
    queryFn: async () => {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      const { data, error } = await supabase
        .from("owner_calls")
        .select(`
          id,
          scheduled_at,
          duration_minutes,
          status,
          topic,
          topic_details,
          contact_name,
          contact_email,
          contact_phone,
          google_meet_link,
          google_calendar_event_id,
          meeting_type,
          meeting_notes,
          owner_id,
          property_owners (name, email)
        `)
        .gte("scheduled_at", monthStart.toISOString())
        .lte("scheduled_at", monthEnd.toISOString())
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      return data as OwnerCall[];
    },
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getCallsForDay = (date: Date) => {
    return calls.filter((call) => isSameDay(new Date(call.scheduled_at), date));
  };

  const upcomingCalls = calls
    .filter((call) => new Date(call.scheduled_at) >= new Date() && call.status === "scheduled")
    .slice(0, 5);

  const handleDeleteCall = async () => {
    if (!deletingCallId) return;
    
    try {
      const { error } = await supabase
        .from("owner_calls")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("id", deletingCallId);

      if (error) throw error;
      
      toast.success("Call cancelled successfully");
      queryClient.invalidateQueries({ queryKey: ["owner-calls-calendar"] });
      setSelectedCall(null);
    } catch (error: any) {
      toast.error(`Failed to cancel: ${error.message}`);
    } finally {
      setDeletingCallId(null);
    }
  };

  const handleCopyMeetLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Meet link copied!");
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-purple-600" />
            Owner Calls
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Badge variant="outline" className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">
              <User className="h-3 w-3 mr-1" />
              Owner
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs font-medium"
              onClick={() => setCurrentMonth(new Date())}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium min-w-[120px] sm:min-w-[140px] text-center text-sm sm:text-base">
              {format(currentMonth, "MMM yyyy")}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {/* Upcoming Calls */}
        <div className="mb-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            Upcoming Owner Calls ({upcomingCalls.length})
          </h3>
          {upcomingCalls.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No upcoming owner calls</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-3 px-3 snap-x snap-mandatory">
              {upcomingCalls.map((call) => (
                <button
                  key={call.id}
                  onClick={() => setSelectedCall(call)}
                  className="flex-shrink-0 w-[280px] snap-start text-left p-3 rounded-lg border border-purple-200 dark:border-purple-800 hover:border-primary transition-colors bg-purple-50/50 dark:bg-purple-900/10"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm truncate max-w-[180px]">
                      {call.contact_name}
                    </span>
                    <Badge variant="outline" className={cn("text-xs", getTopicColor(call.topic))}>
                      {TOPIC_LABELS[call.topic || ""] || "Call"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatInESTWithLabel(new Date(call.scheduled_at), "MMM d, h:mm a")}
                    </div>
                    <div className="flex items-center gap-1">
                      {call.meeting_type === 'phone' ? (
                        <Phone className="h-3 w-3 text-amber-600" />
                      ) : (
                        <Video className="h-3 w-3 text-purple-600" />
                      )}
                      {call.meeting_type === 'phone' ? 'Phone Call' : 'Video Call'}
                      {call.google_calendar_event_id && (
                        <span className="ml-1 text-green-600">✓</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="bg-background p-2 text-center text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
          {days.map((day) => {
            const dayCalls = getCallsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "bg-background min-h-[80px] p-1 relative",
                  !isCurrentMonth && "opacity-40"
                )}
              >
                <span className={cn(
                  "text-xs font-medium",
                  isToday(day) && "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center"
                )}>
                  {format(day, "d")}
                </span>
                <div className="mt-1 space-y-1">
                  {dayCalls.slice(0, 3).map((call) => (
                    <button
                      key={call.id}
                      onClick={() => setSelectedCall(call)}
                      className={cn(
                        "w-full text-left text-[10px] px-1 py-0.5 rounded truncate",
                        call.status === "cancelled" ? "line-through opacity-50" : "",
                        "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200 hover:bg-purple-200"
                      )}
                    >
                      {formatInEST(new Date(call.scheduled_at), "h:mm")} {call.contact_name.split(" ")[0]}
                    </button>
                  ))}
                  {dayCalls.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">+{dayCalls.length - 3} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* Call Detail Dialog */}
      <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-purple-600" />
              Owner Call Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedCall && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">{selectedCall.contact_name}</h3>
                <Badge className={getTopicColor(selectedCall.topic)}>
                  {TOPIC_LABELS[selectedCall.topic || ""] || "Call"}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {formatInESTWithLabel(new Date(selectedCall.scheduled_at), "EEEE, MMMM d, yyyy 'at' h:mm a")}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {selectedCall.duration_minutes} minutes
                </div>
                <div className="flex items-center gap-2">
                  {selectedCall.meeting_type === 'phone' ? (
                    <Phone className="h-4 w-4 text-amber-600" />
                  ) : (
                    <Video className="h-4 w-4 text-purple-600" />
                  )}
                  <span>{selectedCall.meeting_type === 'phone' ? 'Phone Call' : 'Video Call'}</span>
                  {selectedCall.google_calendar_event_id && (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      <Check className="h-3 w-3 mr-1" />
                      In Calendar
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {selectedCall.contact_email}
                </div>
                {selectedCall.contact_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {selectedCall.contact_phone}
                  </div>
                )}
              </div>

              {selectedCall.topic_details && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Details:</p>
                  <p className="text-sm">{selectedCall.topic_details}</p>
                </div>
              )}

              {selectedCall.google_meet_link && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleCopyMeetLink(selectedCall.google_meet_link!)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                    onClick={() => window.open(selectedCall.google_meet_link!, "_blank")}
                  >
                    <Video className="h-4 w-4 mr-2" />
                    Join Call
                  </Button>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEmailDialogOpen(true)}
                  className="flex-1"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeletingCallId(selectedCall.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingCallId} onOpenChange={() => setDeletingCallId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this call?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the call as cancelled. The owner will need to reschedule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Call</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCall} className="bg-destructive text-destructive-foreground">
              Cancel Call
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email Dialog */}
      {selectedCall && (
        <SendEmailDialog
          open={emailDialogOpen}
          onOpenChange={setEmailDialogOpen}
          contactName={selectedCall.contact_name}
          contactEmail={selectedCall.contact_email}
          contactType="owner"
          contactId={selectedCall.owner_id || ""}
        />
      )}
    </Card>
  );
}
