import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

export interface ToneProfile {
  id: string;
  user_id: string | null;
  formality_level: string | null;
  common_greetings: Json | null;
  common_closings: Json | null;
  signature_phrases: Json | null;
  avg_sentence_length: number | null;
  punctuation_style: string | null;
  emoji_usage: string | null;
  analyzed_email_count: number | null;
  analyzed_sms_count: number | null;
  last_analyzed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useToneProfile() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ["tone-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from("user_tone_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  const analyzeTone = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase.functions.invoke("analyze-tone", {
        body: { user_id: user.id },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tone-profile"] });
      toast.success(`Tone profile updated! Analyzed ${data.emails_analyzed} emails and ${data.sms_analyzed} SMS messages.`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to analyze tone: ${error.message}`);
    },
  });

  return {
    profile,
    isLoading,
    refetch,
    analyzeTone: analyzeTone.mutate,
    isAnalyzing: analyzeTone.isPending,
  };
}
