import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Mail, Sparkles, Edit, Eye, Send, Plus, Shield, X, Image } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EmailTemplate {
  id: string;
  stage: string;
  step_number: number;
  template_name: string;
  subject: string;
  body_content: string;
  protected_sections: string[];
  ai_enhancement_prompt: string | null;
  use_ai_enhancement: boolean;
  creativity_level: number;
  signature_type: string;
  is_active: boolean;
  header_image_url: string | null;
  created_at: string;
  updated_at: string;
}

const STAGE_OPTIONS = [
  { value: "new_lead", label: "New Lead" },
  { value: "contacted", label: "Contacted" },
  { value: "discovery_scheduled", label: "Discovery Scheduled" },
  { value: "discovery_completed", label: "Discovery Completed" },
  { value: "proposal_sent", label: "Proposal Sent" },
  { value: "negotiating", label: "Negotiating" },
  { value: "contract_sent", label: "Contract Sent" },
  { value: "contract_signed", label: "Contract Signed" },
  { value: "onboarding_form", label: "Onboarding Form" },
  { value: "insurance_requested", label: "Insurance Requested" },
  { value: "ops_handoff", label: "Ops Handoff" },
];

const AVAILABLE_VARIABLES = [
  { name: "{{name}}", description: "Lead's name" },
  { name: "{{property_address}}", description: "Property address" },
  { name: "{{email}}", description: "Lead's email" },
  { name: "{{phone}}", description: "Lead's phone" },
  { name: "{{new_str_onboarding_url}}", description: "New STR onboarding form URL" },
  { name: "{{existing_str_onboarding_url}}", description: "Existing STR onboarding form URL" },
];

const CONTEXT_VARIABLES = [
  { name: "{{engagement_greeting}}", description: "Dynamic greeting based on engagement level" },
  { name: "{{call_reference}}", description: "Reference to discovery call if available" },
  { name: "{{days_since_contact}}", description: "Days since last contact" },
  { name: "{{journey_summary}}", description: "Brief summary of their journey with PeachHaus" },
];

