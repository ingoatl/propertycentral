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

      // Check authentication
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Build query
      let query = supabase
        .from("daily_performance_entries")
        .select(`
          id,
          date,
          entry,
          user_id,
          created_at,
          profiles!inner(first_name, last_name)
        `)
        .order("date", { ascending: false });

      // Add filters
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

      // Transform data to include user_name
      const transformedEntries: DailyPerformanceEntry[] = (data || []).map((entry: any) => ({
        id: entry.id,
        date: entry.date,
        entry: entry.entry,
        user_id: entry.user_id,
        user_name: `${entry.profiles?.first_name || ''} ${entry.profiles?.last_name || ''}`.trim() || 'Unknown User',
        created_at: entry.created_at
      }));

      setEntries(transformedEntries);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch daily performance entries";
      setError(errorMessage);
      toast.error(errorMessage);
      console.error("Error fetching daily performance entries:", err);
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
        .insert({
          user_id: user.id,
          team_id: teamId,
          entry
        });

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
