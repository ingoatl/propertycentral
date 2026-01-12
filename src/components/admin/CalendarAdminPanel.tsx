import { useState, useEffect } from "react";
import { Calendar, Clock, Plus, Trash2, Ban, ExternalLink, Copy, Check, Link2, CheckCircle2, XCircle, Loader2, RefreshCw, Users, Phone, Mail, MapPin, Building } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: `${i.toString().padStart(2, "0")}:00`,
  label: format(new Date().setHours(i, 0), "h:mm a"),
}));

interface GhlAppointment {
  ghl_event_id: string;
  ghl_calendar_id: string;
  calendar_name: string;
  title: string;
  status: string;
  scheduled_at: string;
  end_time: string;
  notes: string | null;
  location: string | null;
  contact_id: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_address: string | null;
  contact_city: string | null;
  contact_state: string | null;
  contact_source: string | null;
  contact_tags: string[];
  lead_id: string | null;
  lead_name: string | null;
  lead_email: string | null;
  lead_phone: string | null;
  lead_property_address: string | null;
  lead_property_type: string | null;
  lead_stage: string | null;
  lead_source: string | null;
  lead_notes: string | null;
}

export function CalendarAdminPanel() {
  const [newSlotDay, setNewSlotDay] = useState<number>(1);
  const [newSlotStart, setNewSlotStart] = useState("09:00");
  const [newSlotEnd, setNewSlotEnd] = useState("17:00");
  const [blockDate, setBlockDate] = useState<Date | undefined>();
  const [blockReason, setBlockReason] = useState("");
  const [copied, setCopied] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [expandedAppointment, setExpandedAppointment] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Use the production domain for embed links
  const publicUrl = "https://propertycentral.lovable.app/book-discovery-call";
  const iframeCode = `<iframe src="${publicUrl}" width="100%" height="800" frameborder="0" style="border-radius: 12px;"></iframe>`;

  // Fetch availability slots
  const { data: availabilitySlots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ["availability-slots"],
    queryFn: async () => {
      const { data } = await supabase
        .from("availability_slots")
        .select("*")
        .order("day_of_week");
      return data || [];
    },
  });

  // Fetch blocked dates
  const { data: blockedDates = [] } = useQuery({
    queryKey: ["blocked-dates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("blocked_dates")
        .select("*")
        .order("date");
      return data || [];
    },
  });

  // Fetch upcoming discovery calls with all details
  const { data: upcomingCalls = [] } = useQuery({
    queryKey: ["upcoming-discovery-calls"],
    queryFn: async () => {
      const { data } = await supabase
        .from("discovery_calls")
        .select("*, leads(name, email, phone, property_address, property_type)")
        .eq("status", "scheduled")
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at")
        .limit(10);
      return data || [];
    },
  });

  // Fetch GHL Calendar Appointments
  const { data: ghlAppointments = [], isLoading: ghlLoading, refetch: refetchGhlAppointments } = useQuery({
    queryKey: ["ghl-calendar-appointments"],
    queryFn: async () => {
      const response = await supabase.functions.invoke("ghl-sync-calendar", {
        body: {},
      });
      if (response.error) {
        console.error("GHL Calendar error:", response.error);
        return [];
      }
      return (response.data?.appointments || []) as GhlAppointment[];
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  // Check Google Calendar connection status - verify it actually works
  const { data: gcalStatus, isLoading: gcalLoading, refetch: refetchGcalStatus } = useQuery({
    queryKey: ["google-calendar-status"],
    queryFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return { connected: false, verified: false };
      
      // Actually verify the connection works by calling the edge function
      const response = await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "verify-connection", userId: user.user.id },
      });
      
      if (response.error) {
        console.error("Calendar status check error:", response.error);
        return { connected: false, verified: false };
      }
      
      return {
        connected: response.data?.connected || false,
        verified: response.data?.verified || false,
        calendarCount: response.data?.calendarCount,
        error: response.data?.error,
      };
    },
  });

  // Check if returning from OAuth flow (via URL parameter)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const connected = urlParams.get('connected');
    const tab = urlParams.get('tab');
    
    if (connected === 'true' && tab === 'calendar') {
      // Clean the URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      
      // Refetch status and show success
      refetchGcalStatus().then((result) => {
        if (result.data?.connected && result.data?.verified) {
          toast.success("Google Calendar connected successfully!");
        } else {
          toast.info("Verifying Google Calendar connection...");
        }
      });
    }
  }, [refetchGcalStatus]);

  // Connect Google Calendar
  const connectGoogleCalendar = async () => {
    try {
      setIsConnecting(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error("Please log in first");
        setIsConnecting(false);
        return;
      }
      
      // Pass the frontend origin so the edge function knows where to redirect back
      const response = await supabase.functions.invoke("google-calendar-sync", {
        body: { 
          action: "get-auth-url", 
          userId: userData.user.id,
          redirectUrl: window.location.origin  // Pass frontend URL for redirect
        },
      });
      
      if (response.error) throw new Error(response.error.message);
      
      // If success message is returned, already connected
      if (response.data?.success) {
        toast.success(response.data.message || "Google Calendar connected!");
        refetchGcalStatus();
        setIsConnecting(false);
        return;
      }
      
      // Otherwise, need OAuth flow - redirect the current page
      if (response.data?.authUrl) {
        // Redirect the entire page to Google OAuth
        window.location.href = response.data.authUrl;
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to connect Google Calendar");
      setIsConnecting(false);
    }
  };

  // Disconnect Google Calendar
  const disconnectGoogleCalendar = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      
      const response = await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "disconnect", userId: userData.user.id },
      });
      
      if (response.error) throw new Error(response.error.message);
      
      toast.success("Google Calendar disconnected");
      refetchGcalStatus();
    } catch (error: any) {
      toast.error(error.message || "Failed to disconnect");
    }
  };

  // Add availability slot
  const addSlotMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("availability_slots").insert({
        day_of_week: newSlotDay,
        start_time: newSlotStart,
        end_time: newSlotEnd,
        user_id: user.user?.id,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Availability slot added");
      queryClient.invalidateQueries({ queryKey: ["availability-slots"] });
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Toggle slot active
  const toggleSlotMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("availability_slots")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["availability-slots"] });
    },
  });

  // Delete slot
  const deleteSlotMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("availability_slots")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Slot deleted");
      queryClient.invalidateQueries({ queryKey: ["availability-slots"] });
    },
  });

  // Block date
  const blockDateMutation = useMutation({
    mutationFn: async () => {
      if (!blockDate) throw new Error("Select a date");
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("blocked_dates").insert({
        date: format(blockDate, "yyyy-MM-dd"),
        reason: blockReason || null,
        created_by: user.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Date blocked");
      queryClient.invalidateQueries({ queryKey: ["blocked-dates"] });
      setBlockDate(undefined);
      setBlockReason("");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  // Unblock date
  const unblockDateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("blocked_dates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Date unblocked");
      queryClient.invalidateQueries({ queryKey: ["blocked-dates"] });
    },
  });

  // Sync discovery call to Google Calendar
  const syncToCalendarMutation = useMutation({
    mutationFn: async (callId: string) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");
      
      const response = await supabase.functions.invoke("google-calendar-sync", {
        body: { action: "create-event", callId, userId: user.user.id },
      });
      
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: () => {
      toast.success("Discovery call synced to Google Calendar!");
      queryClient.invalidateQueries({ queryKey: ["upcoming-discovery-calls"] });
    },
    onError: (error: any) => {
      toast.error(`Failed to sync: ${error.message}`);
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Discovery Call Calendar
        </CardTitle>
        <CardDescription>
          Manage your availability and booking settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="ghl-appointments">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="ghl-appointments">GHL Appointments</TabsTrigger>
            <TabsTrigger value="availability">Availability</TabsTrigger>
            <TabsTrigger value="blocked">Blocked Days</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="google">Google Calendar</TabsTrigger>
            <TabsTrigger value="embed">Embed</TabsTrigger>
          </TabsList>

          {/* GHL Appointments Tab */}
          <TabsContent value="ghl-appointments" className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">GoHighLevel Calendar Appointments</h3>
                <p className="text-sm text-muted-foreground">
                  Synced from your GHL calendars with full lead details
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetchGhlAppointments()}
                disabled={ghlLoading}
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", ghlLoading && "animate-spin")} />
                Sync Now
              </Button>
            </div>
            
            <ScrollArea className="h-[500px]">
              {ghlLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : ghlAppointments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No appointments found in GHL calendars
                </p>
              ) : (
                <div className="space-y-3">
                  {ghlAppointments.map((apt) => (
                    <Collapsible 
                      key={apt.ghl_event_id}
                      open={expandedAppointment === apt.ghl_event_id}
                      onOpenChange={(open) => setExpandedAppointment(open ? apt.ghl_event_id : null)}
                    >
                      <div className="border rounded-lg overflow-hidden">
                        <CollapsibleTrigger className="w-full p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex justify-between items-start gap-4 text-left">
                            <div className="flex-1">
                              <p className="font-semibold text-lg">
                                {apt.contact_name || apt.lead_name || "Unknown Contact"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {apt.title} • {apt.calendar_name}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={apt.status === "confirmed" ? "default" : "secondary"}>
                                {apt.status}
                              </Badge>
                              {apt.lead_id && (
                                <Badge className="bg-green-100 text-green-800">
                                  <Users className="h-3 w-3 mr-1" />
                                  Matched
                                </Badge>
                              )}
                              <div className="text-right">
                                <p className="text-sm font-medium">
                                  {format(new Date(apt.scheduled_at), "MMM d, h:mm a")}
                                </p>
                              </div>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        
                        <CollapsibleContent>
                          <div className="px-4 pb-4 pt-2 border-t bg-muted/30">
                            <div className="grid md:grid-cols-2 gap-4">
                              {/* Contact Details */}
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm flex items-center gap-1">
                                  <Users className="h-4 w-4" /> Contact Details
                                </h4>
                                {apt.contact_phone && (
                                  <p className="text-sm flex items-center gap-2">
                                    <Phone className="h-3 w-3 text-muted-foreground" />
                                    {apt.contact_phone}
                                  </p>
                                )}
                                {apt.contact_email && (
                                  <p className="text-sm flex items-center gap-2">
                                    <Mail className="h-3 w-3 text-muted-foreground" />
                                    {apt.contact_email}
                                  </p>
                                )}
                                {(apt.contact_address || apt.contact_city) && (
                                  <p className="text-sm flex items-center gap-2">
                                    <MapPin className="h-3 w-3 text-muted-foreground" />
                                    {[apt.contact_address, apt.contact_city, apt.contact_state].filter(Boolean).join(", ")}
                                  </p>
                                )}
                                {apt.contact_source && (
                                  <p className="text-sm text-muted-foreground">
                                    Source: {apt.contact_source}
                                  </p>
                                )}
                                {apt.contact_tags?.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {apt.contact_tags.map((tag, i) => (
                                      <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              
                              {/* Lead Details (if matched) */}
                              {apt.lead_id && (
                                <div className="space-y-2">
                                  <h4 className="font-medium text-sm flex items-center gap-1">
                                    <Building className="h-4 w-4" /> Lead Details
                                  </h4>
                                  {apt.lead_property_address && (
                                    <p className="text-sm">
                                      <span className="text-muted-foreground">Property:</span> {apt.lead_property_address}
                                    </p>
                                  )}
                                  {apt.lead_property_type && (
                                    <p className="text-sm">
                                      <span className="text-muted-foreground">Type:</span> {apt.lead_property_type}
                                    </p>
                                  )}
                                  {apt.lead_stage && (
                                    <Badge variant="secondary">{apt.lead_stage}</Badge>
                                  )}
                                  {apt.lead_notes && (
                                    <p className="text-sm text-muted-foreground line-clamp-2">{apt.lead_notes}</p>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {apt.notes && (
                              <div className="mt-3 pt-3 border-t">
                                <p className="text-sm"><span className="font-medium">Notes:</span> {apt.notes}</p>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Availability Tab */}
          <TabsContent value="availability" className="space-y-4 mt-4">
            <div className="flex gap-4 items-end flex-wrap">
              <div className="space-y-1">
                <Label>Day</Label>
                <Select
                  value={newSlotDay.toString()}
                  onValueChange={(v) => setNewSlotDay(parseInt(v))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day.value} value={day.value.toString()}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Start Time</Label>
                <Select value={newSlotStart} onValueChange={setNewSlotStart}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>End Time</Label>
                <Select value={newSlotEnd} onValueChange={setNewSlotEnd}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => addSlotMutation.mutate()} size="sm">
                <Plus className="h-4 w-4 mr-1" /> Add Slot
              </Button>
            </div>

            <div className="space-y-2">
              {slotsLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : availabilitySlots.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No availability slots configured. Add your first slot above.
                </p>
              ) : (
                availabilitySlots.map((slot) => (
                  <div
                    key={slot.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={slot.is_active}
                        onCheckedChange={(checked) =>
                          toggleSlotMutation.mutate({ id: slot.id, isActive: checked })
                        }
                      />
                      <span className="font-medium">
                        {DAYS_OF_WEEK.find((d) => d.value === slot.day_of_week)?.label}
                      </span>
                      <Badge variant="secondary">
                        <Clock className="h-3 w-3 mr-1" />
                        {format(new Date(`2000-01-01T${slot.start_time}`), "h:mm a")} -{" "}
                        {format(new Date(`2000-01-01T${slot.end_time}`), "h:mm a")}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteSlotMutation.mutate(slot.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* Blocked Days Tab */}
          <TabsContent value="blocked" className="space-y-4 mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">Select Date to Block</Label>
                <CalendarComponent
                  mode="single"
                  selected={blockDate}
                  onSelect={setBlockDate}
                  className={cn("rounded-md border pointer-events-auto")}
                />
                {blockDate && (
                  <div className="mt-3 space-y-2">
                    <Input
                      placeholder="Reason (optional)"
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                    />
                    <Button
                      onClick={() => blockDateMutation.mutate()}
                      className="w-full"
                      size="sm"
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      Block {format(blockDate, "MMM d, yyyy")}
                    </Button>
                  </div>
                )}
              </div>
              <div>
                <Label className="mb-2 block">Blocked Dates</Label>
                <ScrollArea className="h-64 border rounded-lg">
                  {blockedDates.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      No dates blocked
                    </p>
                  ) : (
                    <div className="p-2 space-y-2">
                      {blockedDates.map((bd) => (
                        <div
                          key={bd.id}
                          className="flex items-center justify-between p-2 bg-muted rounded"
                        >
                          <div>
                            <p className="font-medium">
                              {format(new Date(bd.date), "EEEE, MMMM d, yyyy")}
                            </p>
                            {bd.reason && (
                              <p className="text-xs text-muted-foreground">{bd.reason}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => unblockDateMutation.mutate(bd.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </TabsContent>

          {/* Upcoming Calls Tab */}
          <TabsContent value="upcoming" className="mt-4">
            <div className="mb-3 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                📅 Calendar sync is <span className="font-medium text-green-600">fully automatic</span>. New discovery calls are synced within 1 minute.
              </p>
            </div>
            <ScrollArea className="h-72">
              {upcomingCalls.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No upcoming discovery calls
                </p>
              ) : (
                <div className="space-y-3">
                  {upcomingCalls.map((call: any) => (
                    <div key={call.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <p className="font-semibold text-lg">{call.leads?.name || "Unknown"}</p>
                          <p className="text-sm text-muted-foreground">
                            {call.leads?.email} • {call.leads?.phone}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={call.meeting_type === "video" ? "default" : "secondary"}>
                            {call.meeting_type === "video" ? "📹 Video" : "📞 Phone"}
                          </Badge>
                          {call.google_calendar_event_id ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Synced
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Pending Sync
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">📅 When:</span>{" "}
                          <span className="font-medium">{format(new Date(call.scheduled_at), "MMM d 'at' h:mm a")} EST</span>
                        </div>
                        {call.leads?.property_address && (
                          <div>
                            <span className="text-muted-foreground">🏠 Property:</span>{" "}
                            <span className="font-medium">{call.leads.property_address.substring(0, 30)}...</span>
                          </div>
                        )}
                        {call.rental_strategy && (
                          <div>
                            <span className="text-muted-foreground">🏠 Strategy:</span>{" "}
                            <span className="font-medium">
                              {call.rental_strategy === "str" ? "Short-Term (STR)" : 
                               call.rental_strategy === "mtr" ? "Mid-Term (MTR)" : 
                               call.rental_strategy === "ltr" ? "Long-Term (LTR)" : call.rental_strategy}
                            </span>
                          </div>
                        )}
                        {call.current_situation && (
                          <div>
                            <span className="text-muted-foreground">📋 Situation:</span>{" "}
                            <span className="font-medium">{call.current_situation.replace(/_/g, " ")}</span>
                          </div>
                        )}
                        {call.start_timeline && (
                          <div>
                            <span className="text-muted-foreground">⏰ Timeline:</span>{" "}
                            <span className="font-medium">{call.start_timeline.replace(/_/g, " ")}</span>
                          </div>
                        )}
                      </div>
                      
                      {call.meeting_type === "video" && call.google_meet_link && (
                        <a 
                          href={call.google_meet_link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-green-600 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> Join Google Meet
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Google Calendar Tab */}
          <TabsContent value="google" className="space-y-4 mt-4">
            <div className="p-6 border rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-full ${gcalStatus?.connected ? 'bg-green-100' : 'bg-muted'}`}>
                    <Calendar className={`h-6 w-6 ${gcalStatus?.connected ? 'text-green-600' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Google Calendar</h3>
                    <p className="text-sm text-muted-foreground">
                      Sync discovery calls with your calendar
                    </p>
                  </div>
                </div>
                {gcalLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : gcalStatus?.connected ? (
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <XCircle className="h-3 w-3 mr-1" />
                    Not Connected
                  </Badge>
                )}
              </div>

              {gcalStatus?.connected && gcalStatus?.verified ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      ✓ Your Google Calendar is connected and verified.
                    </p>
                    {gcalStatus.calendarCount !== undefined && (
                      <p className="text-xs text-green-600 mt-1">
                        {gcalStatus.calendarCount} calendar(s) accessible
                      </p>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <h4 className="font-medium text-foreground mb-2">What happens when connected:</h4>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>New discovery calls are added to your Google Calendar</li>
                      <li>Automatic email reminders 24h and 1h before calls</li>
                      <li>Calendar events include lead details and property info</li>
                    </ul>
                  </div>
                  <Button variant="outline" onClick={disconnectGoogleCalendar} className="text-destructive hover:text-destructive">
                    <XCircle className="h-4 w-4 mr-2" />
                    Disconnect Google Calendar
                  </Button>
                </div>
              ) : gcalStatus?.error ? (
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      ⚠ {gcalStatus.error}
                    </p>
                  </div>
                  <Button onClick={connectGoogleCalendar} className="w-full sm:w-auto">
                    <Calendar className="h-4 w-4 mr-2" />
                    Connect Google Calendar
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    <h4 className="font-medium text-foreground mb-2">Benefits of connecting:</h4>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>Automatic calendar event creation for new bookings</li>
                      <li>Email reminders sent to you and leads</li>
                      <li>Two-way sync keeps everything up to date</li>
                      <li>Never double-book with real-time availability checks</li>
                    </ul>
                  </div>
                  <Button onClick={connectGoogleCalendar} className="w-full sm:w-auto">
                    <Calendar className="h-4 w-4 mr-2" />
                    Connect Google Calendar
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Embed Code Tab */}
          <TabsContent value="embed" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Direct Link</Label>
                <div className="flex gap-2">
                  <Input value={publicUrl} readOnly className="font-mono text-sm" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(publicUrl)}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(publicUrl, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Embed Code (iframe)</Label>
                <div className="relative">
                  <pre className="p-3 bg-muted rounded-lg text-xs overflow-x-auto">
                    {iframeCode}
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(iframeCode)}
                  >
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Paste this code into your website to embed the booking calendar.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
