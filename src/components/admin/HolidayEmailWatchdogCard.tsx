import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Mail, CheckCircle, XCircle, Clock, Eye, Send, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

interface QueuedEmail {
  id: string;
  recipient_email: string;
  recipient_name: string;
  scheduled_date: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  owner_id: string;
  property_id: string;
  template_id: string;
  holiday_email_templates: {
    holiday_name: string;
    subject_template: string;
    message_template: string;
    emoji: string;
  } | null;
  properties: {
    name: string;
    address: string;
  } | null;
}

export function HolidayEmailWatchdogCard() {
  const [previewEmail, setPreviewEmail] = useState<QueuedEmail | null>(null);
  const [sendingTest, setSendingTest] = useState(false);

  // Fetch queued emails
  const { data: queuedEmails, isLoading, refetch } = useQuery({
    queryKey: ['holiday-email-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('holiday_email_queue')
        .select(`
          id,
          recipient_email,
          recipient_name,
          scheduled_date,
          status,
          sent_at,
          error_message,
          owner_id,
          property_id,
          template_id,
          holiday_email_templates(holiday_name, subject_template, message_template, emoji),
          properties(name, address)
        `)
        .order('scheduled_date', { ascending: true })
        .limit(200);
      
      if (error) throw error;
      return data as QueuedEmail[];
    },
    refetchInterval: 30000,
  });

  // Group emails by status and date
  const pendingEmails = queuedEmails?.filter(e => e.status === 'pending') || [];
  const sentEmails = queuedEmails?.filter(e => e.status === 'sent') || [];
  const failedEmails = queuedEmails?.filter(e => e.status === 'failed') || [];

  // Group pending by holiday
  const pendingByHoliday = pendingEmails.reduce((acc, email) => {
    const holiday = email.holiday_email_templates?.holiday_name || 'Unknown';
    if (!acc[holiday]) acc[holiday] = [];
    acc[holiday].push(email);
    return acc;
  }, {} as Record<string, QueuedEmail[]>);

  const sendTestEmail = async (email: QueuedEmail) => {
    setSendingTest(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast.error("You must be logged in to send test emails");
        return;
      }

      const { error } = await supabase.functions.invoke('send-holiday-email', {
        body: {
          holidayTemplateId: email.template_id,
          testEmail: user.email,
          ownerIds: [email.owner_id],
        },
      });

      if (error) throw error;
      toast.success(`Test email sent to ${user.email}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send test email");
    } finally {
      setSendingTest(false);
    }
  };

  const personalizeContent = (template: string, email: QueuedEmail) => {
    const firstName = email.recipient_name.split(' ')[0];
    const propertyName = email.properties?.name || email.properties?.address || 'Your Property';
    return template
      .replace(/{owner_name}/g, email.recipient_name)
      .replace(/{owner_first_name}/g, firstName)
      .replace(/{property_name}/g, propertyName);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Holiday Email Automation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Holiday Email Automation
            </CardTitle>
            <div className="flex gap-2 items-center">
              <Button variant="ghost" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                {pendingEmails.length} Scheduled
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                {sentEmails.length} Sent
              </Badge>
              {failedEmails.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  {failedEmails.length} Failed
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="scheduled" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="scheduled">Scheduled ({pendingEmails.length})</TabsTrigger>
              <TabsTrigger value="sent">Sent ({sentEmails.length})</TabsTrigger>
              <TabsTrigger value="failed">Failed ({failedEmails.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="scheduled" className="mt-4">
              {Object.keys(pendingByHoliday).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No emails scheduled. Add holiday templates or new owners to auto-schedule.
                </p>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {Object.entries(pendingByHoliday).map(([holiday, emails]) => (
                      <div key={holiday} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium flex items-center gap-2">
                            <span>{emails[0]?.holiday_email_templates?.emoji}</span>
                            {holiday}
                          </h4>
                          <Badge>
                            <Calendar className="h-3 w-3 mr-1" />
                            {format(parseISO(emails[0].scheduled_date), 'MMM d, yyyy')}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          {emails.slice(0, 10).map((email) => (
                            <div key={email.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                              <div>
                                <span className="font-medium">{email.recipient_name}</span>
                                <span className="text-muted-foreground ml-2">{email.recipient_email}</span>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setPreviewEmail(email)}
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => sendTestEmail(email)}
                                  disabled={sendingTest}
                                >
                                  <Send className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                          {emails.length > 10 && (
                            <p className="text-xs text-muted-foreground pt-1">
                              +{emails.length - 10} more recipients
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="sent" className="mt-4">
              <ScrollArea className="h-[400px]">
                {sentEmails.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No emails sent yet.</p>
                ) : (
                  <div className="space-y-2">
                    {sentEmails.map((email) => (
                      <div key={email.id} className="flex items-center justify-between text-sm py-2 border-b">
                        <div>
                          <span className="font-medium">{email.recipient_name}</span>
                          <span className="text-muted-foreground ml-2">{email.recipient_email}</span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {email.holiday_email_templates?.holiday_name}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground text-xs">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          {email.sent_at && format(parseISO(email.sent_at), 'MMM d, h:mm a')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="failed" className="mt-4">
              <ScrollArea className="h-[400px]">
                {failedEmails.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No failed emails.</p>
                ) : (
                  <div className="space-y-2">
                    {failedEmails.map((email) => (
                      <div key={email.id} className="border-b py-2">
                        <div className="flex items-center justify-between text-sm">
                          <div>
                            <span className="font-medium">{email.recipient_name}</span>
                            <span className="text-muted-foreground ml-2">{email.recipient_email}</span>
                          </div>
                          <XCircle className="h-4 w-4 text-destructive" />
                        </div>
                        {email.error_message && (
                          <p className="text-xs text-destructive mt-1">{email.error_message}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              <strong>Fully automated:</strong> Emails are sent at 9:00 AM UTC on the scheduled holiday date. 
              New owners are automatically added to the queue. You'll be CC'd on all emails.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewEmail} onOpenChange={() => setPreviewEmail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{previewEmail?.holiday_email_templates?.emoji}</span>
              Email Preview: {previewEmail?.holiday_email_templates?.holiday_name}
            </DialogTitle>
          </DialogHeader>
          {previewEmail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">To:</span> {previewEmail.recipient_email}
                </div>
                <div>
                  <span className="font-medium">Scheduled:</span>{' '}
                  {format(parseISO(previewEmail.scheduled_date), 'MMMM d, yyyy')}
                </div>
              </div>
              
              <div className="border rounded-lg p-4 bg-muted/50">
                <p className="font-medium mb-2">
                  Subject: {previewEmail.holiday_email_templates && 
                    personalizeContent(previewEmail.holiday_email_templates.subject_template, previewEmail)}
                </p>
                <div className="text-sm whitespace-pre-wrap">
                  <p className="mb-2">Dear {previewEmail.recipient_name.split(' ')[0]},</p>
                  {previewEmail.holiday_email_templates && 
                    personalizeContent(previewEmail.holiday_email_templates.message_template, previewEmail)
                      .replace(/^Dear [^,\n]+,?\s*\n*/i, '')
                      .split('\n\n')
                      .map((para, i) => <p key={i} className="mb-2">{para}</p>)}
                </div>
                <p className="text-xs text-muted-foreground mt-4 italic">
                  Note: AI-generated holiday image with cozy house will be included in the actual email.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPreviewEmail(null)}>
                  Close
                </Button>
                <Button onClick={() => {
                  sendTestEmail(previewEmail);
                  setPreviewEmail(null);
                }} disabled={sendingTest}>
                  <Send className="h-4 w-4 mr-2" />
                  Send Test to Me
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
