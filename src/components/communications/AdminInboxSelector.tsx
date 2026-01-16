import { useState, useEffect } from "react";
import { ChevronDown, Users, User, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";

interface UserWithPhone {
  id: string;
  full_name: string | null;
  phone_number: string | null;
}

interface AdminInboxSelectorProps {
  selectedUserId: string | null;
  onUserChange: (userId: string | null, viewAll: boolean) => void;
  currentUserId: string | null;
}

export function AdminInboxSelector({
  selectedUserId,
  onUserChange,
  currentUserId,
}: AdminInboxSelectorProps) {
  const [users, setUsers] = useState<UserWithPhone[]>([]);
  const [viewAll, setViewAll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUsersWithPhones();
  }, []);

  const fetchUsersWithPhones = async () => {
    try {
      // Get all users who have phone assignments
      const { data: assignments } = await supabase
        .from("user_phone_assignments")
        .select(`
          user_id,
          phone_number,
          display_name
        `)
        .eq("is_active", true)
        .eq("phone_type", "personal");

      if (assignments && assignments.length > 0) {
        const userIds = [...new Set(assignments.map(a => a.user_id))];
        
        // Helper to extract user name from display_name (e.g., "Ingo Direct Line" -> "Ingo")
        const extractUserName = (displayName: string | null): string => {
          if (!displayName) return "Unknown";
          return displayName.replace(/\s*(Direct Line|Line|Inbox)$/i, '').trim() || displayName;
        };
        
        // Use assignments directly since they have display_name
        const usersWithPhones = assignments.map(assignment => ({
          id: assignment.user_id,
          full_name: extractUserName(assignment.display_name),
          phone_number: assignment.phone_number || null,
        }));
        setUsers(usersWithPhones);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectUser = (userId: string | null) => {
    setViewAll(userId === null);
    onUserChange(userId, userId === null);
  };

  const getSelectedLabel = () => {
    if (viewAll) return "All Inboxes";
    const currentUser = users.find(u => u.id === currentUserId);
    if (selectedUserId === currentUserId) return `${currentUser?.full_name || "My"}'s Inbox`;
    const user = users.find(u => u.id === selectedUserId);
    return user ? `${user.full_name}'s Inbox` : "Select Inbox";
  };

  if (isLoading || users.length <= 1) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Inbox className="h-4 w-4" />
          <span className="hidden sm:inline">{getSelectedLabel()}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem
          onClick={() => handleSelectUser(currentUserId)}
          className="gap-2"
        >
          <User className="h-4 w-4" />
          My Inbox
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {users
          .filter(u => u.id !== currentUserId)
          .map((user) => (
            <DropdownMenuItem
              key={user.id}
              onClick={() => handleSelectUser(user.id)}
              className="gap-2"
            >
              <User className="h-4 w-4" />
              <div className="flex flex-col">
                <span>{user.full_name}</span>
                {user.phone_number && (
                  <span className="text-xs text-muted-foreground">
                    {user.phone_number}
                  </span>
                )}
              </div>
            </DropdownMenuItem>
          ))}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={() => handleSelectUser(null)}
          className="gap-2"
        >
          <Users className="h-4 w-4" />
          All Inboxes
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
