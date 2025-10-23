import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Cache admin status to avoid repeated database calls
let cachedAdminStatus: boolean | null = null;
let cachedUserId: string | null = null;

export const useAdminCheck = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      // Use cached result if it's for the same user
      if (cachedUserId === user.id && cachedAdminStatus !== null) {
        setIsAdmin(cachedAdminStatus);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (error) throw error;
      
      const adminStatus = !!data;
      
      // Cache the result
      cachedUserId = user.id;
      cachedAdminStatus = adminStatus;
      
      setIsAdmin(adminStatus);
    } catch (error) {
      console.error("Error checking admin status:", error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  return { isAdmin, loading };
};
