import { useState, useEffect, useMemo } from "react";
import { ChevronDown, Users, User, Inbox, Search, Mail, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  gmail_label: string | null;
  unread_count: number;
}

export type InboxView = "my-inbox" | "all" | "unassigned" | string; // string for specific user ID

interface EnhancedInboxSelectorProps {
  selectedView: InboxView;
  onViewChange: (view: InboxView) => void;
  currentUserId: string | null;
  className?: string;
  isAdmin?: boolean; // Only admins can see "All Communications"
}

export function EnhancedInboxSelector({
  selectedView,
  onViewChange,
  currentUserId,
  className,
  isAdmin = false,
}: EnhancedInboxSelectorProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchTeamMembers();
    fetchUnreadCounts();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      // Get users with phone assignments and gmail labels
      const [phoneAssignments, gmailLabels] = await Promise.all([
        supabase
          .from("user_phone_assignments")
          .select("user_id, phone_number, display_name")
          .eq("is_active", true)
          .eq("phone_type", "personal"),
        supabase
          .from("user_gmail_labels")
          .select("user_id, label_name, email_address")
          .eq("is_active", true),
      ]);

      // Merge data by user_id
      const userMap = new Map<string, TeamMember>();

      // Helper to extract first name from display_name (e.g., "Ingo Direct Line" -> "Ingo")
      const extractUserName = (displayName: string | null): string => {
        if (!displayName) return "Unknown";
        // Remove common suffixes like "Direct Line", "Line", etc.
        const cleanName = displayName
          .replace(/\s*(Direct Line|Line|Inbox)$/i, '')
          .trim();
        return cleanName || displayName;
      };

      phoneAssignments.data?.forEach((assignment) => {
        const userName = extractUserName(assignment.display_name);
        userMap.set(assignment.user_id, {
          id: assignment.user_id,
          full_name: userName,
          email: null,
          phone_number: assignment.phone_number,
          gmail_label: null,
          unread_count: 0,
        });
      });

      gmailLabels.data?.forEach((label) => {
        const existing = userMap.get(label.user_id);
        if (existing) {
          existing.email = label.email_address;
          existing.gmail_label = label.label_name;
        } else {
          userMap.set(label.user_id, {
            id: label.user_id,
            full_name: label.label_name.charAt(0).toUpperCase() + label.label_name.slice(1),
            email: label.email_address,
            phone_number: null,
            gmail_label: label.label_name,
            unread_count: 0,
          });
        }
      });

      setTeamMembers(Array.from(userMap.values()));
    } catch (error) {
      console.error("Error fetching team members:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnreadCounts = async () => {
    try {
      // Get unread counts per user from communication_recipients
      const { data } = await supabase
        .from("communication_recipients")
        .select("user_id")
        .eq("is_read", false);

      if (data) {
        const counts: Record<string, number> = {};
        data.forEach((record) => {
          counts[record.user_id] = (counts[record.user_id] || 0) + 1;
        });
        setUnreadCounts(counts);
      }
    } catch (error) {
      console.error("Error fetching unread counts:", error);
    }
  };

  const filteredMembers = useMemo(() => {
    return teamMembers
      .filter((member) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
          member.full_name?.toLowerCase().includes(query) ||
          member.email?.toLowerCase().includes(query) ||
          member.gmail_label?.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  }, [teamMembers, searchQuery]);

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Get the current user's name
  const currentUserName = useMemo(() => {
    const currentMember = teamMembers.find((m) => m.id === currentUserId);
    return currentMember?.full_name || "User";
  }, [teamMembers, currentUserId]);

  const getSelectedLabel = () => {
    if (selectedView === "my-inbox") return `${currentUserName}'s Inbox`;
    if (selectedView === "all") return "All Communications";
    if (selectedView === "unassigned") return "Unassigned";
    
    const member = teamMembers.find((m) => m.id === selectedView);
    return member ? `${member.full_name}'s Inbox` : "Select View";
  };

  const getSelectedIcon = () => {
    if (selectedView === "my-inbox") return <User className="h-4 w-4" />;
    if (selectedView === "all") return <Users className="h-4 w-4" />;
    if (selectedView === "unassigned") return <Mail className="h-4 w-4" />;
    return <UserCheck className="h-4 w-4" />;
  };

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-1.5 h-8 px-2.5 justify-between max-w-[140px]", className)}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {getSelectedIcon()}
            <span className="hidden sm:inline truncate text-xs">
              {getSelectedLabel()}
            </span>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {selectedView === "my-inbox" && unreadCounts[currentUserId || ""] > 0 && (
              <Badge variant="destructive" className="h-4 min-w-[16px] px-1 text-[10px]">
                {unreadCounts[currentUserId || ""]}
              </Badge>
            )}
            {selectedView === "all" && totalUnread > 0 && (
              <Badge variant="secondary" className="h-4 min-w-[16px] px-1 text-[10px]">
                {totalUnread}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {/* Search */}
        <div className="p-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search team members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Quick Views */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Quick Views
        </DropdownMenuLabel>
        
        <DropdownMenuItem
          onClick={() => {
            onViewChange("my-inbox");
            setIsOpen(false);
          }}
          className={cn("gap-2", selectedView === "my-inbox" && "bg-accent")}
        >
          <User className="h-4 w-4" />
          <span className="flex-1">{currentUserName}'s Inbox</span>
          {unreadCounts[currentUserId || ""] > 0 && (
            <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-xs">
              {unreadCounts[currentUserId || ""]}
            </Badge>
          )}
        </DropdownMenuItem>

        {/* Only show "All Communications" option for admins */}
        {isAdmin && (
          <DropdownMenuItem
            onClick={() => {
              onViewChange("all");
              setIsOpen(false);
            }}
            className={cn("gap-2", selectedView === "all" && "bg-accent")}
          >
            <Users className="h-4 w-4" />
            <span className="flex-1">All Communications</span>
            {totalUnread > 0 && (
              <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
                {totalUnread}
              </Badge>
            )}
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onClick={() => {
            onViewChange("unassigned");
            setIsOpen(false);
          }}
          className={cn("gap-2", selectedView === "unassigned" && "bg-accent")}
        >
          <Mail className="h-4 w-4" />
          <span className="flex-1">Unassigned</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Team Members */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Team Members
        </DropdownMenuLabel>

        <ScrollArea className="max-h-[240px]">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No team members found
            </div>
          ) : (
            filteredMembers.map((member) => (
              <DropdownMenuItem
                key={member.id}
                onClick={() => {
                  onViewChange(member.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "gap-2 py-2",
                  selectedView === member.id && "bg-accent"
                )}
              >
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs bg-primary/10">
                    {getInitials(member.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{member.full_name}</div>
                  {member.email && (
                    <div className="text-xs text-muted-foreground truncate">
                      {member.email}
                    </div>
                  )}
                </div>
                {unreadCounts[member.id] > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
                    {unreadCounts[member.id]}
                  </Badge>
                )}
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
