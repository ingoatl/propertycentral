import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Snippet {
  id: string;
  name: string;
  shortcut: string;
  content: string;
  category: string | null;
  variables: Record<string, string>[] | null;
  use_count: number | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useSnippets() {
  const queryClient = useQueryClient();

  const { data: snippets = [], isLoading } = useQuery({
    queryKey: ["email-snippets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_snippets")
        .select("*")
        .order("use_count", { ascending: false });
      
      if (error) throw error;
      return data as Snippet[];
    },
  });

  const createSnippet = useMutation({
    mutationFn: async (snippet: Omit<Snippet, "id" | "created_at" | "updated_at" | "use_count" | "user_id">) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("email_snippets")
        .insert({ ...snippet, user_id: user?.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-snippets"] });
      toast.success("Snippet created!");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create snippet: ${error.message}`);
    },
  });

  const updateSnippet = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Snippet> & { id: string }) => {
      const { data, error } = await supabase
        .from("email_snippets")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-snippets"] });
      toast.success("Snippet updated!");
    },
    onError: (error: Error) => {
      toast.error(`Failed to update snippet: ${error.message}`);
    },
  });

  const deleteSnippet = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("email_snippets")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-snippets"] });
      toast.success("Snippet deleted!");
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete snippet: ${error.message}`);
    },
  });

  const incrementUseCount = useMutation({
    mutationFn: async (id: string) => {
      const snippet = snippets.find(s => s.id === id);
      if (!snippet) return;
      
      const { error } = await supabase
        .from("email_snippets")
        .update({ use_count: (snippet.use_count || 0) + 1 })
        .eq("id", id);
      
      if (error) throw error;
    },
  });

  const findByShortcut = (text: string): Snippet | undefined => {
    // Find any snippet whose shortcut appears at the end of the text
    return snippets.find(s => text.endsWith(s.shortcut));
  };

  return {
    snippets,
    isLoading,
    createSnippet: createSnippet.mutate,
    updateSnippet: updateSnippet.mutate,
    deleteSnippet: deleteSnippet.mutate,
    incrementUseCount: incrementUseCount.mutate,
    findByShortcut,
    isCreating: createSnippet.isPending,
    isUpdating: updateSnippet.isPending,
  };
}
