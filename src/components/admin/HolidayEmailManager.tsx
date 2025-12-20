import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/use-toast";
import { format, parseISO, isAfter, isBefore, addYears } from "date-fns";
import { 
  Calendar, 
  Send, 
  TestTube, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Image as ImageIcon,
  Mail,
  Clock,
  Users,
  Sparkles,
  Eye
} from "lucide-react";

interface HolidayTemplate {
  id: string;
  holiday_name: string;
  holiday_date: string;
  subject_template: string;
  message_template: string;
  image_prompt_template: string;
  is_active: boolean;
  recurring: boolean;
  emoji: string | null;
}

interface EmailLog {
  id: string;
  recipient_email: string;
  status: string;
  sent_at: string;
  generated_image_url: string | null;
  holiday_email_templates: {
    holiday_name: string;
    emoji: string;
  } | null;
}

export function HolidayEmailManager() {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<HolidayTemplate | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  // Fetch holiday templates
  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['holiday-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('holiday_email_templates')
        .select('*')
        .order('holiday_date', { ascending: true });
      
      if (error) throw error;
      return data as HolidayTemplate[];
    }
  });

  // Fetch email logs
  const { data: emailLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['holiday-email-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('holiday_email_logs')
        .select(`
          *,
          holiday_email_templates(holiday_name, emoji)
        `)
        .order('sent_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as EmailLog[];
    }
  });

  // Fetch owner count
  const { data: ownerCount } = useQuery({
    queryKey: ['property-owner-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('properties')
        .select('owner_id', { count: 'exact', head: true })
        .is('offboarded_at', null)
        .not('owner_id', 'is', null);
      
      if (error) throw error;
      return count || 0;
    }
  });

  // Toggle template active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('holiday_email_templates')
        .update({ is_active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holiday-templates'] });
    }
  });

  // Send test email
  const sendTestEmail = async () => {
    if (!selectedTemplate || !testEmail) {
      toast({ title: "Error", description: "Please select a template and enter a test email", variant: "destructive" });
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-holiday-email', {
        body: {
          holidayTemplateId: selectedTemplate.id,
          testEmail: testEmail.trim()
        }
      });

      if (error) throw error;

      toast({ 
        title: "Test Email Sent! 🎉", 
        description: `Check ${testEmail} for your personalized holiday email` 
      });
    } catch (error) {
      console.error('Error sending test email:', error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to send test email", 
        variant: "destructive" 
      });
    } finally {
      setIsSending(false);
    }
  };

  // Send to all owners
  const sendToAllOwners = async () => {
    if (!selectedTemplate) return;

    setIsSending(true);
    setShowConfirmDialog(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-holiday-email', {
        body: {
          holidayTemplateId: selectedTemplate.id
        }
      });

      if (error) throw error;

      toast({ 
        title: "Holiday Emails Sent! 🎉", 
        description: `Successfully sent ${data.totalSent} emails. ${data.totalFailed} failed.` 
      });

      queryClient.invalidateQueries({ queryKey: ['holiday-email-logs'] });
    } catch (error) {
      console.error('Error sending emails:', error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to send emails", 
        variant: "destructive" 
      });
    } finally {
      setIsSending(false);
    }
  };

  // Generate preview image
  const generatePreviewImage = async () => {
    if (!selectedTemplate) return;

    setIsGeneratingPreview(true);
    setPreviewImage(null);
    setShowPreviewDialog(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-holiday-image', {
        body: {
          ownerFirstName: "Sample",
          propertyName: "Your Beautiful Property",
          promptTemplate: selectedTemplate.image_prompt_template
        }
      });

      if (error) throw error;

      setPreviewImage(data.imageUrl || data.base64Image);
    } catch (error) {
      console.error('Error generating preview:', error);
      toast({ 
        title: "Preview Generation Failed", 
        description: error instanceof Error ? error.message : "Could not generate preview image", 
        variant: "destructive" 
      });
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  // Get upcoming holidays (next 30 days)
  const upcomingHolidays = templates?.filter(t => {
    const holidayDate = parseISO(t.holiday_date);
    const now = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    return t.is_active && isAfter(holidayDate, now) && isBefore(holidayDate, thirtyDaysFromNow);
  }) || [];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Holidays</p>
                <p className="text-2xl font-bold">{templates?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Upcoming (30 days)</p>
                <p className="text-2xl font-bold">{upcomingHolidays.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Property Owners</p>
                <p className="text-2xl font-bold">{ownerCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Mail className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Emails Sent</p>
                <p className="text-2xl font-bold">{emailLogs?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendar">🗓️ Holiday Calendar</TabsTrigger>
          <TabsTrigger value="send">✉️ Send Emails</TabsTrigger>
          <TabsTrigger value="history">📋 Email History</TabsTrigger>
        </TabsList>

        {/* Holiday Calendar Tab */}
        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle>Holiday Email Schedule</CardTitle>
              <CardDescription>
                Manage which holidays are active for personalized AI-generated emails
              </CardDescription>
            </CardHeader>
            <CardContent>
              {templatesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Holiday</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Recurring</TableHead>
                      <TableHead>Active</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates?.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{template.emoji}</span>
                            <span className="font-medium">{template.holiday_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(parseISO(template.holiday_date), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {template.subject_template}
                        </TableCell>
                        <TableCell>
                          {template.recurring ? (
                            <Badge variant="secondary">Yearly</Badge>
                          ) : (
                            <Badge variant="outline">One-time</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={template.is_active}
                            onCheckedChange={(checked) => 
                              toggleActiveMutation.mutate({ id: template.id, is_active: checked })
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedTemplate(template);
                              generatePreviewImage();
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Send Emails Tab */}
        <TabsContent value="send">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Select Holiday */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Send Holiday Email
                </CardTitle>
                <CardDescription>
                  Select a holiday and send AI-generated personalized emails to owners
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Holiday</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {templates?.filter(t => t.is_active).map((template) => (
                      <Button
                        key={template.id}
                        variant={selectedTemplate?.id === template.id ? "default" : "outline"}
                        className="justify-start h-auto py-3"
                        onClick={() => setSelectedTemplate(template)}
                      >
                        <span className="text-xl mr-2">{template.emoji}</span>
                        <div className="text-left">
                          <div className="font-medium">{template.holiday_name}</div>
                          <div className="text-xs opacity-70">
                            {format(parseISO(template.holiday_date), 'MMM d')}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>

                {selectedTemplate && (
                  <>
                    <div className="border rounded-lg p-4 bg-muted/50">
                      <h4 className="font-medium mb-2">Selected: {selectedTemplate.holiday_name}</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        <strong>Subject:</strong> {selectedTemplate.subject_template}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {selectedTemplate.message_template.substring(0, 200)}...
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="testEmail">Test Email Address</Label>
                      <div className="flex gap-2">
                        <Input
                          id="testEmail"
                          type="email"
                          placeholder="your@email.com"
                          value={testEmail}
                          onChange={(e) => setTestEmail(e.target.value)}
                        />
                        <Button 
                          onClick={sendTestEmail}
                          disabled={isSending || !testEmail}
                          variant="secondary"
                        >
                          {isSending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <TestTube className="h-4 w-4 mr-1" />
                              Test
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Send a test email to verify the design before sending to all owners
                      </p>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={generatePreviewImage}
                        disabled={isGeneratingPreview}
                      >
                        {isGeneratingPreview ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <ImageIcon className="h-4 w-4 mr-1" />
                        )}
                        Preview AI Image
                      </Button>
                      
                      <Button
                        onClick={() => setShowConfirmDialog(true)}
                        disabled={isSending}
                        className="flex-1"
                      >
                        {isSending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Send className="h-4 w-4 mr-1" />
                        )}
                        Send to All Owners ({ownerCount})
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Preview Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  Email Preview
                </CardTitle>
                <CardDescription>
                  Preview how the AI-generated holiday image will look
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedTemplate ? (
                  <div className="border rounded-lg overflow-hidden">
                    {/* Email Header Mock */}
                    <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 text-center">
                      <span className="text-2xl">{selectedTemplate.emoji}</span>
                      <h3 className="text-white font-medium mt-1">PeachHaus Group</h3>
                    </div>
                    
                    {/* Image Placeholder */}
                    <div className="aspect-video bg-muted flex items-center justify-center">
                      {previewImage ? (
                        <img 
                          src={previewImage} 
                          alt="Generated holiday image" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center text-muted-foreground">
                          <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Click "Preview AI Image" to generate</p>
                        </div>
                      )}
                    </div>

                    {/* Message Preview */}
                    <div className="p-4 bg-white">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
                        {selectedTemplate.message_template
                          .replace(/{owner_name}/g, 'John Smith')
                          .replace(/{owner_first_name}/g, 'John')
                          .replace(/{property_name}/g, 'Beautiful Downtown Condo')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="border rounded-lg p-8 text-center text-muted-foreground">
                    <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Select a holiday to preview the email</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Email History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Email History</CardTitle>
              <CardDescription>
                Track all sent holiday emails and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : emailLogs?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No holiday emails sent yet</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Holiday</TableHead>
                        <TableHead>Recipient</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Sent At</TableHead>
                        <TableHead>Image</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {emailLogs?.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{log.holiday_email_templates?.emoji}</span>
                              <span>{log.holiday_email_templates?.holiday_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>{log.recipient_email}</TableCell>
                          <TableCell>
                            {log.status === 'sent' ? (
                              <Badge variant="default" className="bg-green-500">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Sent
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <XCircle className="h-3 w-3 mr-1" />
                                Failed
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {format(parseISO(log.sent_at), 'MMM d, yyyy h:mm a')}
                          </TableCell>
                          <TableCell>
                            {log.generated_image_url ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setPreviewImage(log.generated_image_url);
                                  setShowPreviewDialog(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirm Send Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Confirm Email Blast
            </DialogTitle>
            <DialogDescription>
              You're about to send personalized AI-generated holiday emails to all {ownerCount} property owners.
            </DialogDescription>
          </DialogHeader>
          
          {selectedTemplate && (
            <div className="border rounded-lg p-4 bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{selectedTemplate.emoji}</span>
                <span className="font-medium">{selectedTemplate.holiday_name}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Each owner will receive a personalized email with an AI-generated image featuring their property.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={sendToAllOwners} disabled={isSending}>
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  Send to {ownerCount} Owners
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Image Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI-Generated Holiday Image
            </DialogTitle>
          </DialogHeader>
          
          <div className="rounded-lg overflow-hidden bg-muted">
            {isGeneratingPreview ? (
              <div className="aspect-video flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-3" />
                  <p className="text-muted-foreground">Generating your personalized holiday image...</p>
                  <p className="text-xs text-muted-foreground mt-1">This may take a few seconds</p>
                </div>
              </div>
            ) : previewImage ? (
              <img 
                src={previewImage} 
                alt="Generated holiday image" 
                className="w-full h-auto"
              />
            ) : (
              <div className="aspect-video flex items-center justify-center text-muted-foreground">
                <p>Failed to generate image</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
