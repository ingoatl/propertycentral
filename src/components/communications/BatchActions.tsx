import { useState } from "react";
import {
  UserCheck,
  CheckCircle2,
  Archive,
  Tag,
  Trash2,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { WorkStatus } from "./WorkStatusBadge";

interface TeamMember {
  id: string;
  full_name: string | null;
}

interface BatchActionsProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onActionComplete: () => void;
  teamMembers?: TeamMember[];
  className?: string;
}

const BATCH_LABELS = [
  "urgent",
  "follow-up",
  "booking",
  "maintenance",
  "client",
  "owner",
];

export function BatchActions({
  selectedIds,
  onClearSelection,
  onActionComplete,
  teamMembers = [],
  className,
}: BatchActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  if (selectedIds.length === 0) return null;

  const handleBatchAssign = async (userId: string) => {
    setIsLoading(true);
    setLoadingAction("assign");

    try {
      const { error } = await supabase
        .from("lead_communications")
        .update({ assigned_to: userId })
        .in("id", selectedIds);

      if (error) throw error;

      toast.success(`Assigned ${selectedIds.length} messages`);
      onClearSelection();
      onActionComplete();
    } catch (error) {
      console.error("Error batch assigning:", error);
      toast.error("Failed to assign messages");
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const handleBatchStatus = async (status: WorkStatus) => {
    setIsLoading(true);
    setLoadingAction("status");

    try {
      const { error } = await supabase
        .from("lead_communications")
        .update({ work_status: status })
        .in("id", selectedIds);

      if (error) throw error;

      toast.success(`Updated ${selectedIds.length} messages to ${status}`);
      onClearSelection();
      onActionComplete();
    } catch (error) {
      console.error("Error batch updating status:", error);
      toast.error("Failed to update status");
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const handleBatchLabel = async (label: string, add: boolean) => {
    setIsLoading(true);
    setLoadingAction("label");

    try {
      // First fetch current labels for each message
      const { data: messages, error: fetchError } = await supabase
        .from("lead_communications")
        .select("id, labels")
        .in("id", selectedIds);

      if (fetchError) throw fetchError;

      // Update each message's labels
      const updates = messages?.map((msg) => {
        const currentLabels: string[] = (msg.labels as string[]) || [];
        const newLabels = add
          ? [...new Set([...currentLabels, label])]
          : currentLabels.filter((l) => l !== label);

        return supabase
          .from("lead_communications")
          .update({ labels: newLabels })
          .eq("id", msg.id);
      });

      await Promise.all(updates || []);

      toast.success(
        add
          ? `Added "${label}" to ${selectedIds.length} messages`
          : `Removed "${label}" from ${selectedIds.length} messages`
      );
      onClearSelection();
      onActionComplete();
    } catch (error) {
      console.error("Error batch updating labels:", error);
      toast.error("Failed to update labels");
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  const handleBatchArchive = async () => {
    setIsLoading(true);
    setLoadingAction("archive");

    try {
      const { error } = await supabase
        .from("lead_communications")
        .update({ work_status: "archived" })
        .in("id", selectedIds);

      if (error) throw error;

      toast.success(`Archived ${selectedIds.length} messages`);
      onClearSelection();
      onActionComplete();
    } catch (error) {
      console.error("Error batch archiving:", error);
      toast.error("Failed to archive messages");
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 bg-muted/50 rounded-lg border animate-in slide-in-from-top-2",
        className
      )}
    >
      <Badge variant="secondary" className="gap-1">
        <span className="font-semibold">{selectedIds.length}</span>
        <span>selected</span>
      </Badge>

      <div className="flex items-center gap-1 flex-1">
        {/* Assign Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isLoading}
              className="gap-1.5"
            >
              {loadingAction === "assign" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserCheck className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Assign</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Assign to</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {teamMembers.map((member) => (
              <DropdownMenuItem
                key={member.id}
                onClick={() => handleBatchAssign(member.id)}
              >
                {member.full_name || "Unknown"}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Status Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isLoading}
              className="gap-1.5"
            >
              {loadingAction === "status" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Status</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Set Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleBatchStatus("pending")}>
              Pending
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleBatchStatus("in_progress")}>
              In Progress
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleBatchStatus("resolved")}>
              Resolved
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Labels Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={isLoading}
              className="gap-1.5"
            >
              {loadingAction === "label" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Tag className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Label</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Add Label</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {BATCH_LABELS.map((label) => (
                  <DropdownMenuItem
                    key={label}
                    onClick={() => handleBatchLabel(label, true)}
                  >
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Remove Label</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {BATCH_LABELS.map((label) => (
                  <DropdownMenuItem
                    key={label}
                    onClick={() => handleBatchLabel(label, false)}
                  >
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Archive Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBatchArchive}
          disabled={isLoading}
          className="gap-1.5"
        >
          {loadingAction === "archive" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Archive className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Archive</span>
        </Button>
      </div>

      {/* Clear Selection */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearSelection}
        className="gap-1.5"
      >
        <X className="h-4 w-4" />
        <span className="hidden sm:inline">Clear</span>
      </Button>
    </div>
  );
}
