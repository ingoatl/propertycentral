import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Calendar, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Send, Play } from "lucide-react";
import { format, subDays, isToday, parseISO } from "date-fns";
import { toast } from "sonner";

interface HolidayLog {
  id: string;
  sent_at: string;
  status: string;
  recipient_email: string;
  holiday_template_id: string;
  generated_image_url: string | null;
  error_message: string | null;
  holiday_email_templates?: {
    holiday_name: string;
    holiday_date: string;
  };
}

interface UpcomingHoliday {
  id: string;
  holiday_name: string;
  holiday_date: string;
  is_active: boolean;
}

export function HolidayEmailWatchdogCard() {
  const [recentLogs, setRecentLogs] = useState<HolidayLog[]>([]);
  const [upcomingHolidays, setUpcomingHolidays] = useState<UpcomingHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [triggeringScheduler, setTriggeringScheduler] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch recent logs (last 7 days)
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();
      const { data: logs } = await supabase
        .from("holiday_email_logs")
        .select(`
          *,
          holiday_email_templates(holiday_name, holiday_date)
        `)
        .gte("sent_at", sevenDaysAgo)
        .order("sent_at", { ascending: false })
        .limit(20);

      setRecentLogs(logs || []);

      // Fetch upcoming holidays (next 30 days)
      const today = new Date().toISOString().split("T")[0];
      const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      
      const { data: holidays } = await supabase
        .from("holiday_email_templates")
        .select("id, holiday_name, holiday_date, is_active")
        .gte("holiday_date", today)
        .lte("holiday_date", thirtyDaysOut)
        .eq("is_active", true)
        .order("holiday_date", { ascending: true });

      setUpcomingHolidays(holidays || []);
    } catch (error) {
      console.error("Error fetching holiday data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const triggerScheduler = async () => {
    setTriggeringScheduler(true);
    try {
      const { data, error } = await supabase.functions.invoke("schedule-holiday-emails");
      
      if (error) throw error;
      
      toast.success(`Scheduler check complete: ${data.message}`);
      fetchData();
    } catch (error) {
      console.error("Scheduler error:", error);
      toast.error("Failed to trigger scheduler");
    } finally {
      setTriggeringScheduler(false);
    }
  };

  const sendTestEmail = async () => {
    // Find the nearest holiday template
    if (upcomingHolidays.length === 0) {
      toast.error("No upcoming holidays configured");
      return;
    }

    setTesting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("email").eq("id", user?.id).single();

      const { data, error } = await supabase.functions.invoke("send-holiday-email", {
        body: {
          holidayTemplateId: upcomingHolidays[0].id,
          testEmail: profile?.email || user?.email,
        },
      });

      if (error) throw error;
      
      toast.success("Test email sent to your inbox");
      fetchData();
    } catch (error) {
      console.error("Test email error:", error);
      toast.error("Failed to send test email");
    } finally {
      setTesting(false);
    }
  };

  const successCount = recentLogs.filter((l) => l.status === "sent").length;
  const failCount = recentLogs.filter((l) => l.status === "error").length;
  const hasImages = recentLogs.filter((l) => l.generated_image_url).length;

  const getHealthStatus = () => {
    if (failCount > successCount) return { color: "destructive", label: "Unhealthy", icon: XCircle };
    if (failCount > 0) return { color: "warning" as const, label: "Degraded", icon: AlertTriangle };
    if (successCount === 0 && recentLogs.length === 0) return { color: "secondary", label: "No Activity", icon: Mail };
    return { color: "default" as const, label: "Healthy", icon: CheckCircle2 };
  };

  const health = getHealthStatus();
  const HealthIcon = health.icon;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Holiday Email Watchdog</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={health.color as any} className="flex items-center gap-1">
            <HealthIcon className="h-3 w-3" />
            {health.label}
          </Badge>
          <Button variant="ghost" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="rounded-lg bg-muted p-3">
            <div className="text-2xl font-bold text-green-600">{successCount}</div>
            <div className="text-xs text-muted-foreground">Sent (7d)</div>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <div className="text-2xl font-bold text-red-600">{failCount}</div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <div className="text-2xl font-bold text-blue-600">{hasImages}</div>
            <div className="text-xs text-muted-foreground">With Images</div>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <div className="text-2xl font-bold text-purple-600">{upcomingHolidays.length}</div>
            <div className="text-xs text-muted-foreground">Upcoming</div>
          </div>
        </div>

        {/* Upcoming Holidays */}
        {upcomingHolidays.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Upcoming Holidays
            </h4>
            <div className="space-y-1">
              {upcomingHolidays.slice(0, 3).map((holiday) => {
                const holidayDate = parseISO(holiday.holiday_date);
                const isHolidayToday = isToday(holidayDate);
                return (
                  <div
                    key={holiday.id}
                    className={`flex justify-between items-center text-sm px-3 py-2 rounded ${
                      isHolidayToday ? "bg-yellow-100 dark:bg-yellow-900/30" : "bg-muted"
                    }`}
                  >
                    <span className="font-medium">{holiday.holiday_name}</span>
                    <span className={isHolidayToday ? "font-bold text-yellow-700" : "text-muted-foreground"}>
                      {isHolidayToday ? "TODAY!" : format(holidayDate, "MMM d, yyyy")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Sends */}
        {recentLogs.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Recent Activity</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {recentLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex justify-between items-center text-xs px-2 py-1 bg-muted rounded">
                  <div className="flex items-center gap-2">
                    {log.status === "sent" ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-600" />
                    )}
                    <span className="truncate max-w-[150px]">{log.recipient_email}</span>
                  </div>
                  <span className="text-muted-foreground">{format(parseISO(log.sent_at), "MMM d, h:mm a")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={triggerScheduler}
            disabled={triggeringScheduler}
            className="flex-1"
          >
            <Play className={`h-4 w-4 mr-1 ${triggeringScheduler ? "animate-spin" : ""}`} />
            Run Scheduler
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={sendTestEmail}
            disabled={testing || upcomingHolidays.length === 0}
            className="flex-1"
          >
            <Send className={`h-4 w-4 mr-1 ${testing ? "animate-spin" : ""}`} />
            Test Email
          </Button>
        </div>

        {/* Automation Info */}
        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
          <strong>Automation:</strong> Runs daily at 9:00 AM UTC. On holiday dates, sends personalized AI-generated images to all property owners.
        </div>
      </CardContent>
    </Card>
  );
}