export function LeadEmailTemplatesManager() {
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newProtectedSection, setNewProtectedSection] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [testEmail, setTestEmail] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState<Partial<EmailTemplate>>({});
  
  const queryClient = useQueryClient();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["lead-email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_email_templates")
        .select("*")
        .order("stage")
        .order("step_number");
      
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (template: Partial<EmailTemplate> & { id: string }) => {
      const { error } = await supabase
        .from("lead_email_templates")
        .update({
          template_name: template.template_name,
          subject: template.subject,
          body_content: template.body_content,
          protected_sections: template.protected_sections,
          ai_enhancement_prompt: template.ai_enhancement_prompt,
          use_ai_enhancement: template.use_ai_enhancement,
          creativity_level: template.creativity_level,
          signature_type: template.signature_type,
          is_active: template.is_active,
          header_image_url: template.header_image_url,
        })
        .eq("id", template.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-email-templates"] });
      toast.success("Template updated successfully");
      setIsEditorOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update template: ${error.message}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (template: Partial<EmailTemplate>) => {
      const { error } = await supabase
        .from("lead_email_templates")
        .insert({
          stage: template.stage,
          step_number: template.step_number || 1,
          template_name: template.template_name,
          subject: template.subject,
          body_content: template.body_content,
          protected_sections: template.protected_sections || [],
          ai_enhancement_prompt: template.ai_enhancement_prompt,
          use_ai_enhancement: template.use_ai_enhancement ?? true,
          creativity_level: template.creativity_level ?? 50,
          signature_type: template.signature_type || "ingo",
          is_active: template.is_active ?? true,
          header_image_url: template.header_image_url,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-email-templates"] });
      toast.success("Template created successfully");
      setIsEditorOpen(false);
      setIsCreating(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create template: ${error.message}`);
    },
  });

  const sendTestMutation = useMutation({
    mutationFn: async ({ templateId, email }: { templateId: string; email: string }) => {
      const { data, error } = await supabase.functions.invoke("send-test-template-email", {
        body: { templateId, testEmail: email },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Test email sent successfully!");
      setTestEmail("");
    },
    onError: (error: Error) => {
      toast.error(`Failed to send test email: ${error.message}`);
    },
  });

  const openEditor = (template: EmailTemplate | null, creating = false) => {
    setIsCreating(creating);
    if (template) {
      setSelectedTemplate(template);
      setFormData({
        ...template,
        protected_sections: template.protected_sections || [],
      });
    } else {
      setSelectedTemplate(null);
      setFormData({
        stage: "new_lead",
        step_number: 1,
        template_name: "",
        subject: "",
        body_content: "",
        protected_sections: [],
        ai_enhancement_prompt: "",
        use_ai_enhancement: true,
        creativity_level: 50,
        signature_type: "ingo",
        is_active: true,
        header_image_url: null,
      });
    }
    setIsEditorOpen(true);
  };

  const handleSave = () => {
    if (isCreating) {
      createMutation.mutate(formData);
    } else if (selectedTemplate) {
      updateMutation.mutate({ ...formData, id: selectedTemplate.id } as EmailTemplate);
    }
  };

  const addProtectedSection = () => {
    if (newProtectedSection.trim()) {
      setFormData({
        ...formData,
        protected_sections: [...(formData.protected_sections || []), newProtectedSection.trim()],
      });
      setNewProtectedSection("");
    }
  };

  const removeProtectedSection = (index: number) => {
    setFormData({
      ...formData,
      protected_sections: (formData.protected_sections || []).filter((_, i) => i !== index),
    });
  };

  const insertVariable = (variable: string) => {
    setFormData({
      ...formData,
      body_content: (formData.body_content || "") + variable,
    });
  };

  const handleSendTest = () => {
    if (!testEmail || !selectedTemplate) return;
    setIsSendingTest(true);
    sendTestMutation.mutate(
      { templateId: selectedTemplate.id, email: testEmail },
      { onSettled: () => setIsSendingTest(false) }
    );
  };

  const filteredTemplates = templates?.filter(
    (t) => stageFilter === "all" || t.stage === stageFilter
  );

  const getStageLabel = (stage: string) => {
    return STAGE_OPTIONS.find((s) => s.value === stage)?.label || stage;
  };

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader className="bg-gradient-subtle rounded-t-lg">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Lead Email Templates
            </CardTitle>
            <CardDescription>
              Manage email content with AI-safe enhancement and protected sections
            </CardDescription>
          </div>
          <Button onClick={() => openEditor(null, true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New Template
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Stage Filter */}
        <div className="mb-4">
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {STAGE_OPTIONS.map((stage) => (
                <SelectItem key={stage.value} value={stage.value}>
                  {stage.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Template List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading templates...</div>
        ) : filteredTemplates?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No templates found. Create your first template to get started.
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredTemplates?.map((template) => (
              <Card key={template.id} className={`border ${!template.is_active ? "opacity-60" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{template.template_name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {getStageLabel(template.stage)}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Step {template.step_number}
                        </Badge>
                        {template.use_ai_enhancement && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Sparkles className="w-3 h-3" />
                            AI Enhanced
                          </Badge>
                        )}
                        {template.header_image_url && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Image className="w-3 h-3" />
                            Has Image
                          </Badge>
                        )}
                        {!template.is_active && (
                          <Badge variant="destructive" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Subject: {template.subject}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last updated: {new Date(template.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedTemplate(template);
                          setIsPreviewOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditor(template)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

      {/* Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {isCreating ? "Create Email Template" : "Edit Email Template"}
            </DialogTitle>
            <DialogDescription>
              Configure email content, protected sections, and AI enhancement settings
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input
                    value={formData.template_name || ""}
                    onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
                    placeholder="e.g., Welcome Email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stage</Label>
                  <Select
                    value={formData.stage}
                    onValueChange={(value) => setFormData({ ...formData, stage: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGE_OPTIONS.map((stage) => (
                        <SelectItem key={stage.value} value={stage.value}>
                          {stage.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Step Number</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.step_number || 1}
                    onChange={(e) => setFormData({ ...formData, step_number: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Signature</Label>
                  <Select
                    value={formData.signature_type}
                    onValueChange={(value) => setFormData({ ...formData, signature_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select signature" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ingo">Ingo</SelectItem>
                      <SelectItem value="anja">Anja</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Header Image */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Image className="w-4 h-4 text-primary" />
                  <Label>Header Image (Optional)</Label>
                </div>
                <Input
                  value={formData.header_image_url || ""}
                  onChange={(e) => setFormData({ ...formData, header_image_url: e.target.value || null })}
                  placeholder="https://example.com/image.gif"
                />
                <p className="text-xs text-muted-foreground">
                  Add a GIF or image URL to display at the top of the email (great for celebratory emails)
                </p>
                {formData.header_image_url && (
                  <div className="mt-2 p-2 bg-muted rounded-lg">
                    <img 
                      src={formData.header_image_url} 
                      alt="Header preview" 
                      className="max-h-24 mx-auto rounded"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                )}
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <Label>Subject Line</Label>
                <Input
                  value={formData.subject || ""}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Email subject..."
                />
              </div>

              {/* Body Content */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Email Body</Label>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  <span className="text-xs text-muted-foreground mr-2">Lead Variables:</span>
                  {AVAILABLE_VARIABLES.map((v) => (
                    <Button
                      key={v.name}
                      variant="outline"
                      size="sm"
                      className="text-xs h-6"
                      onClick={() => insertVariable(v.name)}
                      title={v.description}
                    >
                      {v.name}
                    </Button>
                  ))}
                </div>
                {formData.use_ai_enhancement && (
                  <div className="flex flex-wrap gap-1 mb-2 p-2 bg-primary/5 rounded">
                    <span className="text-xs text-muted-foreground mr-2 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Context Variables (AI-generated):
                    </span>
                    {CONTEXT_VARIABLES.map((v) => (
                      <Button
                        key={v.name}
                        variant="ghost"
                        size="sm"
                        className="text-xs h-6 bg-primary/10"
                        onClick={() => insertVariable(v.name)}
                        title={v.description}
                      >
                        {v.name}
                      </Button>
                    ))}
                  </div>
                )}
                <Textarea
                  value={formData.body_content || ""}
                  onChange={(e) => setFormData({ ...formData, body_content: e.target.value })}
                  placeholder="Email content..."
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>

              {/* Protected Sections */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <Label>Protected Sections (AI Cannot Modify)</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add text that AI must keep exactly as written (URLs, legal requirements, specific instructions)
                </p>
                <div className="flex gap-2">
                  <Input
                    value={newProtectedSection}
                    onChange={(e) => setNewProtectedSection(e.target.value)}
                    placeholder="Add protected text..."
                    onKeyDown={(e) => e.key === "Enter" && addProtectedSection()}
                  />
                  <Button onClick={addProtectedSection} variant="outline">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(formData.protected_sections || []).map((section, index) => (
                    <Badge key={index} variant="secondary" className="gap-1 pr-1">
                      <span className="max-w-[200px] truncate">{section}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-transparent"
                        onClick={() => removeProtectedSection(index)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* AI Enhancement Settings */}
              <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <Label>AI Enhancement</Label>
                  </div>
                  <Switch
                    checked={formData.use_ai_enhancement}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, use_ai_enhancement: checked })
                    }
                  />
                </div>

                {formData.use_ai_enhancement && (
                  <>
                    <div className="space-y-2">
                      <Label>AI Enhancement Prompt</Label>
                      <Textarea
                        value={formData.ai_enhancement_prompt || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, ai_enhancement_prompt: e.target.value })
                        }
                        placeholder="Instructions for AI personalization..."
                        className="min-h-[80px]"
                      />
                      <p className="text-xs text-muted-foreground">
                        Tell AI how to personalize the email while keeping protected sections intact
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Creativity Level</Label>
                        <span className="text-sm text-muted-foreground">
                          {formData.creativity_level}%
                        </span>
                      </div>
                      <Slider
                        value={[formData.creativity_level || 50]}
                        onValueChange={([value]) =>
                          setFormData({ ...formData, creativity_level: value })
                        }
                        min={0}
                        max={100}
                        step={10}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Conservative</span>
                        <span>Expressive</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between">
                <Label>Template Active</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
              </div>

              {/* Test Email */}
              {!isCreating && selectedTemplate && (
                <div className="space-y-2 p-4 border rounded-lg">
                  <Label>Send Test Email</Label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="Enter your email..."
                    />
                    <Button
                      onClick={handleSendTest}
                      disabled={!testEmail || isSendingTest}
                      className="gap-2"
                    >
                      <Send className="w-4 h-4" />
                      {isSendingTest ? "Sending..." : "Send Test"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending || createMutation.isPending}
            >
              {updateMutation.isPending || createMutation.isPending ? "Saving..." : "Save Template"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              Preview of "{selectedTemplate?.template_name}"
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1">
            {selectedTemplate && (
              <div className="space-y-4 py-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Subject:</p>
                  <p className="font-medium">{selectedTemplate.subject}</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <pre className="whitespace-pre-wrap font-sans text-sm">
                    {selectedTemplate.body_content}
                  </pre>
                  
                  <div className="mt-6 pt-4 border-t">
                    <p className="text-sm text-muted-foreground italic">
                      [Signature: {selectedTemplate.signature_type}]
                    </p>
                  </div>
                </div>

                {(selectedTemplate.protected_sections || []).length > 0 && (
                  <div className="p-4 bg-primary/5 rounded-lg">
                    <p className="text-sm font-medium flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4" />
                      Protected Sections:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {(selectedTemplate.protected_sections || []).map((section, i) => (
                        <li key={i} className="truncate">• {section}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
