import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  MapPin,
  Clock,
  User,
  Home,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Star,
  FileText,
  Loader2,
  Mail,
  CalendarCheck,
  Tag,
  Trash2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
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
import { cn } from "@/lib/utils";
import { PropertyPhotos } from "@/components/ui/property-photos";
import { toast } from "sonner";
import { SendEmailDialog } from "@/components/communications/SendEmailDialog";
import { useGhlCalendarSync, GhlAppointment } from "@/hooks/useGhlCalendarSync";

interface DiscoveryCall {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  meeting_type: string;
  service_interest: string | null;
  start_timeline: string | null;
  meeting_notes: string | null;
  google_meet_link: string | null;
  google_calendar_event_id: string | null;
  leads: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    property_address: string | null;
    property_type: string | null;
    opportunity_value: number | null;
    notes: string | null;
  } | null;
}

// Unified calendar event type
interface CalendarEvent {
  id: string;
  type: "discovery" | "ghl" | "inspection";
  scheduled_at: string;
  end_time?: string;
  title: string;
  status: string;
  meeting_type?: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  property_address: string | null;
  property_image?: string | null;
  notes: string | null;
  // Discovery-specific
  discoveryCall?: DiscoveryCall;
  // GHL-specific
  ghlAppointment?: GhlAppointment;
}

// Calculate revenue potential score
function calculateRevenueScore(propertyAddress: string, propertyType: string | null): number {
  let score = 50;
  const address = propertyAddress?.toLowerCase() || "";

  if (address.includes("atlanta") || address.includes("buckhead") || address.includes("midtown")) {
    score += 20;
  } else if (address.includes("marietta") || address.includes("decatur") || address.includes("sandy springs")) {
    score += 15;
  } else if (address.includes("alpharetta") || address.includes("roswell") || address.includes("dunwoody")) {
    score += 12;
  }

  if (propertyType === "single_family") {
    score += 15;
  } else if (propertyType === "condo") {
    score += 10;
  } else if (propertyType === "townhouse") {
    score += 12;
  }

  return Math.min(score, 100);
}

function getScoreColor(score: number): string {
  if (score >= 75) return "text-green-600 bg-green-100 dark:bg-green-900/30";
  if (score >= 50) return "text-amber-600 bg-amber-100 dark:bg-amber-900/30";
  return "text-red-600 bg-red-100 dark:bg-red-900/30";
}

function getTimelineLabel(timeline: string | null): string {
  const labels: Record<string, string> = {
    immediately: "Ready Now",
    "1_2_weeks": "1-2 Weeks",
    "1_month": "Within a Month",
    "2_3_months": "2-3 Months",
    just_exploring: "Exploring",
  };
  return timeline ? labels[timeline] || timeline : "Not specified";
}

function getServiceLabel(service: string | null): string {
  const labels: Record<string, string> = {
    property_management: "Full Management",
    cohosting: "Co-hosting",
    undecided: "Undecided",
  };
  return service ? labels[service] || service : "Not specified";
}

