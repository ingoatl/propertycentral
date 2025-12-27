import { useState } from "react";
import { Calendar, Clock, Plus, Trash2, Ban, ExternalLink, Copy, Check, Link2 } from "lucide-react";
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

export function CalendarAdminPanel() {
  const [newSlotDay, setNewSlotDay] = useState<number>(1);
  const [newSlotStart, setNewSlotStart] = useState("09:00");
  const [newSlotEnd, setNewSlotEnd] = useState("17:00");
  const [blockDate, setBlockDate] = useState<Date | undefined>();
  const [blockReason, setBlockReason] = useState("");
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  // Use the actual frontend URL, not the Supabase URL
  const frontendUrl = window.location.origin;
  const embedUrl = `${frontendUrl}/book-discovery-call`;
  const iframeCode = `<iframe src="${embedUrl}" width="100%" height="800" frameborder="0" style="border-radius: 12px;"></iframe>`;

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

  // Fetch upcoming discovery calls
  const { data: upcomingCalls = [] } = useQuery({
    queryKey: ["upcoming-discovery-calls"],
    queryFn: async () => {
      const { data } = await supabase
        .from("discovery_calls")
        .select("*, leads(name, email, phone)")
        .eq("status", "scheduled")
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at")
        .limit(10);
      return data || [];
    },
  });

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
        <Tabs defaultValue="availability">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="availability">Availability</TabsTrigger>
            <TabsTrigger value="blocked">Blocked Days</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="embed">Embed Code</TabsTrigger>
          </TabsList>

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
            <ScrollArea className="h-64">
              {upcomingCalls.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No upcoming discovery calls
                </p>
              ) : (
                <div className="space-y-2">
                  {upcomingCalls.map((call: any) => (
                    <div key={call.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{call.leads?.name || "Unknown"}</p>
                          <p className="text-sm text-muted-foreground">
                            {call.leads?.email} • {call.leads?.phone}
                          </p>
                        </div>
                        <Badge>
                          {format(new Date(call.scheduled_at), "MMM d 'at' h:mm a")}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Embed Code Tab */}
          <TabsContent value="embed" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Direct Link</Label>
                <div className="flex gap-2">
                  <Input value={embedUrl} readOnly className="font-mono text-sm" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(embedUrl)}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(embedUrl, "_blank")}
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
                  Paste this code into your Lovable project or any website to embed the
                  booking calendar.
                </p>
              </div>

              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <h4 className="font-medium flex items-center gap-2 mb-2">
                  <Link2 className="h-4 w-4" />
                  Google Calendar Integration
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Connect your Google Calendar for two-way sync and automatic reminders.
                </p>
                <Button variant="outline" size="sm" disabled>
                  Connect Google Calendar (Coming Soon)
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
