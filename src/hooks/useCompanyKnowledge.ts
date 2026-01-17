import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface KnowledgeEntry {
  id: string;
  category: string;
  subcategory: string | null;
  title: string;
  content: string;
  keywords: string[];
  use_in_contexts: string[];
  priority: number;
  is_active: boolean;
  referral_link: string | null;
}

export function useCompanyKnowledge(context: "email" | "sms" | "all" = "all") {
  return useQuery({
    queryKey: ["company-knowledge-active", context],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_knowledge_base")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: false });

      if (error) throw error;

      // Filter by context
      return (data as KnowledgeEntry[]).filter(
        (k) =>
          k.use_in_contexts?.includes("all") ||
          k.use_in_contexts?.includes(context)
      );
    },
  });
}

export function useKnowledgeSearch(keywords: string[]) {
  return useQuery({
    queryKey: ["company-knowledge-search", keywords],
    queryFn: async () => {
      if (!keywords.length) return [];

      const { data, error } = await supabase
        .from("company_knowledge_base")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: false });

      if (error) throw error;

      // Score entries by keyword matches
      const scoredEntries = (data as KnowledgeEntry[]).map((entry) => {
        let score = 0;
        const lowerKeywords = keywords.map((k) => k.toLowerCase());

        // Check title
        lowerKeywords.forEach((kw) => {
          if (entry.title.toLowerCase().includes(kw)) score += 10;
        });

        // Check content
        lowerKeywords.forEach((kw) => {
          if (entry.content.toLowerCase().includes(kw)) score += 5;
        });

        // Check entry keywords
        entry.keywords?.forEach((entryKw) => {
          if (lowerKeywords.includes(entryKw.toLowerCase())) score += 15;
        });

        return { ...entry, matchScore: score };
      });

      // Return entries with matches, sorted by score
      return scoredEntries
        .filter((e) => e.matchScore > 0)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 10);
    },
    enabled: keywords.length > 0,
  });
}
