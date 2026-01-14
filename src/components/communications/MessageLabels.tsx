import { useState, useMemo } from "react";
import { Tag, Plus, X, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Predefined labels with colors
const PREDEFINED_LABELS = [
  { name: "urgent", color: "bg-red-500/10 text-red-600 border-red-500/30" },
  { name: "follow-up", color: "bg-orange-500/10 text-orange-600 border-orange-500/30" },
  { name: "booking", color: "bg-purple-500/10 text-purple-600 border-purple-500/30" },
  { name: "maintenance", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
  { name: "client", color: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  { name: "owner", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  { name: "vendor", color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30" },
  { name: "inquiry", color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30" },
  { name: "billing", color: "bg-pink-500/10 text-pink-600 border-pink-500/30" },
  { name: "review", color: "bg-violet-500/10 text-violet-600 border-violet-500/30" },
];

interface MessageLabelsProps {
  labels: string[];
  communicationId: string;
  onLabelsChange?: (labels: string[]) => void;
  editable?: boolean;
  compact?: boolean;
  maxVisible?: number;
  className?: string;
}

export function MessageLabels({
  labels: initialLabels,
  communicationId,
  onLabelsChange,
  editable = true,
  compact = false,
  maxVisible = 3,
  className,
}: MessageLabelsProps) {
  const [labels, setLabels] = useState<string[]>(initialLabels || []);
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const getLabelStyle = (label: string) => {
    const predefined = PREDEFINED_LABELS.find(
      (l) => l.name.toLowerCase() === label.toLowerCase()
    );
    return predefined?.color || "bg-secondary text-secondary-foreground border-border";
  };

  const visibleLabels = useMemo(() => {
    if (compact && labels.length > maxVisible) {
      return labels.slice(0, maxVisible);
    }
    return labels;
  }, [labels, compact, maxVisible]);

  const hiddenCount = compact ? Math.max(0, labels.length - maxVisible) : 0;

  const handleToggleLabel = async (labelName: string) => {
    const isRemoving = labels.includes(labelName);
    const newLabels = isRemoving
      ? labels.filter((l) => l !== labelName)
      : [...labels, labelName];

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("lead_communications")
        .update({ labels: newLabels })
        .eq("id", communicationId);

      if (error) throw error;

      setLabels(newLabels);
      onLabelsChange?.(newLabels);
    } catch (error) {
      console.error("Error updating labels:", error);
      toast.error("Failed to update labels");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddCustomLabel = async () => {
    if (!newLabel.trim() || labels.includes(newLabel.trim().toLowerCase())) {
      return;
    }

    const labelToAdd = newLabel.trim().toLowerCase();
    await handleToggleLabel(labelToAdd);
    setNewLabel("");
  };

  if (labels.length === 0 && !editable) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      {visibleLabels.map((label) => (
        <Badge
          key={label}
          variant="outline"
          className={cn(
            "text-xs font-medium",
            getLabelStyle(label),
            compact && "px-1.5 py-0"
          )}
        >
          {label}
          {editable && !compact && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleLabel(label);
              }}
              className="ml-1 hover:text-destructive"
              disabled={isUpdating}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}

      {hiddenCount > 0 && (
        <Badge variant="secondary" className="text-xs px-1.5 py-0">
          +{hiddenCount}
        </Badge>
      )}

      {editable && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-6 w-6 p-0 hover:bg-muted",
                compact && "h-5 w-5"
              )}
            >
              <Plus className={cn("h-3 w-3", compact && "h-2.5 w-2.5")} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-0" align="start">
            <Command>
              <CommandInput
                placeholder="Search or add label..."
                value={newLabel}
                onValueChange={setNewLabel}
              />
              <CommandList>
                <CommandEmpty>
                  {newLabel.trim() && (
                    <button
                      onClick={handleAddCustomLabel}
                      className="w-full px-2 py-1.5 text-sm text-left hover:bg-accent flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add "{newLabel.trim()}"
                    </button>
                  )}
                </CommandEmpty>
                <CommandGroup heading="Labels">
                  {PREDEFINED_LABELS.map((labelDef) => {
                    const isSelected = labels.includes(labelDef.name);
                    return (
                      <CommandItem
                        key={labelDef.name}
                        onSelect={() => handleToggleLabel(labelDef.name)}
                        className="gap-2"
                      >
                        <div
                          className={cn(
                            "h-4 w-4 rounded border flex items-center justify-center",
                            isSelected ? "bg-primary border-primary" : "border-input"
                          )}
                        >
                          {isSelected && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={cn("text-xs", labelDef.color)}
                        >
                          {labelDef.name}
                        </Badge>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                {labels.filter(
                  (l) => !PREDEFINED_LABELS.some((p) => p.name === l)
                ).length > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup heading="Custom Labels">
                      {labels
                        .filter((l) => !PREDEFINED_LABELS.some((p) => p.name === l))
                        .map((label) => (
                          <CommandItem
                            key={label}
                            onSelect={() => handleToggleLabel(label)}
                            className="gap-2"
                          >
                            <div className="h-4 w-4 rounded border bg-primary border-primary flex items-center justify-center">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {label}
                            </Badge>
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

// Compact label display for list items
export function LabelBadges({
  labels,
  maxVisible = 2,
  className,
}: {
  labels: string[];
  maxVisible?: number;
  className?: string;
}) {
  if (!labels || labels.length === 0) return null;

  const visible = labels.slice(0, maxVisible);
  const hidden = labels.length - maxVisible;

  const getLabelStyle = (label: string) => {
    const predefined = PREDEFINED_LABELS.find(
      (l) => l.name.toLowerCase() === label.toLowerCase()
    );
    return predefined?.color || "bg-secondary text-secondary-foreground border-border";
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {visible.map((label) => (
        <Badge
          key={label}
          variant="outline"
          className={cn("text-[10px] px-1.5 py-0 h-4", getLabelStyle(label))}
        >
          {label}
        </Badge>
      ))}
      {hidden > 0 && (
        <span className="text-[10px] text-muted-foreground">+{hidden}</span>
      )}
    </div>
  );
}
