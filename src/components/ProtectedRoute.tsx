import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApproved, setIsApproved] = useState(false);
  const navigate = useNavigate();

  const checkApprovalStatus = useCallback(async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", userId)
        .single();

      if (profile?.status === "approved") {
        setIsApproved(true);
      } else {
        setIsApproved(false);
      }
    } catch (error: unknown) {
      if (import.meta.env.DEV) {
        console.error("Error checking approval status:", error);
      }
      setIsApproved(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      
      setUser(session?.user ?? null);
      
      if (session?.user) {
        checkApprovalStatus(session.user.id);
      } else {
        setLoading(false);
        if (event === 'SIGNED_OUT') {
          navigate("/auth");
        }
      }
    });

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      setUser(session?.user ?? null);
      
      if (session?.user) {
        checkApprovalStatus(session.user.id);
      } else {
        setLoading(false);
        navigate("/auth");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, checkApprovalStatus]);

  // Compute pendingApproval status
  const pendingApproval = user && !loading && !isApproved;

  return { user, loading, isApproved, pendingApproval };
};