export function DiscoveryCallCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedCall, setSelectedCall] = useState<DiscoveryCall | null>(null);
  const [selectedGhlEvent, setSelectedGhlEvent] = useState<GhlAppointment | null>(null);
  // Local state for optimistic deletion
  const [deletedCallIds, setDeletedCallIds] = useState<Set<string>>(new Set());

  // Fetch discovery calls
  const { data: calls = [], isLoading: isLoadingCalls } = useQuery({
    queryKey: ["discovery-calls-calendar", format(currentMonth, "yyyy-MM")],
    queryFn: async () => {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      const { data, error } = await supabase
        .from("discovery_calls")
        .select(`
          *,
          leads (
            id, name, email, phone, property_address, property_type, opportunity_value, notes
          )
        `)
        .gte("scheduled_at", monthStart.toISOString())
        .lte("scheduled_at", monthEnd.toISOString())
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      return data as DiscoveryCall[];
    },
  });

  // Fetch GHL calendar appointments (auto-synced)
  const { appointments: ghlAppointments, isLoading: isLoadingGhl } = useGhlCalendarSync(currentMonth);

  // Filter GHL appointments to current month and exclude duplicates
  const filteredGhlAppointments = ghlAppointments.filter((apt) => {
    const aptDate = new Date(apt.scheduled_at);
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    if (aptDate < monthStart || aptDate > monthEnd) return false;
    
    // Check if already in discovery_calls
    const aptTime = aptDate.getTime();
    return !calls.some((call) => {
      const callTime = new Date(call.scheduled_at).getTime();
      return Math.abs(aptTime - callTime) < 5 * 60 * 1000 && 
             call.leads?.name?.toLowerCase() === apt.contact_name?.toLowerCase();
    });
  });

  const isLoading = isLoadingCalls || isLoadingGhl;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Filter out optimistically deleted calls
  const filteredCalls = calls.filter(call => !deletedCallIds.has(call.id));

  // Separate inspections from regular discovery calls
  const inspections = filteredCalls.filter(call => 
    call.meeting_type === 'inspection' || 
    call.meeting_type === 'virtual_inspection' ||
    call.service_interest === 'onboarding_inspection'
  );
  
  const regularCalls = filteredCalls.filter(call => 
    call.meeting_type !== 'inspection' && 
    call.meeting_type !== 'virtual_inspection' &&
    call.service_interest !== 'onboarding_inspection'
  );

  const getCallsForDay = (date: Date) => {
    return regularCalls.filter((call) => isSameDay(new Date(call.scheduled_at), date));
  };

  const getInspectionsForDay = (date: Date) => {
    return inspections.filter((call) => isSameDay(new Date(call.scheduled_at), date));
  };

  const getGhlEventsForDay = (date: Date) => {
    return filteredGhlAppointments.filter((apt) => isSameDay(new Date(apt.scheduled_at), date));
  };

  const getAllEventsForDay = (date: Date) => {
    const dayCalls = getCallsForDay(date).map(call => ({ type: 'discovery' as const, data: call, time: new Date(call.scheduled_at) }));
    const dayInspections = getInspectionsForDay(date).map(call => ({ type: 'inspection' as const, data: call, time: new Date(call.scheduled_at) }));
    const dayGhl = getGhlEventsForDay(date).map(apt => ({ type: 'ghl' as const, data: apt, time: new Date(apt.scheduled_at) }));
    return [...dayCalls, ...dayInspections, ...dayGhl].sort((a, b) => a.time.getTime() - b.time.getTime());
  };

  const upcomingCalls = regularCalls
    .filter((call) => new Date(call.scheduled_at) >= new Date() && call.status === "scheduled")
    .slice(0, 5);

  const upcomingInspections = inspections
    .filter((call) => new Date(call.scheduled_at) >= new Date() && call.status === "scheduled")
    .slice(0, 5);

  const upcomingGhlEvents = filteredGhlAppointments
    .filter((apt) => new Date(apt.scheduled_at) >= new Date() && apt.status !== "cancelled")
    .slice(0, 5);

  // Combined upcoming events
  const allUpcomingEvents = [
    ...upcomingCalls.map(call => ({ type: 'discovery' as const, data: call, time: new Date(call.scheduled_at) })),
    ...upcomingInspections.map(call => ({ type: 'inspection' as const, data: call, time: new Date(call.scheduled_at) })),
    ...upcomingGhlEvents.map(apt => ({ type: 'ghl' as const, data: apt, time: new Date(apt.scheduled_at) })),
  ].sort((a, b) => a.time.getTime() - b.time.getTime()).slice(0, 8);

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Calendar
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <div className="flex gap-1 ml-2 flex-wrap">
              <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                <Video className="h-3 w-3 mr-1" />
                Discovery
              </Badge>
              <Badge variant="outline" className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                <Home className="h-3 w-3 mr-1" />
                Inspection
              </Badge>
              <Badge variant="outline" className="text-xs bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200">
                <CalendarCheck className="h-3 w-3 mr-1" />
                GHL
              </Badge>
            </div>
          </CardTitle>
          <div className="flex items-center gap-2">
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
        {/* Upcoming Events - Horizontal scroll on all screens */}
        <div className="mb-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            Upcoming Events ({allUpcomingEvents.length})
          </h3>
          {allUpcomingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No upcoming events</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-3 px-3 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
              {allUpcomingEvents.map((event) => {
                if (event.type === 'discovery') {
                  const call = event.data as DiscoveryCall;
                  const score = calculateRevenueScore(
                    call.leads?.property_address || "",
                    call.leads?.property_type || null
                  );
                  return (
                    <button
                      key={call.id}
                      onClick={() => setSelectedCall(call)}
                      className="flex-shrink-0 w-[280px] snap-start text-left p-3 rounded-lg border border-green-200 dark:border-green-800 hover:border-primary active:bg-muted/50 transition-colors bg-green-50/50 dark:bg-green-900/10"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm truncate max-w-[180px]">
                          {call.leads?.name || "Unknown"}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn("text-xs flex-shrink-0", getScoreColor(score))}
                        >
                          {score}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 flex-shrink-0" />
                          {format(event.time, "MMM d, h:mm a")}
                        </div>
                        <div className="flex items-center gap-1">
                          {call.meeting_type === "video" ? (
                            <Video className="h-3 w-3 text-green-600 flex-shrink-0" />
                          ) : (
                            <Phone className="h-3 w-3 text-blue-600 flex-shrink-0" />
                          )}
                          Discovery Call
                        </div>
                        {call.leads?.property_address && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{call.leads.property_address}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                } else if (event.type === 'inspection') {
                  const call = event.data as DiscoveryCall;
                  const isVirtual = call.meeting_type === 'virtual_inspection';
                  return (
                    <button
                      key={call.id}
                      onClick={() => setSelectedCall(call)}
                      className="flex-shrink-0 w-[280px] snap-start text-left p-3 rounded-lg border border-amber-200 dark:border-amber-800 hover:border-primary active:bg-muted/50 transition-colors bg-amber-50/50 dark:bg-amber-900/10"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm truncate max-w-[180px]">
                          {call.leads?.name || "Unknown"}
                        </span>
                        <Badge variant="outline" className="text-xs flex-shrink-0 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                          🏠 Inspection
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 flex-shrink-0" />
                          {format(event.time, "MMM d, h:mm a")}
                        </div>
                        <div className="flex items-center gap-1">
                          {isVirtual ? (
                            <Video className="h-3 w-3 text-amber-600 flex-shrink-0" />
                          ) : (
                            <Home className="h-3 w-3 text-amber-600 flex-shrink-0" />
                          )}
                          {isVirtual ? "Virtual Inspection" : "In-Person Inspection"}
                        </div>
                        {call.leads?.property_address && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{call.leads.property_address}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                } else {
                  const apt = event.data as GhlAppointment;
                  return (
                    <button
                      key={apt.ghl_event_id}
                      onClick={() => setSelectedGhlEvent(apt)}
                      className="flex-shrink-0 w-[280px] snap-start text-left p-3 rounded-lg border border-cyan-200 dark:border-cyan-800 hover:border-primary active:bg-muted/50 transition-colors bg-cyan-50/50 dark:bg-cyan-900/10"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm truncate max-w-[180px]">
                          {apt.contact_name || apt.lead_name || "Unknown"}
                        </span>
                        <Badge variant="outline" className="text-xs flex-shrink-0 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200">
                          GHL
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 flex-shrink-0" />
                          {format(event.time, "MMM d, h:mm a")}
                        </div>
                        <div className="flex items-center gap-1">
                          <CalendarCheck className="h-3 w-3 text-cyan-600 flex-shrink-0" />
                          <span className="truncate">{apt.title || "Appointment"}</span>
                        </div>
                        {(apt.lead_property_address || apt.contact_address) && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{apt.lead_property_address || apt.contact_address}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                }
              })}
            </div>
          )}
        </div>

        {/* Mobile: Compact calendar only */}
        <div className="lg:hidden space-y-4">

          {/* Compact mobile calendar */}
          <div className="border rounded-lg p-2">
            {/* Day headers - abbreviated */}
            <div className="grid grid-cols-7 mb-1">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                <div
                  key={i}
                  className="text-center text-xs font-medium text-muted-foreground py-1"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days - compact */}
            <div className="grid grid-cols-7 gap-0.5">
              {days.map((day) => {
                const dayEvents = getAllEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isCurrentDay = isToday(day);
                const hasEvent = dayEvents.length > 0;
                const hasDiscovery = dayEvents.some(e => e.type === 'discovery');
                const hasInspection = dayEvents.some(e => e.type === 'inspection');
                const hasGhl = dayEvents.some(e => e.type === 'ghl');

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => {
                      if (hasEvent) {
                        const first = dayEvents[0];
                        if (first.type === 'discovery' || first.type === 'inspection') {
                          setSelectedCall(first.data as DiscoveryCall);
                        } else {
                          setSelectedGhlEvent(first.data as GhlAppointment);
                        }
                      }
                    }}
                    disabled={!hasEvent}
                    className={cn(
                      "aspect-square p-0.5 text-xs rounded transition-colors relative",
                      !isCurrentMonth && "opacity-30",
                      isCurrentDay && "ring-1 ring-primary",
                      hasEvent && "cursor-pointer hover:bg-primary/10",
                      !hasEvent && "cursor-default"
                    )}
                  >
                    <span className={cn(
                      "flex items-center justify-center w-full h-full rounded-full text-xs",
                      isCurrentDay && "bg-primary text-primary-foreground font-bold",
                      hasInspection && !isCurrentDay && "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 font-medium",
                      hasDiscovery && !hasInspection && !isCurrentDay && "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 font-medium",
                      hasGhl && !hasDiscovery && !hasInspection && !isCurrentDay && "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200 font-medium"
                    )}>
                      {format(day, "d")}
                    </span>
                    {dayEvents.length > 1 && (
                      <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] text-muted-foreground">
                        +{dayEvents.length - 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Desktop: Full calendar (no sidebar since events are shown above) */}
        <div className="hidden lg:block">
          {/* Calendar Grid */}
          <div>
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-medium text-muted-foreground py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const dayEvents = getAllEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isCurrentDay = isToday(day);

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "min-h-[100px] p-1 border rounded-lg transition-colors",
                      !isCurrentMonth && "bg-muted/30 opacity-50",
                      isCurrentDay && "border-primary bg-primary/5"
                    )}
                  >
                    <div
                      className={cn(
                        "text-sm font-medium mb-1 px-1",
                        isCurrentDay && "text-primary"
                      )}
                    >
                      {format(day, "d")}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 4).map((event) => {
                        if (event.type === 'discovery') {
                          const call = event.data as DiscoveryCall;
                          const score = calculateRevenueScore(
                            call.leads?.property_address || "",
                            call.leads?.property_type || null
                          );
                          return (
                            <button
                              key={call.id}
                              onClick={() => setSelectedCall(call)}
                              className={cn(
                                "w-full text-left text-xs p-1.5 rounded transition-all hover:scale-[1.02]",
                                call.meeting_type === "video"
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                                  : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200"
                              )}
                            >
                              <div className="flex items-center gap-1">
                                {call.meeting_type === "video" ? (
                                  <Video className="h-3 w-3 shrink-0" />
                                ) : (
                                  <Phone className="h-3 w-3 shrink-0" />
                                )}
                                <span className="truncate font-medium">
                                  {format(new Date(call.scheduled_at), "h:mm a")}
                                </span>
                              </div>
                              <div className="truncate opacity-80">
                                {call.leads?.name || "Unknown"}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <Star className="h-2.5 w-2.5" />
                                <span className="text-[10px]">{score}</span>
                              </div>
                            </button>
                          );
                        } else if (event.type === 'inspection') {
                          const call = event.data as DiscoveryCall;
                          const isVirtual = call.meeting_type === 'virtual_inspection';
                          return (
                            <button
                              key={call.id}
                              onClick={() => setSelectedCall(call)}
                              className="w-full text-left text-xs p-1.5 rounded transition-all hover:scale-[1.02] bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200"
                            >
                              <div className="flex items-center gap-1">
                                {isVirtual ? (
                                  <Video className="h-3 w-3 shrink-0" />
                                ) : (
                                  <Home className="h-3 w-3 shrink-0" />
                                )}
                                <span className="truncate font-medium">
                                  {format(new Date(call.scheduled_at), "h:mm a")}
                                </span>
                              </div>
                              <div className="truncate opacity-80">
                                {call.leads?.name || "Unknown"}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <Home className="h-2.5 w-2.5" />
                                <span className="text-[10px]">Inspection</span>
                              </div>
                            </button>
                          );
                        } else {
                          const apt = event.data as GhlAppointment;
                          return (
                            <button
                              key={apt.ghl_event_id}
                              onClick={() => setSelectedGhlEvent(apt)}
                              className="w-full text-left text-xs p-1.5 rounded transition-all hover:scale-[1.02] bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200"
                            >
                              <div className="flex items-center gap-1">
                                <CalendarCheck className="h-3 w-3 shrink-0" />
                                <span className="truncate font-medium">
                                  {format(new Date(apt.scheduled_at), "h:mm a")}
                                </span>
                              </div>
                              <div className="truncate opacity-80">
                                {apt.contact_name || apt.lead_name || "Appointment"}
                              </div>
                              {apt.title && (
                                <div className="truncate text-[10px] opacity-70">
                                  {apt.title}
                                </div>
                              )}
                            </button>
                          );
                        }
                      })}
                      {dayEvents.length > 4 && (
                        <div className="text-xs text-muted-foreground text-center">
                          +{dayEvents.length - 4} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </CardContent>

      {/* Discovery Call Detail Modal */}
      <DiscoveryCallDetailModal
        call={selectedCall}
        onClose={() => setSelectedCall(null)}
        onOptimisticDelete={(callId) => setDeletedCallIds(prev => new Set(prev).add(callId))}
        onRevertDelete={(callId) => setDeletedCallIds(prev => {
          const updated = new Set(prev);
          updated.delete(callId);
          return updated;
        })}
      />

      {/* GHL Appointment Detail Modal */}
      <GhlAppointmentDetailModal
        appointment={selectedGhlEvent}
        onClose={() => setSelectedGhlEvent(null)}
      />
    </Card>
  );
}

// Helper to extract Google Meet link from various sources
function extractMeetLink(appointment: GhlAppointment): string | null {
  // First check the dedicated meeting_link field from the sync
  if (appointment.meeting_link) {
    return appointment.meeting_link;
  }
  
  // Fallback: search in other fields
  const sources = [
    appointment.location,
    appointment.notes,
    appointment.title,
    appointment.lead_notes,
  ];
  
  for (const source of sources) {
    if (source) {
      // Match Google Meet links
      const meetMatch = source.match(/https:\/\/meet\.google\.com\/[a-z0-9-]+/i);
      if (meetMatch) return meetMatch[0];
      
      // Match Zoom links
      const zoomMatch = source.match(/https:\/\/[\w.-]*zoom\.us\/[a-z0-9/?=&-]+/i);
      if (zoomMatch) return zoomMatch[0];
      
      // Match Teams links
      const teamsMatch = source.match(/https:\/\/teams\.microsoft\.com\/[a-z0-9/?=&-]+/i);
      if (teamsMatch) return teamsMatch[0];
    }
  }
  
  return null;
}

// GHL Appointment Detail Modal - Enhanced to match DiscoveryCallDetailModal
interface GhlAppointmentDetailModalProps {
  appointment: GhlAppointment | null;
  onClose: () => void;
}

function GhlAppointmentDetailModal({ appointment, onClose }: GhlAppointmentDetailModalProps) {
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showCallConfirm, setShowCallConfirm] = useState(false);
  const [isCallingLead, setIsCallingLead] = useState(false);

  if (!appointment) return null;

  const scheduledAt = new Date(appointment.scheduled_at);
  const endTime = appointment.end_time ? new Date(appointment.end_time) : null;
  const propertyAddress = appointment.lead_property_address || appointment.contact_address;
  const contactName = appointment.contact_name || appointment.lead_name || "Unknown Contact";
  const contactEmail = appointment.contact_email || appointment.lead_email;
  const contactPhone = appointment.contact_phone || appointment.lead_phone;
  
  // Calculate revenue score if property address is available
  const score = propertyAddress ? calculateRevenueScore(propertyAddress, appointment.lead_property_type || null) : null;
  
  // Extract meeting link
  const meetLink = extractMeetLink(appointment);
  
  // Google Maps embed URL
  const googleMapsEmbedUrl = propertyAddress
    ? `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(propertyAddress)}&zoom=12&maptype=roadmap`
    : null;
    
  const googleMapsLink = propertyAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(propertyAddress)}`
    : null;

  const handleCallContact = async () => {
    if (!contactPhone || !appointment.lead_id) return;
    
    setIsCallingLead(true);
    try {
      const { error } = await supabase.functions.invoke("elevenlabs-voice-call", {
        body: {
          leadId: appointment.lead_id,
          message: `Hello ${contactName}, this is PeachHaus calling about your upcoming appointment. We're looking forward to speaking with you!`,
        },
      });

      if (error) throw error;
      toast.success(`Call initiated to ${contactName}`, {
        description: `Calling ${contactPhone}`,
      });
    } catch (error: any) {
      console.error("Error initiating call:", error);
      toast.error("Failed to initiate call", { description: error.message });
    } finally {
      setIsCallingLead(false);
      setShowCallConfirm(false);
    }
  };

  return (
    <>
      <Dialog open={!!appointment} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <img 
                src="/images/peachhaus-logo.png" 
                alt="PeachHaus" 
                className="h-10 w-auto"
              />
              <div>
                <span className="flex items-center gap-2">
                  <CalendarCheck className="h-5 w-5 text-cyan-600" />
                  {appointment.title || "GHL Appointment"}
                </span>
                <p className="text-sm font-normal text-muted-foreground">
                  {format(scheduledAt, "EEEE, MMMM d, yyyy 'at' h:mm a")}
                  {endTime && ` - ${format(endTime, "h:mm a")}`}
                </p>
                <Badge className="mt-1 bg-cyan-500 text-white">
                  <CalendarCheck className="h-3 w-3 mr-1" />
                  {appointment.calendar_name || "GHL Calendar"}
                </Badge>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mt-2">
            {/* Left Column - Map & Photos */}
            <div className="lg:col-span-3 space-y-2">
              {/* Property Address - Compact */}
              {propertyAddress && (
                <div className="p-2 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <p className="font-semibold text-sm flex-1 truncate">{propertyAddress}</p>
                  <div className="flex gap-1">
                    {googleMapsLink && (
                      <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
                        <a href={googleMapsLink} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
                      <a 
                        href={`https://www.zillow.com/homes/${encodeURIComponent(propertyAddress)}_rb/`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <Home className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Map - Google Maps Embed */}
              {googleMapsEmbedUrl ? (
                <div className="rounded-lg overflow-hidden border h-[260px]">
                  <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={googleMapsEmbedUrl}
                    title="Property Location"
                  />
                </div>
              ) : (
                <div className="h-[200px] bg-muted rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground text-sm">No address provided</p>
                </div>
              )}

              {/* Property Photos */}
              {propertyAddress && (
                <PropertyPhotos 
                  address={propertyAddress} 
                  height="180px"
                  className="rounded-lg overflow-hidden border"
                />
              )}

              {/* GHL Notification Warning */}
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-2">
                  <CalendarCheck className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      GHL Calendar Event
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      This appointment was synced from GoHighLevel. GHL may send its own automated reminders separately. 
                      To avoid duplicate notifications, check your GHL workflow settings.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Contact & Details */}
            <div className="lg:col-span-2 space-y-2">
              {/* Score Card - Only if property address exists */}
              {score && (
                <div className={cn("p-3 rounded-lg border", getScoreColor(score))}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium opacity-80">Revenue Score</p>
                      <p className="text-2xl font-bold">{score}/100</p>
                    </div>
                    <Star className="h-8 w-8 opacity-40" />
                  </div>
                  <div className="mt-1 h-1.5 bg-black/10 rounded-full overflow-hidden">
                    <div className="h-full bg-current" style={{ width: `${score}%` }} />
                  </div>
                </div>
              )}

              {/* Contact Info */}
              <div className="p-3 rounded-lg border space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <User className="h-3 w-3" />
                  {contactName}
                </h4>
                
                {/* Email */}
                {contactEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm flex-1 truncate">{contactEmail}</span>
                    <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setShowEmailDialog(true)}>
                      <Mail className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {/* Phone */}
                {contactPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm flex-1">{contactPhone}</span>
                    <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setShowCallConfirm(true)}>
                      <Phone className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-1">
                  {contactEmail && (
                    <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => setShowEmailDialog(true)}>
                      <Mail className="h-3 w-3 mr-1" /> Email
                    </Button>
                  )}
                  {contactPhone && (
                    <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => setShowCallConfirm(true)}>
                      <Phone className="h-3 w-3 mr-1" /> Call
                    </Button>
                  )}
                </div>
              </div>

              {/* Lead Details if matched */}
              {appointment.lead_id && (
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 space-y-2">
                  <h4 className="font-semibold text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
                    <User className="h-3 w-3" />
                    Matched Lead
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {appointment.lead_stage && (
                      <div>
                        <p className="text-muted-foreground">Stage</p>
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">{appointment.lead_stage}</Badge>
                      </div>
                    )}
                    {appointment.lead_source && (
                      <div>
                        <p className="text-muted-foreground">Source</p>
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">{appointment.lead_source}</Badge>
                      </div>
                    )}
                    {appointment.lead_property_type && (
                      <div>
                        <p className="text-muted-foreground">Type</p>
                        <p className="font-medium capitalize">{appointment.lead_property_type.replace("_", " ")}</p>
                      </div>
                    )}
                  </div>
                  {appointment.lead_notes && (
                    <p className="text-xs text-muted-foreground mt-2">{appointment.lead_notes}</p>
                  )}
                </div>
              )}

              {/* Tags */}
              {appointment.contact_tags && appointment.contact_tags.length > 0 && (
                <div className="p-2 rounded-lg border">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag className="h-3 w-3 text-muted-foreground" />
                    {appointment.contact_tags.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Meeting Link - Prominent */}
              {meetLink && (
                <Button className="w-full h-10 text-sm bg-green-600 hover:bg-green-700 font-medium" asChild>
                  <a href={meetLink} target="_blank" rel="noopener noreferrer">
                    <Video className="h-5 w-5 mr-2" /> 
                    {meetLink.includes("zoom") ? "Join Zoom" : meetLink.includes("teams") ? "Join Teams" : "Join Google Meet"}
                  </a>
                </Button>
              )}

              {/* Notes */}
              {appointment.notes && (
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <h4 className="font-semibold text-xs flex items-center gap-1 text-amber-800 dark:text-amber-200 mb-1">
                    <FileText className="h-3 w-3" /> Notes
                  </h4>
                  <div className="text-xs text-amber-900 dark:text-amber-100 whitespace-pre-wrap max-h-[100px] overflow-y-auto">
                    {appointment.notes}
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Call Confirmation Dialog */}
      <AlertDialog open={showCallConfirm} onOpenChange={setShowCallConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              Call {contactName}?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>You're about to initiate a call to:</p>
              <div className="p-3 rounded-lg bg-muted mt-2">
                <p className="font-semibold">{contactName}</p>
                <p className="text-primary font-medium">{contactPhone}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCallingLead}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCallContact}
              disabled={isCallingLead || !appointment.lead_id}
              className="bg-green-600 hover:bg-green-700"
            >
              {isCallingLead ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Calling...
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4 mr-2" />
                  Yes, Call Now
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email Dialog */}
      {contactEmail && appointment.lead_id && (
        <SendEmailDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          contactName={contactName}
          contactEmail={contactEmail}
          contactType="lead"
          contactId={appointment.lead_id}
        />
      )}
    </>
  );
}

interface DiscoveryCallDetailModalProps {
  call: DiscoveryCall | null;
  onClose: () => void;
  onOptimisticDelete: (callId: string) => void;
  onRevertDelete: (callId: string) => void;
}

function DiscoveryCallDetailModal({ call, onClose, onOptimisticDelete, onRevertDelete }: DiscoveryCallDetailModalProps) {
  const [showCallConfirm, setShowCallConfirm] = useState(false);
  const [isCallingLead, setIsCallingLead] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  if (!call) return null;

  // Determine if this is an inspection
  const isInspection = call.meeting_type === 'inspection' || 
    call.meeting_type === 'virtual_inspection' || 
    call.service_interest === 'onboarding_inspection';

  const score = calculateRevenueScore(
    call.leads?.property_address || "",
    call.leads?.property_type || null
  );
  const scheduledAt = new Date(call.scheduled_at);

  // Use Google Maps link
  const googleMapsLink = call.leads?.property_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(call.leads.property_address)}`
    : null;

  // Google Maps Static API - clean map without address popup
  // Using place search with no markers to show just the area
  const googleMapsEmbedUrl = call.leads?.property_address
    ? `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${encodeURIComponent(call.leads.property_address)}&zoom=12&maptype=roadmap`
    : null;

  // Combine all notes
  const allNotes = [call.meeting_notes, call.leads?.notes].filter(Boolean).join("\n\n");

  const handleCallLead = async () => {
    if (!call.leads?.phone || !call.leads?.id) return;
    
    setIsCallingLead(true);
    try {
      const { data, error } = await supabase.functions.invoke("elevenlabs-voice-call", {
        body: {
          leadId: call.leads.id,
          message: `Hello ${call.leads.name}, this is PeachHaus calling about your upcoming discovery call. We're looking forward to speaking with you!`,
        },
      });

      if (error) throw error;

      toast.success(`Call initiated to ${call.leads.name}`, {
        description: `Calling ${call.leads.phone}`,
      });
    } catch (error: any) {
      console.error("Error initiating call:", error);
      toast.error("Failed to initiate call", {
        description: error.message,
      });
    } finally {
      setIsCallingLead(false);
      setShowCallConfirm(false);
    }
  };

  const handleDeleteCall = async () => {
    setIsDeleting(true);
    
    // Optimistic update - immediately remove from UI
    onOptimisticDelete(call.id);
    
    try {
      // First, delete the Google Calendar event if it exists
      if (call.google_calendar_event_id) {
        console.log("Deleting Google Calendar event:", call.google_calendar_event_id);
        const { error: calendarError } = await supabase.functions.invoke("delete-calendar-event", {
          body: { eventId: call.google_calendar_event_id },
        });
        
        if (calendarError) {
          console.warn("Failed to delete calendar event:", calendarError);
          // Continue with DB deletion even if calendar deletion fails
        }
      }
      
      // Then delete from database
      const { error } = await supabase
        .from("discovery_calls")
        .delete()
        .eq("id", call.id);

      if (error) throw error;

      toast.success("Call deleted", {
        description: `Discovery call with ${call.leads?.name || "Unknown"} removed`,
      });
      
      // Invalidate queries to refresh calendar
      queryClient.invalidateQueries({ queryKey: ["discovery-calls-calendar"] });
      onClose();
    } catch (error: any) {
      console.error("Error deleting call:", error);
      // Revert optimistic update on error
      onRevertDelete(call.id);
      toast.error("Failed to delete call", {
        description: error.message,
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <Dialog open={!!call} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <img 
                src="/images/peachhaus-logo.png" 
                alt="PeachHaus" 
                className="h-10 w-auto"
              />
              <div>
                <span className="flex items-center gap-2">
                  {isInspection ? (
                    <>
                      <Home className="h-5 w-5 text-amber-600" />
                      Inspection with {call.leads?.name || "Unknown"}
                    </>
                  ) : (
                    <>Discovery Call with {call.leads?.name || "Unknown"}</>
                  )}
                </span>
                <p className="text-sm font-normal text-muted-foreground">
                  {format(scheduledAt, "EEEE, MMMM d, yyyy 'at' h:mm a")}
                </p>
                {isInspection && (
                  <Badge className="mt-1 bg-amber-500 text-white">
                    {call.meeting_type === 'virtual_inspection' ? '📹 Virtual Inspection' : '🏠 In-Person Inspection'}
                  </Badge>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 mt-2">
            {/* Left Column - Map & Photos (takes more space) */}
            <div className="lg:col-span-3 space-y-2">
              {/* Property Address - Compact */}
              {call.leads?.property_address && (
                <div className="p-2 rounded-lg bg-primary/5 border border-primary/20 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <p className="font-semibold text-sm flex-1 truncate">{call.leads.property_address}</p>
                  <div className="flex gap-1">
                    {googleMapsLink && (
                      <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
                        <a href={googleMapsLink} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 px-2" asChild>
                      <a 
                        href={`https://www.zillow.com/homes/${encodeURIComponent(call.leads.property_address)}_rb/`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <Home className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </div>
              )}
              
              {/* Map - Google Maps Embed - Bigger */}
              {googleMapsEmbedUrl ? (
                <div className="rounded-lg overflow-hidden border h-[260px]">
                  <iframe
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                    src={googleMapsEmbedUrl}
                    title="Property Location"
                  />
                </div>
              ) : (
                <div className="h-[200px] bg-muted rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground text-sm">No address provided</p>
                </div>
              )}

              {/* Property Photos */}
              {call.leads?.property_address && (
                <PropertyPhotos 
                  address={call.leads.property_address} 
                  height="180px"
                  className="rounded-lg overflow-hidden border"
                />
              )}
            </div>

            {/* Right Column - Contact & Details (compact) */}
            <div className="lg:col-span-2 space-y-2">
              {/* Score Card - Compact */}
              <div
                className={cn(
                  "p-3 rounded-lg border",
                  getScoreColor(score)
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium opacity-80">Revenue Score</p>
                    <p className="text-2xl font-bold">{score}/100</p>
                  </div>
                  <Star className="h-8 w-8 opacity-40" />
                </div>
                <div className="mt-1 h-1.5 bg-black/10 rounded-full overflow-hidden">
                  <div className="h-full bg-current" style={{ width: `${score}%` }} />
                </div>
              </div>

              {/* Contact Info - Compact */}
              <div className="p-3 rounded-lg border space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <User className="h-3 w-3" />
                  {call.leads?.name || "N/A"}
                </h4>
                
                {/* Email */}
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm flex-1 truncate">{call.leads?.email || "N/A"}</span>
                  {call.leads?.email && (
                    <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setShowEmailDialog(true)}>
                      <Mail className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* Phone */}
                <div className="flex items-center gap-2">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm flex-1">{call.leads?.phone || "N/A"}</span>
                  {call.leads?.phone && (
                    <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setShowCallConfirm(true)}>
                      <Phone className="h-3 w-3" />
                    </Button>
                  )}
                </div>

                {/* Action Buttons - Full width */}
                <div className="flex gap-2 pt-1">
                  {call.leads?.email && (
                    <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => setShowEmailDialog(true)}>
                      <Mail className="h-3 w-3 mr-1" /> Email
                    </Button>
                  )}
                  {call.leads?.phone && (
                    <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => setShowCallConfirm(true)}>
                      <Phone className="h-3 w-3 mr-1" /> Call
                    </Button>
                  )}
                </div>
              </div>

              {/* Service Details - Compact */}
              <div className="p-3 rounded-lg border">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">Interest</p>
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      {getServiceLabel(call.service_interest)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Timeline</p>
                    <Badge variant="secondary" className="text-xs px-1.5 py-0">
                      {getTimelineLabel(call.start_timeline)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Type</p>
                    <p className="font-medium capitalize">
                      {call.leads?.property_type?.replace("_", " ") || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Duration</p>
                    <p className="font-medium">{call.duration_minutes} min</p>
                  </div>
                  {call.leads?.opportunity_value && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Est. Value</p>
                      <p className="font-medium flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {call.leads.opportunity_value.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Meeting Link for Video Calls - Make prominent */}
              {call.meeting_type === "video" && call.google_meet_link && (
                <Button className="w-full h-10 text-sm bg-green-600 hover:bg-green-700 font-medium" asChild>
                  <a href={call.google_meet_link} target="_blank" rel="noopener noreferrer">
                    <Video className="h-5 w-5 mr-2" /> Join Google Meet
                  </a>
                </Button>
              )}

              {/* Delete Button */}
              <Button 
                variant="outline" 
                className="w-full h-8 text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-3 w-3 mr-1" /> Delete Scheduled Call
              </Button>

              {/* Combined Notes - Compact */}
              {allNotes && (
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <h4 className="font-semibold text-xs flex items-center gap-1 text-amber-800 dark:text-amber-200 mb-1">
                    <FileText className="h-3 w-3" /> Notes
                  </h4>
                  <div className="text-xs text-amber-900 dark:text-amber-100 whitespace-pre-wrap max-h-[100px] overflow-y-auto">
                    {allNotes}
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Call Confirmation Dialog */}
      <AlertDialog open={showCallConfirm} onOpenChange={setShowCallConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              Call {call.leads?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>You're about to initiate a call to:</p>
              <div className="p-3 rounded-lg bg-muted mt-2">
                <p className="font-semibold">{call.leads?.name}</p>
                <p className="text-primary font-medium">{call.leads?.phone}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCallingLead}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCallLead}
              disabled={isCallingLead}
              className="bg-green-600 hover:bg-green-700"
            >
              {isCallingLead ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Calling...
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4 mr-2" />
                  Yes, Call Now
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email Dialog */}
      {call.leads?.email && call.leads?.id && (
        <SendEmailDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          contactName={call.leads.name}
          contactEmail={call.leads.email}
          contactType="lead"
          contactId={call.leads.id}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete Scheduled Call?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the discovery call scheduled with {call.leads?.name || "Unknown"} on {format(scheduledAt, "MMMM d, yyyy 'at' h:mm a")}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCall}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
