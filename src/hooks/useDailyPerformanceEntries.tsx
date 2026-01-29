import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DailyPerformanceEntry {
  id: string;
  date: string;
  entry: string;
  user_name: string;
  user_id: string;
  created_at: string;
}

interface UseDailyPerformanceEntriesProps {
  teamId?: string;
  startDate?: string;
  endDate?: string;
}

export const useDailyPerformanceEntries = ({ 
  teamId, 
  startDate, 
  endDate 
}: UseDailyPerformanceEntriesProps = {}) => {
  const [entries, setEntries] = useState<DailyPerformanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEntries();
  }, [teamId, startDate, endDate]);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Fetch entries
      let query = supabase
        .from("daily_performance_entries")
        .select("id, date, entry, user_id, created_at")
        .order("date", { ascending: false });

      if (teamId) {
        query = query.eq("team_id", teamId);
      }
      if (startDate) {
        query = query.gte("date", startDate);
      }
      if (endDate) {
        query = query.lte("date", endDate);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      // Fetch profiles for user names
      const userIds = [...new Set((data || []).map(e => e.user_id))];
      let profilesMap: Record<string, string> = {};
      
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name")
          .in("id", userIds);
        
        (profiles as any[])?.forEach(p => {
          profilesMap[p.id] = p.first_name || 'Unknown';
        });
      }

      const transformedEntries: DailyPerformanceEntry[] = (data || []).map((entry: any) => ({
        id: entry.id,
        date: entry.date,
        entry: entry.entry,
        user_id: entry.user_id,
        user_name: profilesMap[entry.user_id] || 'Unknown User',
        created_at: entry.created_at
      }));

      setEntries(transformedEntries);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch entries";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const addEntry = async (entry: string, teamId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error: insertError } = await supabase
        .from("daily_performance_entries")
        .insert({ user_id: user.id, team_id: teamId, entry });

      if (insertError) throw insertError;
      toast.success("Entry added successfully");
      await fetchEntries();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to add entry";
      toast.error(errorMessage);
      throw err;
    }
  };

  return { entries, loading, error, refetch: fetchEntries, addEntry };
};
