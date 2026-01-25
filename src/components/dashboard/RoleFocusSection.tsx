import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BookkeeperFocusPanel } from "./focus-panels/BookkeeperFocusPanel";
import { OpsManagerFocusPanel } from "./focus-panels/OpsManagerFocusPanel";
import { AdminFocusPanel } from "./focus-panels/AdminFocusPanel";
import { Skeleton } from "@/components/ui/skeleton";

interface UserRoleInfo {
  roleNames: string[];
  primaryRole: string | null;
  userId: string;
  userName: string;
}

// Role priority order for determining which panel to show
const ROLE_PRIORITY = [
  "Bookkeeper",
  "Ops Manager", 
  "Cleaner Coordinator",
  "Access Manager",
  "Marketing VA",
  "Sales",
];

export const RoleFocusSection = () => {
  const { data: roleInfo, isLoading } = useQuery<UserRoleInfo | null>({
    queryKey: ["user-role-focus"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, email")
        .eq("id", user.id)
        .maybeSingle();

      // Get user's team roles
      const { data: userRoles } = await supabase
        .from("user_team_roles")
        .select(`
          role_id,
          team_roles (role_name)
        `)
        .eq("user_id", user.id);

      const roleNames = userRoles?.map((r: any) => r.team_roles?.role_name).filter(Boolean) || [];
      
      // Determine primary role based on priority
      const primaryRole = ROLE_PRIORITY.find(r => roleNames.includes(r)) || roleNames[0] || null;

      return {
        roleNames,
        primaryRole,
        userId: user.id,
        userName: profile?.first_name || profile?.email?.split("@")[0] || "there",
      };
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!roleInfo || !roleInfo.primaryRole) {
    // Fall back to admin panel for users without specific roles (likely admins)
    return <AdminFocusPanel />;
  }

  // Render the appropriate focus panel based on role
  switch (roleInfo.primaryRole) {
    case "Bookkeeper":
      return <BookkeeperFocusPanel userName={roleInfo.userName} />;
    case "Ops Manager":
    case "Cleaner Coordinator":
      return <OpsManagerFocusPanel userName={roleInfo.userName} />;
    case "Access Manager":
    case "Marketing VA":
    case "Sales":
    default:
      return <AdminFocusPanel />;
  }
};
