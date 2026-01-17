import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FollowUpReminder {
  id: string;
  lead_id: string | null;
  owner_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  remind_at: string;
  original_sent_at: string | null;
  original_message_id: string | null;
  reminder_type: string | null;
  suggested_draft: string | null;
  ai_generated_followup: string | null;
  status: string | null;
  completed_at: string | null;
  dismissed_at: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useFollowUpReminders() {
  const queryClient = useQueryClient();

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ["follow-up-reminders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follow_up_reminders")
        .select("*")
        .is("completed_at", null)
        .is("dismissed_at", null)
        .order("remind_at", { ascending: true });
      
      if (error) throw error;
      return data as FollowUpReminder[];
    },
  });

  const dueReminders = reminders.filter(
    r => new Date(r.remind_at) <= new Date()
  );

  const upcomingReminders = reminders.filter(
    r => new Date(r.remind_at) > new Date()
  );

  const createReminder = useMutation({
    mutationFn: async (reminder: Partial<FollowUpReminder>) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const insertData = {
        contact_name: reminder.contact_name,
        contact_email: reminder.contact_email,
        contact_phone: reminder.contact_phone,
        remind_at: reminder.remind_at!,
        suggested_draft: reminder.suggested_draft,
        reminder_type: reminder.reminder_type,
        user_id: user?.id,
      };
      
      const { data, error } = await supabase
        .from("follow_up_reminders")
        .insert(insertData)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-up-reminders"] });
      toast.success("Follow-up reminder created!");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create reminder: ${error.message}`);
    },
  });

  const completeReminder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("follow_up_reminders")
        .update({ completed_at: new Date().toISOString(), status: "completed" })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-up-reminders"] });
      toast.success("Follow-up marked complete!");
    },
    onError: (error: Error) => {
      toast.error(`Failed to complete reminder: ${error.message}`);
    },
  });

  const dismissReminder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("follow_up_reminders")
        .update({ dismissed_at: new Date().toISOString(), status: "dismissed" })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-up-reminders"] });
      toast.success("Reminder dismissed");
    },
    onError: (error: Error) => {
      toast.error(`Failed to dismiss reminder: ${error.message}`);
    },
  });

  const snoozeReminder = useMutation({
    mutationFn: async ({ id, hours }: { id: string; hours: number }) => {
      const newRemindAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      
      const { error } = await supabase
        .from("follow_up_reminders")
        .update({ remind_at: newRemindAt })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-up-reminders"] });
      toast.success("Reminder snoozed");
    },
    onError: (error: Error) => {
      toast.error(`Failed to snooze reminder: ${error.message}`);
    },
  });

  return {
    reminders,
    dueReminders,
    upcomingReminders,
    isLoading,
    createReminder: createReminder.mutate,
    completeReminder: completeReminder.mutate,
    dismissReminder: dismissReminder.mutate,
    snoozeReminder: snoozeReminder.mutate,
    isCreating: createReminder.isPending,
  };
}
