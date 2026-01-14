import { useState, useEffect } from "react";
import { UserPlus, Search, Check, Loader2, User, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  display_name: string;
  phone_number: string | null;
  email?: string;
}

interface TeamAssignmentDropdownProps {
  communicationId: string;
  currentAssignedTo?: string | null;
  contactName?: string;
  messageSubject?: string;
  messageSummary?: string;
  messageType?: string;
  onAssigned?: (userId: string, userName: string) => void;
  variant?: "icon" | "button";
}

export function TeamAssignmentDropdown({
  communicationId,
  currentAssignedTo,
  contactName,
  messageSubject,
  messageSummary,
  messageType,
  onAssigned,
  variant = "icon",
}: TeamAssignmentDropdownProps) {
  const [currentUserName, setCurrentUserName] = useState("A team member");

  // Fetch current user's name on mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, email")
          .eq("id", user.id)
          .maybeSingle();
        
        if (profile?.first_name) {
          setCurrentUserName(profile.first_name);
        } else if (profile?.email) {
          setCurrentUserName(profile.email.split("@")[0]);
        }
      }
    };
    fetchCurrentUser();
  }, []);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTeamMembers();
    }
  }, [isOpen]);

  const fetchTeamMembers = async () => {
    try {
      setIsLoading(true);
      // Get all active team members with personal phone assignments
      const { data: assignments, error } = await supabase
        .from("user_phone_assignments")
        .select("user_id, display_name, phone_number")
        .eq("is_active", true)
        .eq("phone_type", "personal")
        .order("display_name");

      if (error) throw error;

      if (assignments) {
        // Get emails from profiles for each user
        const userIds = [...new Set(assignments.map(a => a.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", userIds);

        const emailMap = new Map(profiles?.map(p => [p.id, p.email]) || []);

        const members = assignments.map(a => ({
          id: a.user_id,
          display_name: a.display_name || "Unknown",
          phone_number: a.phone_number,
          email: emailMap.get(a.user_id) || undefined,
        }));

        // Deduplicate by user_id
        const uniqueMembers = Array.from(
          new Map(members.map(m => [m.id, m])).values()
        );

        setTeamMembers(uniqueMembers);
      }
    } catch (error) {
      console.error("Error fetching team members:", error);
      toast.error("Failed to load team members");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssign = async (member: TeamMember) => {
    try {
      setIsAssigning(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to assign requests");
        return;
      }

      // Update the communication record with assignment
      const { error: updateError } = await supabase
        .from("lead_communications")
        .update({
          assigned_to: member.id,
          assigned_at: new Date().toISOString(),
          assigned_by: user.id,
        })
        .eq("id", communicationId);

      if (updateError) throw updateError;

      // Create in-app notification
      const { error: notifyError } = await supabase
        .from("team_notifications")
        .insert({
          user_id: member.id,
          type: "assignment",
          title: "New Request Assigned",
          message: contactName 
            ? `A request from ${contactName} has been assigned to your inbox.`
            : "A new request has been assigned to your inbox.",
          link: `/communications?message=${communicationId}`,
          communication_id: communicationId,
          created_by: user.id,
        });

      if (notifyError) {
        console.error("Failed to create notification:", notifyError);
      }

      // Send email notification via edge function
      if (member.email) {
        try {
          await supabase.functions.invoke("send-assignment-notification", {
            body: {
              recipientEmail: member.email,
              recipientName: member.display_name,
              assignerName: currentUserName,
              contactName: contactName || "Unknown",
              communicationId,
              messageSubject,
              messageSummary,
              messageType,
            },
          });
        } catch (emailError) {
          console.error("Failed to send email notification:", emailError);
          // Don't fail the assignment if email fails
        }
      }

      toast.success(`Request assigned to ${member.display_name}`, {
        description: "They will receive an email and in-app notification.",
      });

      onAssigned?.(member.id, member.display_name);
      setIsOpen(false);
    } catch (error) {
      console.error("Error assigning request:", error);
      toast.error("Failed to assign request");
    } finally {
      setIsAssigning(false);
    }
  };

  const filteredMembers = teamMembers.filter(member =>
    member.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const assignedMember = teamMembers.find(m => m.id === currentAssignedTo);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        {variant === "icon" ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Assign to team member"
          >
            <UserPlus className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-2">
            <UserPlus className="h-4 w-4" />
            {assignedMember ? (
              <span className="max-w-[100px] truncate">{assignedMember.display_name}</span>
            ) : (
              "Assign"
            )}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-64 bg-popover border border-border shadow-lg z-50"
        sideOffset={4}
      >
        <div className="p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search team members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
        
        <DropdownMenuSeparator />
        
        <div className="max-h-[240px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              {searchQuery ? "No team members found" : "No team members available"}
            </div>
          ) : (
            filteredMembers.map((member) => (
              <DropdownMenuItem
                key={member.id}
                onClick={() => handleAssign(member)}
                disabled={isAssigning}
                className={cn(
                  "flex items-center gap-3 py-2.5 cursor-pointer",
                  member.id === currentAssignedTo && "bg-primary/10"
                )}
              >
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{member.display_name}</span>
                    {member.id === currentAssignedTo && (
                      <Badge variant="secondary" className="text-xs">
                        Assigned
                      </Badge>
                    )}
                  </div>
                  {member.email && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{member.email}</span>
                    </div>
                  )}
                </div>
                {member.id === currentAssignedTo && (
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                )}
              </DropdownMenuItem>
            ))
          )}
        </div>
        
        {isAssigning && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-md">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
