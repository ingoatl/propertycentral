import { useState, useEffect } from "react";
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
  Plus,
  Briefcase,
} from "lucide-react";
import { CallDialog } from "@/components/communications/CallDialog";
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
  addWeeks,
  subWeeks,
} from "date-fns";
import { formatInEST, formatInESTWithLabel } from "@/lib/timezone-utils";
import { cn } from "@/lib/utils";
import { PropertyPhotos } from "@/components/ui/property-photos";
import { toast } from "sonner";
import { SendEmailDialog } from "@/components/communications/SendEmailDialog";
import { SendVoicemailDialog } from "@/components/communications/SendVoicemailDialog";
import { QuickSMSDialog } from "@/components/communications/QuickSMSDialog";
import { useGhlCalendarSync, GhlAppointment } from "@/hooks/useGhlCalendarSync";
import { AdminRescheduleDialog } from "@/components/scheduling/AdminRescheduleDialog";
import { OwnerCallDetailModal } from "@/components/calendar/OwnerCallDetailModal";
import { useTeamAppointments, TeamAppointment, APPOINTMENT_TYPES } from "@/hooks/useTeamAppointments";
import { CreateAppointmentDialog } from "@/components/calendar/CreateAppointmentDialog";
import { AppointmentDetailModal } from "@/components/calendar/AppointmentDetailModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

interface OwnerCall {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  meeting_type: string | null;
  topic: string;
  topic_details?: string | null;
  meeting_notes?: string | null;
  google_meet_link: string | null;
  google_calendar_event_id: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  property_owners: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
}

// Unified calendar event type
interface CalendarEvent {
  id: string;
  type: "discovery" | "ghl" | "inspection" | "owner_call";
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
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('week');
  const [selectedCall, setSelectedCall] = useState<DiscoveryCall | null>(null);
  const [selectedOwnerCall, setSelectedOwnerCall] = useState<OwnerCall | null>(null);
  const [selectedGhlEvent, setSelectedGhlEvent] = useState<GhlAppointment | null>(null);
  const [selectedTeamAppointment, setSelectedTeamAppointment] = useState<TeamAppointment | null>(null);
  const [showCreateAppointment, setShowCreateAppointment] = useState(false);
  const [selectedTeamMember, setSelectedTeamMember] = useState<string>("all");
  // Local state for optimistic deletion
  const [deletedCallIds, setDeletedCallIds] = useState<Set<string>>(new Set());
  const [deletedOwnerCallIds, setDeletedOwnerCallIds] = useState<Set<string>>(new Set());

