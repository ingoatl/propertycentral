import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, Sparkles, Globe, Mail, Trash2, Edit, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { KnowledgeEntryModal } from "./KnowledgeEntryModal";
import { KnowledgeImportPanel } from "./KnowledgeImportPanel";

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
  created_at: string;
}

const CATEGORIES = [
  { value: "all", label: "All" },
  { value: "services", label: "Services" },
  { value: "pricing", label: "Pricing" },
  { value: "referrals", label: "Referrals" },
  { value: "company", label: "Company" },
  { value: "objections", label: "Objections" },
  { value: "scripts", label: "Scripts" },
  { value: "policies", label: "Policies" },
  { value: "networks", label: "Networks" },
  { value: "faqs", label: "FAQs" },
];

export function CompanyKnowledgeManager() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [showImportPanel, setShowImportPanel] = useState(false);
  
  const queryClient = useQueryClient();

  const { data: knowledgeEntries = [], isLoading } = useQuery({
    queryKey: ["company-knowledge", activeCategory, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("company_knowledge_base")
        .select("*")
        .order("priority", { ascending: false });

      if (activeCategory !== "all") {
        query = query.eq("category", activeCategory);
      }

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as KnowledgeEntry[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("company_knowledge_base")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-knowledge"] });
      toast.success("Knowledge entry deleted");
    },
    onError: () => {
      toast.error("Failed to delete entry");
    },
  });

  const handleEdit = (entry: KnowledgeEntry) => {
    setEditingEntry(entry);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingEntry(null);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingEntry(null);
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      services: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      pricing: "bg-green-500/10 text-green-600 border-green-500/20",
      referrals: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      company: "bg-orange-500/10 text-orange-600 border-orange-500/20",
      objections: "bg-red-500/10 text-red-600 border-red-500/20",
      scripts: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
    };
    return colors[category] || "bg-muted text-muted-foreground";
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "website_import":
        return <Globe className="h-3 w-3" />;
      case "email_analysis":
        return <Mail className="h-3 w-3" />;
      default:
        return <Sparkles className="h-3 w-3" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Company Knowledge Base</h2>
          <p className="text-muted-foreground">
            AI responses use this knowledge to generate accurate, on-brand replies
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImportPanel(!showImportPanel)}>
            <Globe className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Knowledge
          </Button>
        </div>
      </div>

      {showImportPanel && (
        <KnowledgeImportPanel onClose={() => setShowImportPanel(false)} />
      )}

      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search knowledge..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="secondary" className="text-sm">
          {knowledgeEntries.length} entries
        </Badge>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList>
          {CATEGORIES.map((cat) => (
            <TabsTrigger key={cat.value} value={cat.value}>
              {cat.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={activeCategory} className="mt-4">
          <ScrollArea className="h-[600px]">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : knowledgeEntries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No knowledge entries found. Add some to improve AI responses!
              </div>
            ) : (
              <div className="grid gap-4">
                {knowledgeEntries.map((entry) => (
                  <Card key={entry.id} className={!entry.is_active ? "opacity-50" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{entry.title}</CardTitle>
                            {entry.referral_link && (
                              <a
                                href={entry.referral_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={getCategoryColor(entry.category)}>
                              {entry.category}
                            </Badge>
                            {entry.subcategory && (
                              <Badge variant="outline" className="text-xs">
                                {entry.subcategory}
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs flex items-center gap-1">
                              {getSourceIcon(entry.source)}
                              {entry.source}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Priority: {entry.priority}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(entry)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(entry.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-sm whitespace-pre-wrap line-clamp-3">
                        {entry.content}
                      </CardDescription>
                      {entry.keywords && entry.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {entry.keywords.slice(0, 8).map((keyword, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                          {entry.keywords.length > 8 && (
                            <Badge variant="secondary" className="text-xs">
                              +{entry.keywords.length - 8} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <KnowledgeEntryModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        editingEntry={editingEntry}
      />
    </div>
  );
}
