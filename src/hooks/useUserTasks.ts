import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface UserTask {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  priority: "urgent" | "high" | "medium" | "low";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  due_date: string | null;
  source_type: string | null;
  source_id: string | null;
  related_contact_type: string | null;
  related_contact_id: string | null;
  property_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: "urgent" | "high" | "medium" | "low";
  due_date?: string;
  source_type?: string;
  source_id?: string;
  related_contact_type?: string;
  related_contact_id?: string;
  property_id?: string;
}

export function useUserTasks() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ["user-tasks"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("user_tasks")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "cancelled")
        .order("priority", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as UserTask[];
    },
  });

  const createTask = useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("user_tasks")
        .insert({
          user_id: user.id,
          title: input.title,
          description: input.description || null,
          priority: input.priority || "medium",
          due_date: input.due_date || null,
          source_type: input.source_type || "manual",
          source_id: input.source_id || null,
          related_contact_type: input.related_contact_type || null,
          related_contact_id: input.related_contact_id || null,
          property_id: input.property_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-tasks"] });
      toast({ title: "Task created" });
    },
    onError: (error) => {
      toast({ title: "Failed to create task", description: error.message, variant: "destructive" });
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<UserTask> & { id: string }) => {
  const updateData: Record<string, unknown> = { ...updates };
      
      // Auto-set completed_at when status changes to completed
      if (updates.status === "completed" as const) {
        updateData.completed_at = new Date().toISOString();
      } else if (updates.status) {
        updateData.completed_at = null;
      }

      const { data, error } = await supabase
        .from("user_tasks")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-tasks"] });
    },
    onError: (error) => {
      toast({ title: "Failed to update task", description: error.message, variant: "destructive" });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_tasks")
        .update({ status: "cancelled" })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-tasks"] });
      toast({ title: "Task removed" });
    },
    onError: (error) => {
      toast({ title: "Failed to delete task", description: error.message, variant: "destructive" });
    },
  });

  const completeTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_tasks")
        .update({ 
          status: "completed",
          completed_at: new Date().toISOString()
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-tasks"] });
      toast({ title: "Task completed! 🎉" });
    },
    onError: (error) => {
      toast({ title: "Failed to complete task", description: error.message, variant: "destructive" });
    },
  });

  // Group tasks by priority and due date
  const urgentTasks = tasks.filter(t => t.priority === "urgent" && t.status !== "completed");
  const todayTasks = tasks.filter(t => {
    if (t.status === "completed" || t.priority === "urgent") return false;
    if (!t.due_date) return false;
    const today = new Date().toISOString().split("T")[0];
    return t.due_date === today;
  });
  const upcomingTasks = tasks.filter(t => {
    if (t.status === "completed" || t.priority === "urgent") return false;
    if (!t.due_date) return true; // No due date = upcoming
    const today = new Date().toISOString().split("T")[0];
    return t.due_date > today;
  });
  const completedTasks = tasks.filter(t => t.status === "completed");

  return {
    tasks,
    urgentTasks,
    todayTasks,
    upcomingTasks,
    completedTasks,
    isLoading,
    error,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
  };
}
