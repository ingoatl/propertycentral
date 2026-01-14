import { useState, useEffect } from "react";
import { UserPlus, Check, Loader2 } from "lucide-react";
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
} from "@/components/ui/command";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  full_name: string | null;
}

interface QuickAssignButtonProps {
  communicationId: string;
  currentAssignee?: string | null;
  onAssigned?: (userId: string) => void;
  variant?: "icon" | "button";
  className?: string;
}

export function QuickAssignButton({
  communicationId,
  currentAssignee,
  onAssigned,
  variant = "icon",
  className,
}: QuickAssignButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [assignedTo, setAssignedTo] = useState<string | null>(currentAssignee || null);

  useEffect(() => {
    if (isOpen && teamMembers.length === 0) {
      fetchTeamMembers();
    }
  }, [isOpen]);

  const fetchTeamMembers = async () => {
    try {
      const { data } = await supabase
        .from("user_phone_assignments")
        .select("user_id, display_name")
        .eq("is_active", true)
        .eq("phone_type", "personal");

      if (data) {
        const uniqueMembers = Array.from(
          new Map(
            data.map((item) => [
              item.user_id,
              { id: item.user_id, full_name: item.display_name },
            ])
          ).values()
        );
        setTeamMembers(uniqueMembers);
      }
    } catch (error) {
      console.error("Error fetching team members:", error);
    }
  };

  const handleAssign = async (userId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("lead_communications")
        .update({ assigned_to: userId })
        .eq("id", communicationId);

      if (error) throw error;

      // Create recipient record for assignment tracking
      await supabase.from("communication_recipients").upsert(
        {
          communication_id: communicationId,
          user_id: userId,
          recipient_type: "assigned",
        },
        { onConflict: "communication_id,user_id,recipient_type" }
      );

      setAssignedTo(userId);
      onAssigned?.(userId);
      setIsOpen(false);

      const member = teamMembers.find((m) => m.id === userId);
      toast.success(`Assigned to ${member?.full_name || "team member"}`);
    } catch (error) {
      console.error("Error assigning:", error);
      toast.error("Failed to assign");
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const currentMember = teamMembers.find((m) => m.id === assignedTo);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {variant === "icon" ? (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0 hover:bg-accent",
              assignedTo && "text-primary",
              className
            )}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : assignedTo ? (
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px] bg-primary/10">
                  {getInitials(currentMember?.full_name)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-2", className)}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            <span>{assignedTo ? currentMember?.full_name : "Assign"}</span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search team members..." />
          <CommandList>
            <CommandEmpty>No team members found</CommandEmpty>
            <CommandGroup>
              {teamMembers.map((member) => (
                <CommandItem
                  key={member.id}
                  value={member.full_name || member.id}
                  onSelect={() => handleAssign(member.id)}
                  className="gap-2"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px] bg-muted">
                      {getInitials(member.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1">{member.full_name}</span>
                  {assignedTo === member.id && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
