import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/use-toast";
import { format, parseISO, differenceInDays, isPast, isFuture, isToday } from "date-fns";
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Loader2,
  Send,
  RefreshCw,
  Mail
} from "lucide-react";
import { useState } from "react";

interface HolidayTemplate {
  id: string;
  holiday_name: string;
  holiday_date: string;
  is_active: boolean;
  emoji: string | null;
}

interface EmailLog {
  id: string;
  recipient_email: string;
  status: string;
  sent_at: string;
  holiday_template_id: string;
}

export function HolidayEmailWatchdog() {
  const [isRunningScheduler, setIsRunningScheduler] = useState(false);

  // Fetch holiday templates
  const { data: templates, isLoading: templatesLoading, refetch: refetchTemplates } = useQuery({
    queryKey: ['holiday-templates-watchdog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('holiday_email_templates')
        .select('id, holiday_name, holiday_date, is_active, emoji')
        .order('holiday_date', { ascending: true });
      
      if (error) throw error;
      return data as HolidayTemplate[];
    }
  });

  // Fetch recent email logs
  const { data: recentLogs, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['holiday-email-logs-watchdog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('holiday_email_logs')
        .select('id, recipient_email, status, sent_at, holiday_template_id')
        .order('sent_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as EmailLog[];
    }
  });

  // Calculate upcoming holidays (next 30 days)
  const upcomingHolidays = templates?.filter(t => {
    if (!t.is_active) return false;
    const holidayDate = parseISO(t.holiday_date);
    const daysUntil = differenceInDays(holidayDate, new Date());
    // Check if this year's date or next occurrence for recurring
    return daysUntil >= 0 && daysUntil <= 30;
  }) || [];

  // Calculate stats
  const totalActive = templates?.filter(t => t.is_active).length || 0;
  const todayStr = new Date().toISOString().split('T')[0];
  const emailsSentToday = recentLogs?.filter(l => l.sent_at.startsWith(todayStr)).length || 0;
  const failedRecently = recentLogs?.filter(l => l.status === 'failed').length || 0;

  // Get holiday name from template id
  const getHolidayName = (templateId: string) => {
    const template = templates?.find(t => t.id === templateId);
    return template ? `${template.emoji || ''} ${template.holiday_name}` : 'Unknown';
  };

  // Run scheduler manually
  const runScheduler = async () => {
    setIsRunningScheduler(true);
    try {
      const { data, error } = await supabase.functions.invoke('schedule-holiday-emails');
      
      if (error) throw error;

      toast({
        title: "Scheduler Run Complete",
        description: data.message || "Holiday email scheduler executed successfully",
      });

      refetchLogs();
      refetchTemplates();
    } catch (error) {
      console.error('Error running scheduler:', error);
      toast({
        title: "Scheduler Error",
        description: error instanceof Error ? error.message : "Failed to run scheduler",
        variant: "destructive"
      });
    } finally {
      setIsRunningScheduler(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Sent</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getDaysUntilBadge = (holidayDate: string) => {
    const date = parseISO(holidayDate);
    const days = differenceInDays(date, new Date());
    
    if (isToday(date)) {
      return <Badge className="bg-primary animate-pulse">Today!</Badge>;
    }
    if (days === 1) {
      return <Badge className="bg-orange-500">Tomorrow</Badge>;
    }
    if (days <= 7) {
      return <Badge className="bg-yellow-500">{days} days</Badge>;
    }
    return <Badge variant="outline">{days} days</Badge>;
  };

  if (templatesLoading || logsLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Holiday Email Watchdog
          </CardTitle>
          <CardDescription>
            Automated holiday email scheduling runs daily at 9 AM EST
          </CardDescription>
        </div>
        <Button 
          onClick={runScheduler} 
          disabled={isRunningScheduler}
          variant="outline"
          size="sm"
        >
          {isRunningScheduler ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Run Now
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold">{totalActive}</div>
            <div className="text-xs text-muted-foreground">Active Holidays</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold">{upcomingHolidays.length}</div>
            <div className="text-xs text-muted-foreground">Next 30 Days</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-green-600">{emailsSentToday}</div>
            <div className="text-xs text-muted-foreground">Sent Today</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className={`text-2xl font-bold ${failedRecently > 0 ? 'text-red-600' : ''}`}>
              {failedRecently}
            </div>
            <div className="text-xs text-muted-foreground">Recent Failures</div>
          </div>
        </div>

        {/* Upcoming Holidays */}
        {upcomingHolidays.length > 0 && (
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Upcoming Holidays
            </h4>
            <div className="space-y-2">
              {upcomingHolidays.slice(0, 5).map(holiday => (
                <div 
                  key={holiday.id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                >
                  <span>
                    {holiday.emoji} {holiday.holiday_name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {format(parseISO(holiday.holiday_date), 'MMM d')}
                    </span>
                    {getDaysUntilBadge(holiday.holiday_date)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent Activity
          </h4>
          {recentLogs && recentLogs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Holiday</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLogs.slice(0, 10).map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">
                      {getHolidayName(log.holiday_template_id)}
                    </TableCell>
                    <TableCell className="text-sm">{log.recipient_email}</TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(parseISO(log.sent_at), 'MMM d, h:mm a')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              No emails sent yet
            </div>
          )}
        </div>

        {/* Warnings */}
        {failedRecently > 0 && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">
              {failedRecently} email(s) failed recently. Check the logs for details.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
