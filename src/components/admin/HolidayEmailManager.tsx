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
  Eye,
  AlertTriangle,
  User,
  Phone,
  Home,
  Edit,
  UserPlus
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

interface PropertyWithOwner {
  id: string;
  name: string;
  address: string;
  image_path: string | null;
  owner_id: string | null;
  property_owners: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    second_owner_name: string | null;
    second_owner_email: string | null;
  } | null;
}

interface EditOwnerForm {
  name: string;
  email: string;
  phone: string;
  second_owner_name: string;
  second_owner_email: string;
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
  const [sendingToOwnerId, setSendingToOwnerId] = useState<string | null>(null);
  const [ownerSearchQuery, setOwnerSearchQuery] = useState("");
  const [ownersTabTemplateId, setOwnersTabTemplateId] = useState<string | null>(null);
  const [editingOwner, setEditingOwner] = useState<PropertyWithOwner | null>(null);
  const [editForm, setEditForm] = useState<EditOwnerForm>({
    name: "",
    email: "",
    phone: "",
    second_owner_name: "",
    second_owner_email: "",
  });
  const [isUpdatingOwner, setIsUpdatingOwner] = useState(false);

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

  // Fetch all properties with owner info
  const { data: propertiesWithOwners, isLoading: propertiesLoading } = useQuery({
    queryKey: ['properties-with-owners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          id,
          name,
          address,
          image_path,
          owner_id,
          property_owners(id, name, email, phone, second_owner_name, second_owner_email)
        `)
        .is('offboarded_at', null)
        .order('name');
      
      if (error) throw error;
      return data as PropertyWithOwner[];
    }
  });

  // Compute owner count and missing info stats
  const ownerCount = propertiesWithOwners?.filter(p => p.owner_id && p.property_owners).length || 0;
  const propertiesMissingOwner = propertiesWithOwners?.filter(p => !p.owner_id || !p.property_owners) || [];
  const propertiesMissingEmail = propertiesWithOwners?.filter(p => p.property_owners && !p.property_owners.email) || [];
  const propertiesMissingPhone = propertiesWithOwners?.filter(p => p.property_owners && !p.property_owners.phone) || [];

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

  // Send test to specific owner (always sends to test email, not owner)
  const TEST_EMAIL_ADDRESS = "ingo@peachhausgroup.com";
  
  const sendTestToOwner = async (ownerId: string, ownerName: string) => {
    if (!ownersTabTemplateId) {
      toast({ title: "Error", description: "Please select a template first", variant: "destructive" });
      return;
    }

    setSendingToOwnerId(ownerId);
    try {
      const { data, error } = await supabase.functions.invoke('send-holiday-email', {
        body: {
          holidayTemplateId: ownersTabTemplateId,
          ownerIds: [ownerId],
          testEmail: TEST_EMAIL_ADDRESS // Always send to test email, not the owner
        }
      });

      if (error) throw error;

      toast({ 
        title: "Test Email Sent! 🎉", 
        description: `Test for ${ownerName} sent to ${TEST_EMAIL_ADDRESS}` 
      });

      queryClient.invalidateQueries({ queryKey: ['holiday-email-logs'] });
    } catch (error) {
      console.error('Error sending test to owner:', error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to send test email", 
        variant: "destructive" 
      });
    } finally {
      setSendingToOwnerId(null);
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

  // Edit owner handler
  const handleEditOwner = (property: PropertyWithOwner) => {
    setEditingOwner(property);
    setEditForm({
      name: property.property_owners?.name || "",
      email: property.property_owners?.email || "",
      phone: property.property_owners?.phone || "",
      second_owner_name: property.property_owners?.second_owner_name || "",
      second_owner_email: property.property_owners?.second_owner_email || "",
    });
  };

  // Update owner mutation
  const handleUpdateOwner = async () => {
    if (!editingOwner?.property_owners?.id) return;

    setIsUpdatingOwner(true);
    try {
      const { error } = await supabase
        .from('property_owners')
        .update({
          name: editForm.name.trim(),
          email: editForm.email.trim(),
          phone: editForm.phone.trim() || null,
          second_owner_name: editForm.second_owner_name.trim() || null,
          second_owner_email: editForm.second_owner_email.trim() || null,
        })
        .eq('id', editingOwner.property_owners.id);

      if (error) throw error;

      toast({ title: "Owner Updated", description: "Owner information saved successfully" });
      setEditingOwner(null);
      queryClient.invalidateQueries({ queryKey: ['properties-with-owners'] });
    } catch (error) {
      console.error('Error updating owner:', error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to update owner", 
        variant: "destructive" 
      });
    } finally {
      setIsUpdatingOwner(false);
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
                <p className="text-sm text-muted-foreground">Properties with Owners</p>
                <p className="text-2xl font-bold">{ownerCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${propertiesMissingOwner.length > 0 ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                <AlertTriangle className={`h-5 w-5 ${propertiesMissingOwner.length > 0 ? 'text-red-500' : 'text-green-500'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Missing Owner Info</p>
                <p className="text-2xl font-bold">{propertiesMissingOwner.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendar">🗓️ Holiday Calendar</TabsTrigger>
          <TabsTrigger value="owners">👤 Owners</TabsTrigger>
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

        {/* Owners Tab */}
        <TabsContent value="owners">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Property Owners
              </CardTitle>
              <CardDescription>
                View all owners and their contact information. Send test emails to specific owners.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search, Filter and Template Selection */}
              <div className="flex flex-wrap gap-4 items-center">
                <Input
                  placeholder="Search by name, email, or property..."
                  value={ownerSearchQuery}
                  onChange={(e) => setOwnerSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
                <div className="flex items-center gap-2">
                  <Label className="text-sm whitespace-nowrap">Template:</Label>
                  <select
                    value={ownersTabTemplateId || ""}
                    onChange={(e) => setOwnersTabTemplateId(e.target.value || null)}
                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Select template...</option>
                    {templates?.filter(t => t.is_active).map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.emoji} {template.holiday_name}
                      </option>
                    ))}
                  </select>
                </div>
                {ownersTabTemplateId && (
                  <Badge variant="secondary" className="text-xs">
                    Test emails go to: ingo@peachhausgroup.com
                  </Badge>
                )}
              </div>

              {/* Missing Owner Info Alert */}
              {propertiesMissingOwner.length > 0 && (
                <div className="border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    Properties Missing Owner Assignment ({propertiesMissingOwner.length})
                  </div>
                  <div className="text-sm text-red-600 dark:text-red-400 space-y-1">
                    {propertiesMissingOwner.slice(0, 5).map(p => (
                      <div key={p.id} className="flex items-center gap-2">
                        <Home className="h-3 w-3" />
                        {p.name} - {p.address}
                      </div>
                    ))}
                    {propertiesMissingOwner.length > 5 && (
                      <div className="text-xs opacity-70">...and {propertiesMissingOwner.length - 5} more</div>
                    )}
                  </div>
                </div>
              )}

              {propertiesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Property</TableHead>
                        <TableHead>Primary Owner</TableHead>
                        <TableHead>Second Owner</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {propertiesWithOwners
                        ?.filter(p => {
                          if (!ownerSearchQuery.trim()) return true;
                          const query = ownerSearchQuery.toLowerCase();
                          return (
                            p.name.toLowerCase().includes(query) ||
                            p.address.toLowerCase().includes(query) ||
                            p.property_owners?.name?.toLowerCase().includes(query) ||
                            p.property_owners?.email?.toLowerCase().includes(query) ||
                            p.property_owners?.second_owner_name?.toLowerCase().includes(query) ||
                            p.property_owners?.second_owner_email?.toLowerCase().includes(query)
                          );
                        })
                        .map((property) => {
                          const owner = property.property_owners;
                          const hasOwner = !!owner;
                          const hasEmail = !!owner?.email;
                          const hasSecondOwner = !!owner?.second_owner_name || !!owner?.second_owner_email;
                          const isComplete = hasOwner && hasEmail;

                          return (
                            <TableRow key={property.id} className={!isComplete ? 'bg-red-50/50 dark:bg-red-950/10' : ''}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {property.image_path ? (
                                    <img 
                                      src={property.image_path} 
                                      alt={property.name}
                                      className="w-10 h-10 rounded object-cover"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                                      <Home className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div>
                                    <div className="font-medium text-sm">{property.name}</div>
                                    <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                                      {property.address}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {hasOwner ? (
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1 font-medium text-sm">
                                      <User className="h-3 w-3 text-muted-foreground" />
                                      {owner.name}
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Mail className="h-3 w-3" />
                                      {owner.email || <span className="text-orange-500">Missing</span>}
                                    </div>
                                    {owner.phone && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Phone className="h-3 w-3" />
                                        {owner.phone}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <Badge variant="destructive" className="text-xs">
                                    No Owner
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {hasSecondOwner ? (
                                  <div className="space-y-1">
                                    {owner?.second_owner_name && (
                                      <div className="flex items-center gap-1 font-medium text-sm">
                                        <UserPlus className="h-3 w-3 text-muted-foreground" />
                                        {owner.second_owner_name}
                                      </div>
                                    )}
                                    {owner?.second_owner_email && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Mail className="h-3 w-3" />
                                        {owner.second_owner_email}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {isComplete ? (
                                  <div className="space-y-1">
                                    <Badge variant="default" className="bg-green-500 text-xs">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Ready
                                    </Badge>
                                    {hasSecondOwner && (
                                      <Badge variant="secondary" className="text-xs">
                                        +1 recipient
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <Badge variant="destructive" className="text-xs">
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Incomplete
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  {hasOwner && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleEditOwner(property)}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                  )}
                                  {isComplete && ownersTabTemplateId && (
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => sendTestToOwner(owner!.id, owner!.name)}
                                      disabled={sendingToOwnerId === owner!.id}
                                    >
                                      {sendingToOwnerId === owner!.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <>
                                          <TestTube className="h-3 w-3 mr-1" />
                                          Test
                                        </>
                                      )}
                                    </Button>
                                  )}
                                  {!hasOwner && (
                                    <span className="text-xs text-muted-foreground">No owner to edit</span>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </ScrollArea>
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

      {/* Edit Owner Dialog */}
      <Dialog open={!!editingOwner} onOpenChange={(open) => !open && setEditingOwner(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Owner for {editingOwner?.name}
            </DialogTitle>
            <DialogDescription>
              Update owner contact information for holiday emails
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="border-b pb-3">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Primary Owner
              </h4>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-name">Name</Label>
                  <Input
                    id="edit-name"
                    value={editForm.name}
                    onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Owner name"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="owner@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    value={editForm.phone}
                    onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Second Owner (Optional)
              </h4>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-second-name">Name</Label>
                  <Input
                    id="edit-second-name"
                    value={editForm.second_owner_name}
                    onChange={(e) => setEditForm(f => ({ ...f, second_owner_name: e.target.value }))}
                    placeholder="Second owner name"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-second-email">Email</Label>
                  <Input
                    id="edit-second-email"
                    type="email"
                    value={editForm.second_owner_email}
                    onChange={(e) => setEditForm(f => ({ ...f, second_owner_email: e.target.value }))}
                    placeholder="second@example.com"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Second owner will receive their own personalized holiday email
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOwner(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateOwner} disabled={isUpdatingOwner || !editForm.name || !editForm.email}>
              {isUpdatingOwner ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
