import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Save, RotateCcw } from "lucide-react";

interface EmailPrompt {
  id: string;
  email_type: string;
  prompt_content: string;
  updated_at: string;
}

export function EmailAIPromptsManager() {
  const [prompts, setPrompts] = useState<EmailPrompt[]>([]);
  const [selectedType, setSelectedType] = useState<string>("performance");
  const [editedContent, setEditedContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPrompts();
  }, []);

  useEffect(() => {
    const selected = prompts.find(p => p.email_type === selectedType);
    if (selected) {
      setEditedContent(selected.prompt_content);
    }
  }, [selectedType, prompts]);

  const loadPrompts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("email_ai_prompts")
        .select("*")
        .order("email_type");

      if (error) throw error;
      setPrompts(data || []);
      
      if (data && data.length > 0) {
        setEditedContent(data[0].prompt_content);
      }
    } catch (error: any) {
      console.error("Error loading prompts:", error);
      toast.error("Failed to load email prompts");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from("email_ai_prompts")
        .update({ prompt_content: editedContent })
        .eq("email_type", selectedType);

      if (error) throw error;

      toast.success("Email prompt updated successfully");
      await loadPrompts();
    } catch (error: any) {
      console.error("Error saving prompt:", error);
      toast.error("Failed to save email prompt");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const selected = prompts.find(p => p.email_type === selectedType);
    if (selected) {
      setEditedContent(selected.prompt_content);
      toast.info("Changes reset");
    }
  };

  const emailTypeLabels: Record<string, string> = {
    performance: "Performance Email",
    owner_statement: "Owner Statement Email"
  };

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader className="bg-gradient-subtle rounded-t-lg">
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          AI Email Prompts
        </CardTitle>
        <CardDescription>
          Customize the AI prompts used to generate email content for each email type
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email-type">Email Type</Label>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger id="email-type">
              <SelectValue placeholder="Select email type" />
            </SelectTrigger>
            <SelectContent>
              {prompts.map((prompt) => (
                <SelectItem key={prompt.email_type} value={prompt.email_type}>
                  {emailTypeLabels[prompt.email_type] || prompt.email_type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Last updated: {prompts.find(p => p.email_type === selectedType)?.updated_at 
              ? new Date(prompts.find(p => p.email_type === selectedType)!.updated_at).toLocaleString()
              : "Never"}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt-content">Prompt Content</Label>
          <Textarea
            id="prompt-content"
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="min-h-[400px] font-mono text-sm"
            placeholder="Enter the AI prompt for generating email content..."
          />
          <p className="text-sm text-muted-foreground">
            This prompt will be used by the AI to generate email content. Be specific about the style, tone, and structure you want.
          </p>
        </div>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving || loading} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Prompt"}
          </Button>
          <Button onClick={handleReset} variant="outline" disabled={loading} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Reset Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