  // Week navigation helpers
  const goToPrevWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  const goToNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  const goToThisWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));

  // Fetch team members for filter dropdown
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members-calendar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, email")
        .eq("status", "approved")
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch team appointments - filtered by selected team member
  const { data: teamAppointments = [], isLoading: isLoadingTeamAppts } = useTeamAppointments({
    startDate: startOfMonth(currentMonth),
    endDate: endOfMonth(currentMonth),
    status: ["scheduled", "confirmed"],
    assignedTo: selectedTeamMember !== "all" ? selectedTeamMember : undefined,
  });

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

  // Fetch owner calls - exclude cancelled/deleted/completed
  const { data: ownerCalls = [], isLoading: isLoadingOwnerCalls } = useQuery({
    queryKey: ["owner-calls-calendar", format(currentMonth, "yyyy-MM")],
    queryFn: async () => {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      const { data, error } = await supabase
        .from("owner_calls")
        .select(`
          *,
          property_owners (id, name, email, phone)
        `)
        .gte("scheduled_at", monthStart.toISOString())
        .lte("scheduled_at", monthEnd.toISOString())
        .not("status", "in", '("cancelled","completed")')
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      return data as OwnerCall[];
    },
  });

  // Fetch GHL calendar appointments (auto-synced)
  const { appointments: ghlAppointments, isLoading: isLoadingGhl } = useGhlCalendarSync(currentMonth);

  // Filter GHL appointments: ONLY show appointments that were booked directly through GHL
  // (not website bookings that sync to GHL). We identify GHL-native bookings by checking
  // if they have a matching discovery_call or owner_call - if they do, they came from our website.
  const filteredGhlAppointments = ghlAppointments.filter((apt) => {
    const aptDate = new Date(apt.scheduled_at);
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    if (aptDate < monthStart || aptDate > monthEnd) return false;
    
    const aptTime = aptDate.getTime();
    
    // EXCLUDE if this appointment matches any discovery_call (means it's a website booking)
    const isDiscoveryBooking = calls.some((call) => {
      const callTime = new Date(call.scheduled_at).getTime();
      const timesMatch = Math.abs(aptTime - callTime) < 30 * 60 * 1000; // 30 min window
      const nameMatches = call.leads?.name?.toLowerCase() === apt.contact_name?.toLowerCase();
      const emailMatches = call.leads?.email?.toLowerCase() === apt.contact_email?.toLowerCase();
      return timesMatch && (nameMatches || emailMatches);
    });
    
    // EXCLUDE if this appointment matches any owner_call (means it's an owner booking)
    const isOwnerBooking = ownerCalls.some((call) => {
      const callTime = new Date(call.scheduled_at).getTime();
      const timesMatch = Math.abs(aptTime - callTime) < 30 * 60 * 1000; // 30 min window
      const nameMatches = (call.property_owners?.name || call.contact_name)?.toLowerCase() === apt.contact_name?.toLowerCase();
      const emailMatches = (call.property_owners?.email || call.contact_email)?.toLowerCase() === apt.contact_email?.toLowerCase();
      return timesMatch && (nameMatches || emailMatches);
    });
    
    // Only include if NOT a website/owner booking (i.e., was booked directly in GHL)
    return !isDiscoveryBooking && !isOwnerBooking;
  });


  const isLoading = isLoadingCalls || isLoadingGhl || isLoadingOwnerCalls || isLoadingTeamAppts;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Current week days for week view - using selected week start
  const today = new Date();
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 0 });
  const currentWeekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });

  // Filter out optimistically deleted calls
  const filteredCalls = calls.filter(call => !deletedCallIds.has(call.id));
  const filteredOwnerCalls = ownerCalls.filter(call => !deletedOwnerCallIds.has(call.id));

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

  const getOwnerCallsForDay = (date: Date) => {
    return filteredOwnerCalls.filter((call) => 
      isSameDay(new Date(call.scheduled_at), date) && call.status === 'scheduled'
    );
  };

  const getTeamAppointmentsForDay = (date: Date) => {
    return teamAppointments.filter((apt) => isSameDay(new Date(apt.scheduled_at), date));
  };

  const getAllEventsForDay = (date: Date) => {
    const dayCalls = getCallsForDay(date).map(call => ({ type: 'discovery' as const, data: call, time: new Date(call.scheduled_at) }));
    const dayInspections = getInspectionsForDay(date).map(call => ({ type: 'inspection' as const, data: call, time: new Date(call.scheduled_at) }));
    const dayGhl = getGhlEventsForDay(date).map(apt => ({ type: 'ghl' as const, data: apt, time: new Date(apt.scheduled_at) }));
    const dayOwnerCalls = getOwnerCallsForDay(date).map(call => ({ type: 'owner_call' as const, data: call, time: new Date(call.scheduled_at) }));
    const dayTeamAppts = getTeamAppointmentsForDay(date).map(apt => ({ type: 'team' as const, data: apt, time: new Date(apt.scheduled_at) }));
    return [...dayCalls, ...dayInspections, ...dayGhl, ...dayOwnerCalls, ...dayTeamAppts].sort((a, b) => a.time.getTime() - b.time.getTime());
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

  const upcomingOwnerCalls = filteredOwnerCalls
    .filter((call) => new Date(call.scheduled_at) >= new Date() && call.status === "scheduled")
    .slice(0, 5);

  const upcomingTeamAppts = teamAppointments
    .filter((apt) => new Date(apt.scheduled_at) >= new Date())
    .slice(0, 5);

  // Combined upcoming events
  const allUpcomingEvents = [
    ...upcomingCalls.map(call => ({ type: 'discovery' as const, data: call, time: new Date(call.scheduled_at) })),
    ...upcomingInspections.map(call => ({ type: 'inspection' as const, data: call, time: new Date(call.scheduled_at) })),
    ...upcomingGhlEvents.map(apt => ({ type: 'ghl' as const, data: apt, time: new Date(apt.scheduled_at) })),
    ...upcomingOwnerCalls.map(call => ({ type: 'owner_call' as const, data: call, time: new Date(call.scheduled_at) })),
    ...upcomingTeamAppts.map(apt => ({ type: 'team' as const, data: apt, time: new Date(apt.scheduled_at) })),
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
              <Badge variant="outline" className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">
                <User className="h-3 w-3 mr-1" />
                Owner
              </Badge>
              <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                <Briefcase className="h-3 w-3 mr-1" />
                Team
              </Badge>
            </div>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              className="h-9 px-3 text-xs font-medium"
              onClick={() => setShowCreateAppointment(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create
            </Button>
            {/* Team Member Filter */}
            <Select value={selectedTeamMember} onValueChange={setSelectedTeamMember}>
              <SelectTrigger className="h-9 w-36 text-xs">
                <SelectValue placeholder="View calendar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Team</SelectItem>
                {teamMembers
                  .filter((member) => member.id && member.id.trim() !== "")
                  .map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.first_name || member.email}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs font-medium"
              onClick={() => {
                if (calendarView === 'week') {
                  goToThisWeek();
                } else {
                  setCurrentMonth(new Date());
                }
              }}
            >
              Today
            </Button>
            {/* Week view navigation */}
            {calendarView === 'week' && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={goToPrevWeek}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-medium min-w-[160px] text-center text-sm">
                  {format(currentWeekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={goToNextWeek}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
            {/* Month view navigation */}
            {calendarView === 'month' && (
              <>
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
              </>
            )}
            <Button
              variant={calendarView === 'week' ? 'outline' : 'default'}
              size="sm"
              className={cn(
                "h-9 px-3 text-xs font-medium",
                calendarView === 'month' && "bg-primary text-primary-foreground"
              )}
              onClick={() => setCalendarView(calendarView === 'week' ? 'month' : 'week')}
            >
              {calendarView === 'week' ? 'Show Full Calendar' : '← Back to Week View'}
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
                          {formatInESTWithLabel(event.time, "MMM d, h:mm a")}
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
                          {formatInESTWithLabel(event.time, "MMM d, h:mm a")}
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
                } else if (event.type === 'ghl') {
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
                          {formatInESTWithLabel(event.time, "MMM d, h:mm a")}
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
                } else if (event.type === 'owner_call') {
                  const ownerCall = event.data as OwnerCall;
                  const ownerName = ownerCall.property_owners?.name || ownerCall.contact_name || "Unknown Owner";
                  const topicLabels: Record<string, string> = {
                    monthly_statement: "Monthly Statement",
                    maintenance: "Maintenance",
                    guest_concerns: "Guest Concerns",
                    pricing: "Pricing",
                    general_checkin: "Check-in",
                    property_update: "Property Update",
                    other: "Other"
                  };
                  return (
                    <button
                      key={ownerCall.id}
                      onClick={() => setSelectedOwnerCall(ownerCall)}
                      className="flex-shrink-0 w-[280px] snap-start text-left p-3 rounded-lg border border-purple-200 dark:border-purple-800 hover:border-primary active:bg-muted/50 transition-colors bg-purple-50/50 dark:bg-purple-900/10"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm truncate max-w-[180px]">
                          {ownerName}
                        </span>
                        <Badge variant="outline" className="text-xs flex-shrink-0 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">
                          Owner
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 flex-shrink-0" />
                          {formatInESTWithLabel(event.time, "MMM d, h:mm a")}
                        </div>
                        <div className="flex items-center gap-1">
                          {ownerCall.meeting_type === "video" ? (
                            <Video className="h-3 w-3 text-purple-600 flex-shrink-0" />
                          ) : (
                            <Phone className="h-3 w-3 text-purple-600 flex-shrink-0" />
                          )}
                          <span className="truncate">{topicLabels[ownerCall.topic] || ownerCall.topic}</span>
                        </div>
                      </div>
                    </button>
                  );
                } else if (event.type === 'team') {
                  const teamAppt = event.data as TeamAppointment;
                  const typeConfig = APPOINTMENT_TYPES.find(t => t.value === teamAppt.appointment_type);
                  return (
                    <button
                      key={teamAppt.id}
                      onClick={() => setSelectedTeamAppointment(teamAppt)}
                      className="flex-shrink-0 w-[280px] snap-start text-left p-3 rounded-lg border border-blue-200 dark:border-blue-800 hover:border-primary active:bg-muted/50 transition-colors bg-blue-50/50 dark:bg-blue-900/10"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm truncate max-w-[180px]">
                          {teamAppt.title}
                        </span>
                        <Badge variant="outline" className="text-xs flex-shrink-0 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                          {typeConfig?.label || "Team"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 flex-shrink-0" />
                          {formatInESTWithLabel(event.time, "MMM d, h:mm a")}
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-blue-600 flex-shrink-0" />
                          <span className="truncate">{teamAppt.assigned_profile?.first_name || "Unassigned"}</span>
                        </div>
                        {(teamAppt.property?.address || teamAppt.location_address) && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{teamAppt.property?.address || teamAppt.location_address}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                } else {
                  return null;
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
                const hasOwnerCall = dayEvents.some(e => e.type === 'owner_call');

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => {
                      if (hasEvent) {
                        const first = dayEvents[0];
                        if (first.type === 'discovery' || first.type === 'inspection') {
                          setSelectedCall(first.data as DiscoveryCall);
                        } else if (first.type === 'owner_call') {
                          setSelectedOwnerCall(first.data as OwnerCall);
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
                      hasOwnerCall && !hasDiscovery && !hasInspection && !isCurrentDay && "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 font-medium",
                      hasGhl && !hasDiscovery && !hasInspection && !hasOwnerCall && !isCurrentDay && "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200 font-medium"
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

        {/* Desktop: Week or Full calendar based on view toggle */}
        <div className="hidden lg:block">
          {calendarView === 'week' ? (
            /* Week View - Compact current week only */
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-sm text-muted-foreground">
                  {format(currentWeekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
                </h4>
              </div>
              
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

              {/* Week days */}
              <div className="grid grid-cols-7 gap-2">
                {currentWeekDays.map((day) => {
                  const dayEvents = getAllEventsForDay(day);
                  const isCurrentDay = isToday(day);

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "min-h-[140px] p-2 border rounded-lg transition-colors",
                        isCurrentDay && "ring-2 ring-primary bg-primary/5"
                      )}
                    >
                      <div className="text-center mb-2">
                        <div className="text-xs text-muted-foreground">{format(day, "EEE")}</div>
                        <div className={cn(
                          "text-lg font-bold",
                          isCurrentDay && "text-primary"
                        )}>
                          {format(day, "d")}
                        </div>
                      </div>
                      <div className="space-y-1">
                        {dayEvents.slice(0, 4).map((event) => {
                          if (event.type === 'discovery') {
                            const call = event.data as DiscoveryCall;
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
                                    {formatInEST(call.scheduled_at, "h:mm a")}
                                  </span>
                                </div>
                                <div className="truncate opacity-80">
                                  {call.leads?.name || "Unknown"}
                                </div>
                              </button>
                            );
                          } else if (event.type === 'inspection') {
                            const call = event.data as DiscoveryCall;
                            return (
                              <button
                                key={call.id}
                                onClick={() => setSelectedCall(call)}
                                className="w-full text-left text-xs p-1.5 rounded transition-all hover:scale-[1.02] bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200"
                              >
                                <div className="flex items-center gap-1">
                                  <Home className="h-3 w-3 shrink-0" />
                                  <span className="truncate font-medium">
                                    {formatInEST(call.scheduled_at, "h:mm a")}
                                  </span>
                                </div>
                                <div className="truncate opacity-80">
                                  {call.leads?.name || "Unknown"}
                                </div>
                              </button>
                            );
                          } else if (event.type === 'ghl') {
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
                                    {formatInEST(apt.scheduled_at, "h:mm a")}
                                  </span>
                                </div>
                                <div className="truncate opacity-80">
                                  {apt.contact_name || "Appointment"}
                                </div>
                              </button>
                            );
                          } else if (event.type === 'owner_call') {
                            const ownerCall = event.data as OwnerCall;
                            return (
                              <button
                                key={ownerCall.id}
                                onClick={() => setSelectedOwnerCall(ownerCall)}
                                className="w-full text-left text-xs p-1.5 rounded transition-all hover:scale-[1.02] bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200"
                              >
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3 shrink-0" />
                                  <span className="truncate font-medium">
                                    {formatInEST(ownerCall.scheduled_at, "h:mm a")}
                                  </span>
                                </div>
                                <div className="truncate opacity-80">
                                  {ownerCall.property_owners?.name || "Owner"}
                                </div>
                              </button>
                            );
                          }
                          return null;
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
          ) : (
            /* Full Month View - Original calendar */
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
                                  {formatInEST(call.scheduled_at, "h:mm a")}
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
                                  {formatInEST(call.scheduled_at, "h:mm a")}
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
                        } else if (event.type === 'ghl') {
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
                                  {formatInEST(apt.scheduled_at, "h:mm a")}
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
                        } else if (event.type === 'owner_call') {
                          const ownerCall = event.data as OwnerCall;
                          return (
                            <button
                              key={ownerCall.id}
                              onClick={() => setSelectedOwnerCall(ownerCall)}
                              className="w-full text-left text-xs p-1.5 rounded transition-all hover:scale-[1.02] bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200"
                            >
                              <div className="flex items-center gap-1">
                                {ownerCall.meeting_type === "video" ? (
                                  <Video className="h-3 w-3 shrink-0" />
                                ) : (
                                  <Phone className="h-3 w-3 shrink-0" />
                                )}
                                <span className="truncate font-medium">
                                  {formatInEST(ownerCall.scheduled_at, "h:mm a")}
                                </span>
                              </div>
                              <div className="truncate opacity-80">
                                {ownerCall.property_owners?.name || ownerCall.contact_name || "Owner"}
                              </div>
                              <div className="truncate text-[10px] opacity-70">
                                Owner Call
                              </div>
                            </button>
                          );
                        } else {
                          return null;
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
          )}
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

      {/* Owner Call Detail Modal */}
      <OwnerCallDetailModal
        ownerCall={selectedOwnerCall}
        onClose={() => setSelectedOwnerCall(null)}
        onOptimisticDelete={(callId) => setDeletedOwnerCallIds(prev => new Set(prev).add(callId))}
        onRevertDelete={(callId) => setDeletedOwnerCallIds(prev => {
          const updated = new Set(prev);
          updated.delete(callId);
          return updated;
        })}
        onDeleted={() => {
          queryClient.invalidateQueries({ queryKey: ["owner-calls-calendar"] });
        }}
      />

      {/* Team Appointment Detail Modal */}
      <AppointmentDetailModal
        appointment={selectedTeamAppointment}
        open={!!selectedTeamAppointment}
        onOpenChange={(open) => !open && setSelectedTeamAppointment(null)}
      />

      {/* Create Appointment Dialog */}
      <CreateAppointmentDialog
        open={showCreateAppointment}
        onOpenChange={setShowCreateAppointment}
      />
    </Card>
  );
}

// Default Google Meet link for video appointments
const DEFAULT_VIDEO_MEETING_LINK = "https://meet.google.com/jww-deey-iaa";

// Helper to format time in Eastern timezone with EST/EDT indicator
function formatEasternTime(date: Date): string {
  // Use Intl.DateTimeFormat for proper timezone handling
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
  return formatter.format(date);
}

function formatEasternDateTime(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
  return formatter.format(date);
}

// Helper to extract Google Meet link from various sources - checks ALL possible GHL fields
function extractMeetLink(appointment: GhlAppointment): string | null {
  // First check the dedicated meeting_link field from the sync
  if (appointment.meeting_link) {
    return appointment.meeting_link;
  }
  
  // Extensive search through all possible GHL fields
  // Cast to unknown first to avoid TypeScript strictness
  const rawApt = appointment as unknown as Record<string, unknown>;
  const sources: (string | undefined | null)[] = [
    // Primary video conference fields
    rawApt.meetUrl as string,
    rawApt.conferenceUrl as string,
    rawApt.hangoutLink as string,
    rawApt.videoUrl as string,
    rawApt.meetingUrl as string,
    rawApt.zoomUrl as string,
    rawApt.teamsUrl as string,
    rawApt.joinUrl as string,
    rawApt.calendarLink as string,
    rawApt.video_conference_url as string,
    // Standard text fields
    appointment.location,
    appointment.notes,
    appointment.title,
    appointment.lead_notes,
    rawApt.description as string,
    rawApt.internal_notes as string,
  ];
  
  // Check calendarLinks object if present
  if (rawApt.calendarLinks && typeof rawApt.calendarLinks === 'object') {
    const calLinks = rawApt.calendarLinks as Record<string, unknown>;
    sources.push(calLinks.hangoutLink as string, calLinks.meetUrl as string, calLinks.videoUrl as string);
  }
  
  for (const source of sources) {
    if (source && typeof source === 'string') {
      // Match Google Meet links
      const meetMatch = source.match(/https:\/\/meet\.google\.com\/[a-z0-9-]+/i);
      if (meetMatch) return meetMatch[0];
      
      // Match Zoom links (various formats)
      const zoomMatch = source.match(/https:\/\/[\w.-]*zoom\.us\/(?:j|my|w)\/[a-z0-9/?=&-]+/i);
      if (zoomMatch) return zoomMatch[0];
      
      // Match Teams links
      const teamsMatch = source.match(/https:\/\/teams\.(?:microsoft|live)\.com\/[a-z0-9/?=&-]+/i);
      if (teamsMatch) return teamsMatch[0];
      
      // Match Webex links
      const webexMatch = source.match(/https:\/\/[\w.-]*webex\.com\/[a-z0-9/?=&-]+/i);
      if (webexMatch) return webexMatch[0];
    }
  }
  
  // For GHL appointments with video/virtual meeting type, use default meet link
  const title = appointment.title?.toLowerCase() || '';
  const calendarName = appointment.calendar_name?.toLowerCase() || '';
  if (title.includes('video') || title.includes('virtual') || title.includes('online') ||
      calendarName.includes('video') || calendarName.includes('virtual') || calendarName.includes('discovery')) {
    return DEFAULT_VIDEO_MEETING_LINK;
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
  const [showCallDialog, setShowCallDialog] = useState(false);

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
                  {formatEasternDateTime(scheduledAt)}
                  {endTime && ` - ${formatEasternTime(endTime)}`}
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
                    <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setShowCallDialog(true)}>
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
                    <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" onClick={() => setShowCallDialog(true)}>
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

              {/* Meeting Link - Always Prominent at Top */}
              {meetLink ? (
                <Button className="w-full h-12 text-base bg-green-600 hover:bg-green-700 font-semibold shadow-lg" asChild>
                  <a href={meetLink} target="_blank" rel="noopener noreferrer">
                    <Video className="h-6 w-6 mr-2" /> 
                    {meetLink.includes("zoom") ? "Join Zoom Meeting" : meetLink.includes("teams") ? "Join Teams Meeting" : "Join Google Meet"}
                  </a>
                </Button>
              ) : (
                <div className="w-full p-3 rounded-lg bg-muted/50 border border-dashed text-center">
                  <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <Video className="h-4 w-4" />
                    No meeting link detected
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Check GHL calendar for video conference details
                  </p>
                </div>
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

      {/* Call Dialog - Twilio-based calling */}
      {contactPhone && (
        <CallDialog
          open={showCallDialog}
          onOpenChange={setShowCallDialog}
          contactName={contactName}
          contactPhone={contactPhone}
          contactType="lead"
          contactAddress={propertyAddress}
        />
      )}

      {/* Email Dialog */}
      {contactEmail && (
        <SendEmailDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          contactName={contactName}
          contactEmail={contactEmail}
          contactType="lead"
          contactId={appointment.lead_id || ""}
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
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [showIncomeReportSMS, setShowIncomeReportSMS] = useState(false);
  const [showVoicemailDialog, setShowVoicemailDialog] = useState(false);
  const [incomeReportSMSMessage, setIncomeReportSMSMessage] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  // Generate the income report SMS message
  const generateIncomeReportSMS = () => {
    const firstName = call?.leads?.name?.split(' ')[0] || 'there';
    const propertyAddress = call?.leads?.property_address || 'your property';
    return `Hi ${firstName}, this is Ingo from PeachHaus. I just emailed you an income report for ${propertyAddress} in preparation for our call tomorrow. Looking forward to speaking with you!`;
  };

  // Handle Income Report Prepared button click
  const handleIncomeReportPrepared = () => {
    setIncomeReportSMSMessage(generateIncomeReportSMS());
    setShowIncomeReportSMS(true);
  };

  // After SMS is sent, show voicemail dialog
  const handleSMSSent = () => {
    setShowIncomeReportSMS(false);
    setShowVoicemailDialog(true);
  };

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
      
      // Delete all scheduled follow-ups for this lead
      if (call.leads?.id) {
        console.log("Deleting follow-up schedules for lead:", call.leads.id);
        const { error: followUpError } = await supabase
          .from("lead_follow_up_schedules")
          .delete()
          .eq("lead_id", call.leads.id)
          .eq("status", "scheduled");
        
        if (followUpError) {
          console.warn("Failed to delete follow-up schedules:", followUpError);
        }
      }
      
      // Then delete from database
      const { error } = await supabase
        .from("discovery_calls")
        .delete()
        .eq("id", call.id);

      if (error) throw error;

      toast.success("Call deleted", {
        description: `Discovery call with ${call.leads?.name || "Unknown"} removed along with scheduled follow-ups`,
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
                  {formatEasternDateTime(scheduledAt)}
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
                    <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => setShowCallDialog(true)}>
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
                    <Button variant="outline" size="sm" className="flex-1 h-7 text-xs text-primary border-primary hover:bg-primary hover:text-primary-foreground" onClick={() => setShowCallDialog(true)}>
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

              {/* Income Report Prepared Section */}
              {call.leads?.phone && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 space-y-2">
                  <h4 className="text-xs font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Income Report
                  </h4>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full h-8 text-xs bg-amber-600 hover:bg-amber-700"
                    onClick={handleIncomeReportPrepared}
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    Income Report Prepared
                  </Button>
                  <p className="text-[10px] text-amber-700 dark:text-amber-300">
                    Sends SMS + opens voice message
                  </p>
                </div>
              )}

              {/* Reschedule & Delete Buttons */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1 h-8 text-xs"
                  onClick={() => setShowRescheduleDialog(true)}
                >
                  <Calendar className="h-3 w-3 mr-1" /> Reschedule
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1 h-8 text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              </div>

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

      {/* Twilio Call Dialog */}
      {call.leads?.phone && (
        <CallDialog
          open={showCallDialog}
          onOpenChange={setShowCallDialog}
          contactName={call.leads.name || "Lead"}
          contactPhone={call.leads.phone}
          contactType="lead"
          contactAddress={call.leads.property_address}
          leadId={call.leads.id}
        />
      )}

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

      {/* Admin Reschedule Dialog */}
      <AdminRescheduleDialog
        open={showRescheduleDialog}
        onOpenChange={setShowRescheduleDialog}
        appointmentId={call.id}
        appointmentType="discovery_call"
        currentScheduledAt={call.scheduled_at}
        contactName={call.leads?.name || "Unknown"}
        contactEmail={call.leads?.email || undefined}
        contactPhone={call.leads?.phone || undefined}
        onRescheduleComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["discovery-calls-calendar"] });
          onClose();
        }}
      />

      {/* Income Report SMS Dialog - Pre-filled for review */}
      {call.leads?.phone && (
        <IncomeReportSMSDialog
          open={showIncomeReportSMS}
          onOpenChange={setShowIncomeReportSMS}
          recipientPhone={call.leads.phone}
          recipientName={call.leads.name || "Lead"}
          leadId={call.leads.id}
          initialMessage={incomeReportSMSMessage}
          onSent={handleSMSSent}
        />
      )}

      {/* Voicemail Dialog - Opens after SMS sent */}
      {call.leads?.phone && (
        <SendVoicemailDialog
          open={showVoicemailDialog}
          onOpenChange={setShowVoicemailDialog}
          recipientPhone={call.leads.phone}
          recipientName={call.leads.name || "Lead"}
          leadId={call.leads.id}
        />
      )}
    </>
  );
}

// Custom SMS Dialog with pre-filled message for Income Report
interface IncomeReportSMSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientPhone: string;
  recipientName: string;
  leadId?: string;
  initialMessage: string;
  onSent: () => void;
}

function IncomeReportSMSDialog({
  open,
  onOpenChange,
  recipientPhone,
  recipientName,
  leadId,
  initialMessage,
  onSent,
}: IncomeReportSMSDialogProps) {
  const [message, setMessage] = useState(initialMessage);
  const [isSending, setIsSending] = useState(false);

  // Update message when initialMessage changes or dialog opens
  useEffect(() => {
    if (open && initialMessage) {
      setMessage(initialMessage);
    }
  }, [open, initialMessage]);

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("ghl-send-sms", {
        body: {
          to: recipientPhone,
          message: message.trim(),
          leadId,
          recipientName,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to send SMS");

      toast.success("SMS sent successfully");
      onSent(); // This will close SMS dialog and open voicemail
    } catch (error: any) {
      console.error("SMS send error:", error);
      toast.error(error.message || "Failed to send SMS");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-600" />
            Income Report SMS
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Recipient info */}
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{recipientName}</p>
              <p className="text-sm text-muted-foreground">{recipientPhone}</p>
            </div>
          </div>

          {/* Pre-filled message for review */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Review & Edit Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="w-full p-3 rounded-lg border bg-background resize-none text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isSending}
            />
            <p className="text-xs text-muted-foreground text-right">
              {message.length} / 160 characters
            </p>
          </div>

          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              After sending, a voice message dialog will open so you can record a follow-up voicemail.
            </p>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || !message.trim()}>
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Mail className="h-4 w-4 mr-2" />
            )}
            Send & Continue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
