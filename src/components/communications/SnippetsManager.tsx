import { useState } from "react";
import { Plus, Search, Trash2, Edit2, Copy, Tag, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSnippets, Snippet } from "@/hooks/useSnippets";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "greeting", label: "Greetings" },
  { value: "closing", label: "Closings" },
  { value: "follow-up", label: "Follow-ups" },
  { value: "scheduling", label: "Scheduling" },
  { value: "property", label: "Property Info" },
  { value: "general", label: "General" },
];

interface SnippetFormProps {
  snippet?: Snippet;
  onSave: (data: { name: string; shortcut: string; content: string; category: string }) => void;
  onCancel: () => void;
}

function SnippetForm({ snippet, onSave, onCancel }: SnippetFormProps) {
  const [name, setName] = useState(snippet?.name || "");
  const [shortcut, setShortcut] = useState(snippet?.shortcut || "");
  const [content, setContent] = useState(snippet?.content || "");
  const [category, setCategory] = useState(snippet?.category || "general");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !shortcut.trim() || !content.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    onSave({ name, shortcut, content, category });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Quick follow-up"
        />
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Shortcut</label>
        <div className="flex items-center gap-2">
          <Input
            value={shortcut}
            onChange={(e) => setShortcut(e.target.value)}
            placeholder="e.g., /followup"
            className="font-mono"
          />
          <Badge variant="outline" className="shrink-0">
            <Zap className="h-3 w-3 mr-1" />
            Type to expand
          </Badge>
        </div>
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Category</label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger>
            <SelectValue />
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
        <label className="text-sm font-medium">Content</label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="The snippet content that will be inserted..."
          rows={4}
        />
        <p className="text-xs text-muted-foreground">
          Use {"{{name}}"} for contact's first name, {"{{company}}"} for company name
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {snippet ? "Update" : "Create"} Snippet
        </Button>
      </div>
    </form>
  );
}

export function SnippetsManager() {
  const { snippets, isLoading, createSnippet, updateSnippet, deleteSnippet } = useSnippets();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const filteredSnippets = snippets.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.shortcut.toLowerCase().includes(search.toLowerCase()) ||
      s.content.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard!");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Quick Snippets</CardTitle>
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Snippet</DialogTitle>
              </DialogHeader>
              <SnippetForm
                onSave={(data) => {
                  createSnippet({ ...data, variables: null });
                  setShowCreate(false);
                }}
                onCancel={() => setShowCreate(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Search and Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search snippets..."
              className="pl-9"
            />
          </div>
          <Select
            value={selectedCategory || "all"}
            onValueChange={(v) => setSelectedCategory(v === "all" ? null : v)}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Snippets List */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
          ) : filteredSnippets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No snippets found. Create one to get started!
            </p>
          ) : (
            filteredSnippets.map((snippet) => (
              <div
                key={snippet.id}
                className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{snippet.name}</span>
                      <Badge variant="outline" className="font-mono text-xs shrink-0">
                        {snippet.shortcut}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {snippet.content}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {snippet.category && (
                        <Badge variant="secondary" className="text-xs">
                          <Tag className="h-2.5 w-2.5 mr-1" />
                          {snippet.category}
                        </Badge>
                      )}
                      {snippet.use_count !== null && snippet.use_count > 0 && (
                        <span className="text-xs text-muted-foreground">
                          Used {snippet.use_count}x
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => copyToClipboard(snippet.content)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setEditingSnippet(snippet)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deleteSnippet(snippet.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={!!editingSnippet} onOpenChange={(open) => !open && setEditingSnippet(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Snippet</DialogTitle>
            </DialogHeader>
            {editingSnippet && (
              <SnippetForm
                snippet={editingSnippet}
                onSave={(data) => {
                  updateSnippet({ id: editingSnippet.id, ...data });
                  setEditingSnippet(null);
                }}
                onCancel={() => setEditingSnippet(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
