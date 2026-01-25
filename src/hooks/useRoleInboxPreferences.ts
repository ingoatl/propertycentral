import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface RoleInboxPreferences {
  excluded_categories: string[];
  excluded_phone_purposes: string[];
  priority_categories: string[];
  focus_description: string | null;
}

export function useRoleInboxPreferences(userId: string | null) {
  return useQuery<RoleInboxPreferences | null>({
    queryKey: ["role-inbox-preferences", userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .rpc("get_user_inbox_exclusions", { p_user_id: userId });
      
      if (error) {
        console.error("Error fetching role inbox preferences:", error);
        return null;
      }
      
      // The RPC returns an array, get the first row
      const result = Array.isArray(data) ? data[0] : data;
      
      if (!result) return null;
      
      return {
        excluded_categories: result.excluded_categories || [],
        excluded_phone_purposes: result.excluded_phone_purposes || [],
        priority_categories: result.priority_categories || [],
        focus_description: result.focus_description || null,
      };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

// Helper to check if an email category should be excluded
export function shouldExcludeEmail(
  category: string | undefined,
  preferences: RoleInboxPreferences | null
): boolean {
  if (!preferences || !category) return false;
  
  const lowerCategory = category.toLowerCase();
  return preferences.excluded_categories.some(
    excluded => lowerCategory.includes(excluded.toLowerCase())
  );
}

// Helper to check if a message is a priority for the user's role
export function isRolePriority(
  category: string | undefined,
  preferences: RoleInboxPreferences | null
): boolean {
  if (!preferences || !category) return false;
  
  const lowerCategory = category.toLowerCase();
  return preferences.priority_categories.some(
    priority => lowerCategory.includes(priority.toLowerCase())
  );
}
