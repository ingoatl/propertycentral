import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UserTeamRoleResult {
  roleNames: string[];
  primaryRole: string | null;
  isLoading: boolean;
  isLeadership: boolean;
  isOpsManager: boolean;
  isBookkeeper: boolean;
  isMarketingVA: boolean;
  isSales: boolean;
  isCleanerCoordinator: boolean;
}

// Priority order for determining primary role
const ROLE_PRIORITY = [
  "Leadership",
  "Bookkeeper", 
  "Ops Manager",
  "Cleaner Coordinator",
  "Marketing VA",
  "Sales"
];

export function useUserTeamRole(): UserTeamRoleResult {
  const { data, isLoading } = useQuery({
    queryKey: ["user-team-roles"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { roleNames: [] };

      const { data: userRoles, error } = await supabase
        .from("user_team_roles")
        .select(`
          role_id,
          team_roles!inner(role_name)
        `)
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching user team roles:", error);
        return { roleNames: [] };
      }

      const roleNames = userRoles?.map((ur: any) => ur.team_roles.role_name) || [];
      return { roleNames };
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const roleNames = data?.roleNames || [];
  
  // Determine primary role based on priority
  const primaryRole = ROLE_PRIORITY.find(role => 
    roleNames.some(r => r.toLowerCase().includes(role.toLowerCase()))
  ) || roleNames[0] || null;

  // Helper booleans for common role checks
  const hasRole = (searchTerm: string) => 
    roleNames.some(r => r.toLowerCase().includes(searchTerm.toLowerCase()));

  return {
    roleNames,
    primaryRole,
    isLoading,
    isLeadership: hasRole("leadership") || hasRole("owner") || hasRole("ceo"),
    isOpsManager: hasRole("ops") || hasRole("operations"),
    isBookkeeper: hasRole("bookkeeper") || hasRole("accounting") || hasRole("finance"),
    isMarketingVA: hasRole("marketing") || hasRole("va"),
    isSales: hasRole("sales"),
    isCleanerCoordinator: hasRole("cleaner") || hasRole("coordinator"),
  };
}
