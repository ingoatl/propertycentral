import { useState, useEffect, useMemo } from "react";
import { Calendar, Clock, Video, Home, Phone, MapPin, ChevronLeft, ChevronRight, User, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, addDays, isToday, isBefore, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import Layout from "@/components/Layout";

interface CalendarEvent {
  id: string;
  type: 'inspection' | 'discovery_call' | 'meeting';
  title: string;
  description?: string;
  scheduled_at: string;
  duration_minutes: number;
  status?: string;
  lead_name?: string;
  lead_phone?: string;
  lead_email?: string;
  property_address?: string;
  meeting_type?: string;
  google_meet_link?: string;
}

const UserCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"month" | "week">("month");

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    loadUser();
  }, []);

  // Fetch all calendar events (inspections, discovery calls, meetings)
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["user-calendar-events", currentMonth, currentUserId],
    queryFn: async () => {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);

      // Fetch discovery calls including inspections
      const { data: calls, error } = await supabase
        .from("discovery_calls")
        .select(`
          id,
          scheduled_at,
          duration_minutes,
          status,
          meeting_type,
          meeting_notes,
          google_meet_link,
          leads (
            name,
            email,
            phone,
            property_address
          )
        `)
        .gte("scheduled_at", monthStart.toISOString())
        .lte("scheduled_at", monthEnd.toISOString())
        .order("scheduled_at", { ascending: true });

      if (error) {
        console.error("Error fetching calendar events:", error);
        return [];
      }

      return (calls || []).map((call): CalendarEvent => {
        const isInspection = call.meeting_type?.includes('inspection');
        const lead = call.leads as any;
        
        return {
          id: call.id,
          type: isInspection ? 'inspection' : 'discovery_call',
          title: isInspection 
            ? `Inspection: ${lead?.name || 'Unknown'}`
            : `Discovery Call: ${lead?.name || 'Unknown'}`,
          description: call.meeting_notes || undefined,
          scheduled_at: call.scheduled_at,
          duration_minutes: call.duration_minutes || 60,
          status: call.status || 'scheduled',
          lead_name: lead?.name,
          lead_phone: lead?.phone,
          lead_email: lead?.email,
          property_address: lead?.property_address,
          meeting_type: call.meeting_type,
          google_meet_link: call.google_meet_link,
        };
      });
    },
    enabled: !!currentUserId,
    refetchInterval: 60000, // Refresh every minute
  });

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  // Get events for a specific day
  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const eventDate = parseISO(event.scheduled_at);
      return isSameDay(eventDate, day);
    });
  };

  // Get events for selected date
  const selectedDateEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
  };

  const getEventColor = (event: CalendarEvent) => {
    if (event.type === 'inspection') {
      return event.meeting_type?.includes('virtual') 
        ? 'bg-purple-500 hover:bg-purple-600' 
        : 'bg-amber-500 hover:bg-amber-600';
    }
    return 'bg-primary hover:bg-primary/90';
  };

  const getEventBadgeVariant = (type: string) => {
    switch (type) {
      case 'inspection': return 'default';
      case 'discovery_call': return 'secondary';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              My Calendar
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              View and manage your scheduled inspections and calls
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "month" | "week")}>
              <TabsList>
                <TabsTrigger value="month">Month</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {format(currentMonth, "MMMM yyyy")}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => navigateMonth('prev')}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    setCurrentMonth(new Date());
                    setSelectedDate(new Date());
                  }}>
                    Today
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => navigateMonth('next')}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Day headers */}
              <div className="grid grid-cols-7 text-center text-xs text-muted-foreground font-medium mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="py-2">{day}</div>
                ))}
              </div>
              
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => {
                  const dayEvents = getEventsForDay(day);
                  const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isPast = isBefore(day, new Date()) && !isToday(day);
                  
                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedDate(day)}
                      className={`
                        min-h-[80px] p-1 text-left border rounded-lg transition-all
                        ${isCurrentMonth ? 'bg-background' : 'bg-muted/30'}
                        ${isSelected ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}
                        ${isToday(day) ? 'border-primary' : 'border-border'}
                        ${isPast ? 'opacity-60' : ''}
                      `}
                    >
                      <div className={`
                        text-sm font-medium mb-1
                        ${isToday(day) ? 'bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center' : ''}
                        ${!isCurrentMonth ? 'text-muted-foreground' : ''}
                      `}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map((event, i) => (
                          <div
                            key={event.id}
                            className={`
                              text-[10px] px-1 py-0.5 rounded text-white truncate
                              ${getEventColor(event)}
                            `}
                          >
                            {event.type === 'inspection' ? '🏠' : '📞'} {format(parseISO(event.scheduled_at), 'h:mma')}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[10px] text-muted-foreground px-1">
                            +{dayEvents.length - 2} more
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Selected Date Events */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {selectedDate ? format(selectedDate, "EEEE, MMM d") : "Select a date"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {selectedDateEvents.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No events scheduled</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedDateEvents.map((event) => (
                      <Card key={event.id} className="overflow-hidden">
                        <div className={`h-1 ${getEventColor(event).replace('hover:bg-', '')}`} />
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{event.title}</div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                <Clock className="h-3 w-3" />
                                {format(parseISO(event.scheduled_at), "h:mm a")} - {event.duration_minutes}min
                              </div>
                            </div>
                            <Badge variant={getEventBadgeVariant(event.type)} className="text-[10px]">
                              {event.type === 'inspection' ? 'Inspection' : 'Call'}
                            </Badge>
                          </div>

                          {event.property_address && (
                            <div className="flex items-start gap-2 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                              <span>{event.property_address}</span>
                            </div>
                          )}

                          {event.lead_name && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span>{event.lead_name}</span>
                            </div>
                          )}

                          {event.lead_phone && (
                            <a 
                              href={`tel:${event.lead_phone}`}
                              className="flex items-center gap-2 text-xs text-primary hover:underline"
                            >
                              <Phone className="h-3 w-3" />
                              <span>{event.lead_phone}</span>
                            </a>
                          )}

                          {event.google_meet_link && (
                            <a
                              href={event.google_meet_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-xs text-primary hover:underline"
                            >
                              <Video className="h-3 w-3" />
                              <span>Join Google Meet</span>
                            </a>
                          )}

                          <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                            {event.status === 'completed' ? (
                              <Badge variant="default" className="text-[10px] bg-green-500">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Completed
                              </Badge>
                            ) : event.status === 'cancelled' ? (
                              <Badge variant="destructive" className="text-[10px]">
                                Cancelled
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px]">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Scheduled
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Home className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {events.filter(e => e.type === 'inspection').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Inspections this month</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {events.filter(e => e.type === 'discovery_call').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Discovery calls</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {events.filter(e => e.status === 'completed').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {events.filter(e => {
                      const eventDate = parseISO(e.scheduled_at);
                      return eventDate >= new Date() && e.status !== 'cancelled';
                    }).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Upcoming</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default UserCalendar;
