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
import { cn } from "@/lib/utils";

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

  const { data: calls = [], isLoading } = useQuery({
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

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Discovery Calls
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium min-w-[140px] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Calendar Grid */}
          <div className="lg:col-span-3">
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
                const dayCalls = getCallsForDay(day);
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
                      {dayCalls.slice(0, 3).map((call) => {
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
                      })}
                      {dayCalls.length > 3 && (
                        <div className="text-xs text-muted-foreground text-center">
                          +{dayCalls.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming calls sidebar */}
          <div className="lg:col-span-1">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Upcoming Calls
            </h3>
            <ScrollArea className="h-[400px]">
              {upcomingCalls.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming calls</p>
              ) : (
                <div className="space-y-3">
                  {upcomingCalls.map((call) => {
                    const score = calculateRevenueScore(
                      call.leads?.property_address || "",
                      call.leads?.property_type || null
                    );
                    return (
                      <button
                        key={call.id}
                        onClick={() => setSelectedCall(call)}
                        className="w-full text-left p-3 rounded-lg border hover:border-primary transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">
                            {call.leads?.name || "Unknown"}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn("text-xs", getScoreColor(score))}
                          >
                            {score}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(call.scheduled_at), "MMM d, h:mm a")}
                          </div>
                          <div className="flex items-center gap-1">
                            {call.meeting_type === "video" ? (
                              <Video className="h-3 w-3 text-green-600" />
                            ) : (
                              <Phone className="h-3 w-3 text-blue-600" />
                            )}
                            {call.meeting_type === "video" ? "Video" : "Phone"}
                          </div>
                          {call.leads?.property_address && (
                            <div className="flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {call.leads.property_address}
                              </span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </CardContent>

      {/* Call Detail Modal */}
      <DiscoveryCallDetailModal
        call={selectedCall}
        onClose={() => setSelectedCall(null)}
      />
    </Card>
  );
}

interface DiscoveryCallDetailModalProps {
  call: DiscoveryCall | null;
  onClose: () => void;
}

function DiscoveryCallDetailModal({ call, onClose }: DiscoveryCallDetailModalProps) {
  if (!call) return null;

  const score = calculateRevenueScore(
    call.leads?.property_address || "",
    call.leads?.property_type || null
  );
  const scheduledAt = new Date(call.scheduled_at);

  const mapUrl = call.leads?.property_address
    ? `https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_EMBED_KEY || ""}&q=${encodeURIComponent(call.leads.property_address)}&zoom=15`
    : null;

  const mapsLink = call.leads?.property_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(call.leads.property_address)}`
    : null;

  return (
    <Dialog open={!!call} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div
              className={cn(
                "p-2 rounded-full",
                call.meeting_type === "video"
                  ? "bg-green-100 dark:bg-green-900/30"
                  : "bg-blue-100 dark:bg-blue-900/30"
              )}
            >
              {call.meeting_type === "video" ? (
                <Video className="h-5 w-5 text-green-600" />
              ) : (
                <Phone className="h-5 w-5 text-blue-600" />
              )}
            </div>
            <div>
              <span>Discovery Call with {call.leads?.name || "Unknown"}</span>
              <p className="text-sm font-normal text-muted-foreground">
                {format(scheduledAt, "EEEE, MMMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
          {/* Map Section */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Property Location
            </h3>
            {call.leads?.property_address ? (
              <>
                <div className="rounded-lg overflow-hidden border h-[300px]">
                  {mapUrl ? (
                    <iframe
                      src={mapUrl}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <img
                        src={`https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(call.leads.property_address)}&zoom=15&size=400x300&maptype=roadmap&markers=color:red%7C${encodeURIComponent(call.leads.property_address)}`}
                        alt="Property location"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{call.leads.property_address}</p>
                {mapsLink && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={mapsLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open in Google Maps
                    </a>
                  </Button>
                )}
              </>
            ) : (
              <div className="h-[300px] bg-muted rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">No address provided</p>
              </div>
            )}
          </div>

          {/* Call Details Section */}
          <div className="space-y-4">
            {/* Score Card */}
            <div
              className={cn(
                "p-4 rounded-lg border-2",
                getScoreColor(score)
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium opacity-80">Revenue Potential Score</p>
                  <p className="text-3xl font-bold">{score}/100</p>
                </div>
                <div className="text-right">
                  <Star className="h-10 w-10 opacity-50" />
                </div>
              </div>
              <div className="mt-2 h-2 bg-black/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-current transition-all"
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>

            {/* Contact Info */}
            <div className="p-4 rounded-lg border space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Contact Information
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Name</p>
                  <p className="font-medium">{call.leads?.name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{call.leads?.email || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-medium">{call.leads?.phone || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Duration</p>
                  <p className="font-medium">{call.duration_minutes} minutes</p>
                </div>
              </div>
            </div>

            {/* Service Details */}
            <div className="p-4 rounded-lg border space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Home className="h-4 w-4" />
                Service Details
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Interest</p>
                  <Badge variant="secondary">
                    {getServiceLabel(call.service_interest)}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Timeline</p>
                  <Badge variant="secondary">
                    {getTimelineLabel(call.start_timeline)}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Property Type</p>
                  <p className="font-medium capitalize">
                    {call.leads?.property_type?.replace("_", " ") || "N/A"}
                  </p>
                </div>
                {call.leads?.opportunity_value && (
                  <div>
                    <p className="text-muted-foreground">Est. Value</p>
                    <p className="font-medium flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {call.leads.opportunity_value.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Meeting Link for Video Calls */}
            {call.meeting_type === "video" && call.google_meet_link && (
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <h4 className="font-semibold flex items-center gap-2 text-green-800 dark:text-green-200">
                  <Video className="h-4 w-4" />
                  Video Meeting
                </h4>
                <Button className="w-full mt-2 bg-green-600 hover:bg-green-700" asChild>
                  <a href={call.google_meet_link} target="_blank" rel="noopener noreferrer">
                    <Video className="h-4 w-4 mr-2" />
                    Join Google Meet
                  </a>
                </Button>
              </div>
            )}

            {/* Notes */}
            {(call.meeting_notes || call.leads?.notes) && (
              <div className="p-4 rounded-lg border space-y-2">
                <h4 className="font-semibold">Notes</h4>
                {call.meeting_notes && (
                  <p className="text-sm text-muted-foreground">{call.meeting_notes}</p>
                )}
                {call.leads?.notes && (
                  <p className="text-sm text-muted-foreground">{call.leads.notes}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
