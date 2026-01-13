import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Brain, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  Trash2,
  Heart,
  Info,
  AlertTriangle,
  FileQuestion,
  User,
  Sparkles
} from "lucide-react";
import { useContactMemories } from "@/hooks/useContactMemories";
import { cn } from "@/lib/utils";

interface ContactMemoriesPanelProps {
  leadId?: string;
  ownerId?: string;
  contactPhone?: string;
  contactName?: string;
  className?: string;
}

const categoryConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  preference: { 
    icon: <Heart className="h-3 w-3" />, 
    color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
    label: "Preference"
  },
  fact: { 
    icon: <Info className="h-3 w-3" />, 
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    label: "Fact"
  },
  concern: { 
    icon: <AlertTriangle className="h-3 w-3" />, 
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    label: "Concern"
  },
  request: { 
    icon: <FileQuestion className="h-3 w-3" />, 
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    label: "Request"
  },
  personality: { 
    icon: <User className="h-3 w-3" />, 
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    label: "Personality"
  },
  general: { 
    icon: <Brain className="h-3 w-3" />, 
    color: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300",
    label: "General"
  },
};

export function ContactMemoriesPanel({
  leadId,
  ownerId,
  contactPhone,
  contactName = "Contact",
  className,
}: ContactMemoriesPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const {
    memories,
    isLoading,
    extractMemories,
    isExtracting,
    deleteMemory,
    isDeletingMemory,
  } = useContactMemories(leadId, ownerId, contactPhone);

  const getCategoryConfig = (category: string) => {
    return categoryConfig[category] || categoryConfig.general;
  };

  const hasMemories = memories && memories.length > 0;

  return (
    <Card className={cn("border-border/50", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Brain className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-sm font-medium">
                AI Memory
              </CardTitle>
              {hasMemories && (
                <Badge variant="secondary" className="text-xs">
                  {memories.length} memories
                </Badge>
              )}
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </CollapsibleTrigger>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => extractMemories({ forceExtract: true })}
              disabled={isExtracting}
              className="h-8"
            >
              {isExtracting ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span className="ml-1 text-xs">
                {hasMemories ? "Refresh" : "Extract"}
              </span>
            </Button>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : hasMemories ? (
              <div className="space-y-2">
                {memories.map((memory, index) => {
                  const config = getCategoryConfig(memory.category);
                  return (
                    <div
                      key={memory.id || index}
                      className="group flex items-start gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <Badge 
                        variant="secondary" 
                        className={cn("shrink-0 text-xs gap-1", config.color)}
                      >
                        {config.icon}
                        {config.label}
                      </Badge>
                      <p className="text-sm text-foreground/80 flex-1">
                        {memory.memory}
                      </p>
                      {memory.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={() => deleteMemory(memory.id!)}
                          disabled={isDeletingMemory}
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4">
                <Brain className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No memories yet
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Click "Extract" to analyze conversation history
                </p>
              </div>
            )}

            {hasMemories && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  These memories are automatically used to personalize AI responses
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
