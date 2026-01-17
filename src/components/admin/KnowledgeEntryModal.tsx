import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { toast } from "sonner";

interface KnowledgeEntry {
  id: string;
  category: string;
  subcategory: string | null;
  title: string;
  content: string;
  keywords: string[];
  use_in_contexts: string[];
  priority: number;
  is_active: boolean;
  referral_link: string | null;
  source: string;
}

interface KnowledgeEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingEntry: KnowledgeEntry | null;
}

const CATEGORIES = [
  { value: "services", label: "Services" },
  { value: "pricing", label: "Pricing" },
  { value: "referrals", label: "Referrals" },
  { value: "company", label: "Company" },
  { value: "objections", label: "Objections" },
  { value: "scripts", label: "Scripts" },
];

export function KnowledgeEntryModal({
  isOpen,
  onClose,
  editingEntry,
}: KnowledgeEntryModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    category: "services",
    subcategory: "",
    title: "",
    content: "",
    keywords: [] as string[],
    use_in_contexts: ["all"] as string[],
    priority: 50,
    is_active: true,
    referral_link: "",
  });
  const [keywordInput, setKeywordInput] = useState("");

  useEffect(() => {
    if (editingEntry) {
      setFormData({
        category: editingEntry.category,
        subcategory: editingEntry.subcategory || "",
        title: editingEntry.title,
        content: editingEntry.content,
        keywords: editingEntry.keywords || [],
        use_in_contexts: editingEntry.use_in_contexts || ["all"],
        priority: editingEntry.priority,
        is_active: editingEntry.is_active,
        referral_link: editingEntry.referral_link || "",
      });
    } else {
      setFormData({
        category: "services",
        subcategory: "",
        title: "",
        content: "",
        keywords: [],
        use_in_contexts: ["all"],
        priority: 50,
        is_active: true,
        referral_link: "",
      });
    }
  }, [editingEntry, isOpen]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const payload = {
        ...formData,
        subcategory: formData.subcategory || null,
        referral_link: formData.referral_link || null,
        source: editingEntry?.source || "manual",
        created_by: user?.id,
      };

      if (editingEntry) {
        const { error } = await supabase
          .from("company_knowledge_base")
          .update(payload)
          .eq("id", editingEntry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("company_knowledge_base")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-knowledge"] });
      toast.success(editingEntry ? "Knowledge updated" : "Knowledge added");
      onClose();
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  const handleAddKeyword = () => {
    if (keywordInput.trim() && !formData.keywords.includes(keywordInput.trim().toLowerCase())) {
      setFormData((prev) => ({
        ...prev,
        keywords: [...prev.keywords, keywordInput.trim().toLowerCase()],
      }));
      setKeywordInput("");
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setFormData((prev) => ({
      ...prev,
      keywords: prev.keywords.filter((k) => k !== keyword),
    }));
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddKeyword();
    }
  };

  const toggleContext = (context: string) => {
    setFormData((prev) => {
      if (context === "all") {
        return { ...prev, use_in_contexts: ["all"] };
      }
      const newContexts = prev.use_in_contexts.filter((c) => c !== "all");
      if (newContexts.includes(context)) {
        return { ...prev, use_in_contexts: newContexts.filter((c) => c !== context) };
      }
      return { ...prev, use_in_contexts: [...newContexts, context] };
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingEntry ? "Edit Knowledge Entry" : "Add Knowledge Entry"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, category: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subcategory">Subcategory (optional)</Label>
              <Input
                id="subcategory"
                value={formData.subcategory}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, subcategory: e.target.value }))
                }
                placeholder="e.g., mid-term, fees"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="e.g., Management Fees"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, content: e.target.value }))
              }
              placeholder="The knowledge content that AI will use..."
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="referral_link">Referral Link (optional)</Label>
            <Input
              id="referral_link"
              type="url"
              value={formData.referral_link}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, referral_link: e.target.value }))
              }
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label>Keywords (for matching)</Label>
            <div className="flex gap-2">
              <Input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={handleKeywordKeyDown}
                placeholder="Type and press Enter"
              />
              <Button type="button" variant="outline" onClick={handleAddKeyword}>
                Add
              </Button>
            </div>
            {formData.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {formData.keywords.map((keyword) => (
                  <Badge key={keyword} variant="secondary" className="gap-1">
                    {keyword}
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(keyword)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Use in Contexts</Label>
            <div className="flex gap-2">
              {["all", "email", "sms"].map((context) => (
                <Button
                  key={context}
                  type="button"
                  variant={formData.use_in_contexts.includes(context) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleContext(context)}
                >
                  {context.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Priority: {formData.priority}</Label>
            <Slider
              value={[formData.priority]}
              onValueChange={([value]) =>
                setFormData((prev) => ({ ...prev, priority: value }))
              }
              min={1}
              max={100}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              Higher priority = more likely to be included in AI context
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, is_active: checked }))
              }
            />
            <Label htmlFor="is_active">Active</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!formData.title || !formData.content || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : editingEntry ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
