import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TeamAppointment {
  id: string;
  scheduled_at: string;
  end_time: string | null;
  duration_minutes: number;
  assigned_to: string | null;
  created_by: string | null;
  appointment_type: string;
  title: string;
  description: string | null;
  property_id: string | null;
  location_address: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  lead_id: string | null;
  owner_id: string | null;
  status: string;
  google_calendar_event_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  property?: {
    id: string;
    name: string;
    address: string;
  } | null;
  assigned_profile?: {
    id: string;
    first_name: string | null;
    email: string;
  } | null;
  lead?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  owner?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
}

export const APPOINTMENT_TYPES = [
  { value: "on_site", label: "On-Site Visit", color: "bg-blue-500" },
  { value: "inspection", label: "Inspection", color: "bg-purple-500" },
  { value: "walkthrough", label: "Walkthrough", color: "bg-teal-500" },
  { value: "maintenance_check", label: "Maintenance Check", color: "bg-orange-500" },
  { value: "vendor_meeting", label: "Vendor Meeting", color: "bg-yellow-500" },
  { value: "photo_shoot", label: "Photo Shoot", color: "bg-pink-500" },
  { value: "other", label: "Other", color: "bg-gray-500" },
] as const;

export const APPOINTMENT_STATUSES = [
  { value: "scheduled", label: "Scheduled" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No Show" },
] as const;

interface UseTeamAppointmentsOptions {
  startDate?: Date;
  endDate?: Date;
  assignedTo?: string;
  propertyId?: string;
  status?: string[];
}

export function useTeamAppointments(options: UseTeamAppointmentsOptions = {}) {
  const { startDate, endDate, assignedTo, propertyId, status } = options;

  return useQuery({
    queryKey: ["team-appointments", startDate?.toISOString(), endDate?.toISOString(), assignedTo, propertyId, status],
    queryFn: async () => {
      let query = supabase
        .from("team_appointments")
        .select(`
          *,
          property:properties(id, name, address),
          assigned_profile:profiles(id, first_name, email),
          lead:leads(id, name, email, phone),
          owner:property_owners(id, name, email, phone)
        `)
        .order("scheduled_at", { ascending: true });

      if (startDate) {
        query = query.gte("scheduled_at", startDate.toISOString());
      }
      if (endDate) {
        query = query.lte("scheduled_at", endDate.toISOString());
      }
      if (assignedTo) {
        query = query.eq("assigned_to", assignedTo);
      }
      if (propertyId) {
        query = query.eq("property_id", propertyId);
      }
      if (status && status.length > 0) {
        query = query.in("status", status);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching team appointments:", error);
        throw error;
      }

      return (data || []) as unknown as TeamAppointment[];
    },
  });
}

export interface CreateAppointmentInput {
  scheduled_at: string;
  end_time?: string;
  duration_minutes?: number;
  assigned_to?: string;
  appointment_type: string;
  title: string;
  description?: string;
  property_id?: string;
  location_address?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  lead_id?: string;
  owner_id?: string;
  notes?: string;
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAppointmentInput) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        throw new Error("Not authenticated");
      }

      // Calculate end_time if not provided
      const endTime = input.end_time || 
        new Date(new Date(input.scheduled_at).getTime() + (input.duration_minutes || 60) * 60000).toISOString();

      const { data, error } = await supabase
        .from("team_appointments")
        .insert({
          ...input,
          end_time: endTime,
          created_by: session.session.user.id,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating appointment:", error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-appointments"] });
      toast.success("Appointment created successfully");
    },
    onError: (error) => {
      console.error("Failed to create appointment:", error);
      toast.error("Failed to create appointment");
    },
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TeamAppointment> & { id: string }) => {
      const { data, error } = await supabase
        .from("team_appointments")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error updating appointment:", error);
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-appointments"] });
      toast.success("Appointment updated");
    },
    onError: (error) => {
      console.error("Failed to update appointment:", error);
      toast.error("Failed to update appointment");
    },
  });
}

export function useDeleteAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("team_appointments")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error deleting appointment:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-appointments"] });
      toast.success("Appointment deleted");
    },
    onError: (error) => {
      console.error("Failed to delete appointment:", error);
      toast.error("Failed to delete appointment");
    },
  });
}
