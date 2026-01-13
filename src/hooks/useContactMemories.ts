import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Memory {
  id?: string;
  category: string;
  memory: string;
  confidence: number;
  source_quote?: string;
  created_at?: string;
}

interface MemoriesResponse {
  success: boolean;
  memories: Memory[];
  memoryCount: number;
  contactIdentifier?: string;
}

// Build contact identifier consistently
const buildContactIdentifier = (leadId?: string, ownerId?: string, contactPhone?: string): string => {
  if (leadId) return `lead_${leadId}`;
  if (ownerId) return `owner_${ownerId}`;
  if (contactPhone) return `phone_${contactPhone.replace(/[^0-9]/g, "")}`;
  return "";
};

export function useContactMemories(leadId?: string, ownerId?: string, contactPhone?: string) {
  const queryClient = useQueryClient();
  const contactIdentifier = buildContactIdentifier(leadId, ownerId, contactPhone);

  // Fetch memories from Mem0
  const { data: memories = [], isLoading, error } = useQuery({
    queryKey: ["contact-memories", contactIdentifier],
    queryFn: async () => {
      if (!contactIdentifier) return [];

      // Try to get from Mem0 first
      const { data, error } = await supabase.functions.invoke("mem0-memory", {
        body: {
          action: "get",
          user_id: contactIdentifier,
          limit: 50,
        },
      });

      if (error) {
        console.error("Error fetching memories:", error);
        return [];
      }

      // Mem0 returns memories in a specific format
      const mem0Memories = data?.memories || [];
      
      // Transform to our format
      return mem0Memories.map((m: any) => ({
        id: m.id,
        memory: m.memory || m.text || m.content,
        category: m.metadata?.category || "general",
        confidence: m.metadata?.confidence || 0.8,
        created_at: m.created_at || m.metadata?.extracted_at,
      }));
    },
    enabled: !!contactIdentifier,
    staleTime: 60000, // 1 minute
  });

  // Extract memories mutation
  const extractMemoriesMutation = useMutation({
    mutationFn: async ({ forceExtract = false }: { forceExtract?: boolean } = {}) => {
      const { data, error } = await supabase.functions.invoke("extract-contact-memories", {
        body: {
          leadId,
          ownerId,
          contactPhone,
          forceExtract,
        },
      });

      if (error) throw error;
      return data as MemoriesResponse;
    },
    onSuccess: (data) => {
      if (data.memoryCount > 0) {
        toast.success(`Extracted ${data.memoryCount} memories`);
      }
      queryClient.invalidateQueries({ queryKey: ["contact-memories", contactIdentifier] });
    },
    onError: (error: Error) => {
      console.error("Error extracting memories:", error);
      toast.error("Failed to extract memories");
    },
  });

  // Search memories for AI context
  const searchMemories = async (query: string): Promise<Memory[]> => {
    if (!contactIdentifier) return [];

    try {
      const { data, error } = await supabase.functions.invoke("mem0-memory", {
        body: {
          action: "search",
          query,
          user_id: contactIdentifier,
          max_results: 10,
        },
      });

      if (error) {
        console.error("Error searching memories:", error);
        return [];
      }

      return (data?.results || []).map((m: any) => ({
        id: m.id,
        memory: m.memory || m.text,
        category: m.metadata?.category || "general",
        confidence: m.score || m.metadata?.confidence || 0.8,
      }));
    } catch (e) {
      console.error("Memory search error:", e);
      return [];
    }
  };

  // Delete a memory
  const deleteMemoryMutation = useMutation({
    mutationFn: async (memoryId: string) => {
      const { data, error } = await supabase.functions.invoke("mem0-memory", {
        body: {
          action: "delete",
          memory_id: memoryId,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Memory deleted");
      queryClient.invalidateQueries({ queryKey: ["contact-memories", contactIdentifier] });
    },
    onError: (error: Error) => {
      console.error("Error deleting memory:", error);
      toast.error("Failed to delete memory");
    },
  });

  // Format memories for AI prompt injection
  const formatMemoriesForAI = (mems: Memory[] = memories): string => {
    if (!mems || mems.length === 0) return "";

    const grouped: Record<string, string[]> = {};
    
    for (const m of mems) {
      if (!grouped[m.category]) {
        grouped[m.category] = [];
      }
      grouped[m.category].push(m.memory);
    }

    let formatted = "\n\nREMEMBERED CONTEXT ABOUT THIS CONTACT:\n";
    
    const categoryLabels: Record<string, string> = {
      preference: "Preferences",
      fact: "Key Facts",
      concern: "Concerns/Issues",
      request: "Outstanding Requests",
      personality: "Communication Style",
      general: "Notes",
    };

    for (const [category, items] of Object.entries(grouped)) {
      const label = categoryLabels[category] || category;
      formatted += `\n${label}:\n`;
      for (const item of items) {
        formatted += `- ${item}\n`;
      }
    }

    formatted += "\nUSE THIS CONTEXT TO PERSONALIZE YOUR RESPONSE.\n";
    
    return formatted;
  };

  return {
    memories,
    isLoading,
    error,
    extractMemories: extractMemoriesMutation.mutate,
    isExtracting: extractMemoriesMutation.isPending,
    searchMemories,
    deleteMemory: deleteMemoryMutation.mutate,
    isDeletingMemory: deleteMemoryMutation.isPending,
    formatMemoriesForAI,
    contactIdentifier,
  };
}
