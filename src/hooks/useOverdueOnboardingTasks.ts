import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OverdueOnboardingTask {
  id: string;
  title: string;
  description?: string;
  field_type: string;
  status: string;
  due_date?: string;
  phase_number: number;
  phase_title: string;
  project_id: string;
  property_id?: string;
  assigned_to_uuid?: string;
  property_name?: string;
  owner_name?: string;
  days_overdue: number;
  estimated_minutes: number;
  urgency: "critical" | "high" | "standard";
}

interface OverdueTasksGrouped {
  byProperty: Record<string, OverdueOnboardingTask[]>;
  byUrgency: {
    critical: OverdueOnboardingTask[];
    high: OverdueOnboardingTask[];
    standard: OverdueOnboardingTask[];
  };
  quickWins: OverdueOnboardingTask[];
  totalCount: number;
  propertyCount: number;
}

// Estimate minutes based on field type
function estimateMinutes(fieldType: string): number {
  switch (fieldType) {
    case "text":
    case "phone":
      return 2;
    case "checkbox":
      return 1;
    case "date":
      return 2;
    case "textarea":
      return 5;
    case "file":
      return 10;
    case "currency":
      return 3;
    case "multiselect":
    case "radio":
      return 3;
    case "section_header":
      return 0;
    default:
      return 5;
  }
}

// Determine urgency based on task title/phase
function determineUrgency(task: { title: string; phase_number: number; days_overdue: number }): "critical" | "high" | "standard" {
  const title = task.title.toLowerCase();
  
  // Critical: Owner contact info, insurance, legal
  if (
    title.includes("owner phone") ||
    title.includes("owner email") ||
    title.includes("insurance") ||
    title.includes("agreement") ||
    title.includes("contract") ||
    title.includes("emergency contact")
  ) {
    return "critical";
  }
  
  // High: Access codes, WiFi, property setup
  if (
    title.includes("wifi") ||
    title.includes("lock") ||
    title.includes("code") ||
    title.includes("access") ||
    title.includes("alarm") ||
    title.includes("gate") ||
    task.phase_number <= 2 ||
    task.days_overdue > 30
  ) {
    return "high";
  }
  
  return "standard";
}

export function useOverdueOnboardingTasks(userId?: string) {
  return useQuery({
    queryKey: ["overdue-onboarding-tasks", userId],
    queryFn: async (): Promise<OverdueTasksGrouped> => {
      const today = new Date().toISOString().split("T")[0];

      // Fetch overdue tasks with project and property info
      const { data: tasks, error } = await supabase
        .from("onboarding_tasks")
        .select(`
          id,
          title,
          description,
          field_type,
          status,
          due_date,
          phase_number,
          phase_title,
          project_id,
          assigned_to_uuid,
          onboarding_projects!inner(
            id,
            property_id,
            owner_name,
            property_address
          )
        `)
        .eq("status", "pending")
        .lt("due_date", today)
        .order("due_date", { ascending: true });

      if (error) throw error;

      // Transform and enrich tasks
      const enrichedTasks: OverdueOnboardingTask[] = (tasks || []).map((task: any) => {
        const project = task.onboarding_projects;
        const dueDate = task.due_date ? new Date(task.due_date) : new Date();
        const daysOverdue = Math.floor((new Date().getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        const estimated = estimateMinutes(task.field_type);
        
        return {
          id: task.id,
          title: task.title,
          description: task.description,
          field_type: task.field_type,
          status: task.status,
          due_date: task.due_date,
          phase_number: task.phase_number,
          phase_title: task.phase_title,
          project_id: task.project_id,
          property_id: project?.property_id,
          assigned_to_uuid: task.assigned_to_uuid,
          property_name: project?.property_address || "Unknown Property",
          owner_name: project?.owner_name,
          days_overdue: daysOverdue,
          estimated_minutes: estimated,
          urgency: determineUrgency({ title: task.title, phase_number: task.phase_number, days_overdue: daysOverdue }),
        };
      });

      // If userId provided, filter to assigned tasks (or unassigned)
      const filteredTasks = userId
        ? enrichedTasks.filter(t => !t.assigned_to_uuid || t.assigned_to_uuid === userId)
        : enrichedTasks;

      // Group by property
      const byProperty: Record<string, OverdueOnboardingTask[]> = {};
      filteredTasks.forEach(task => {
        const key = task.property_name || "Unknown";
        if (!byProperty[key]) byProperty[key] = [];
        byProperty[key].push(task);
      });

      // Group by urgency
      const byUrgency = {
        critical: filteredTasks.filter(t => t.urgency === "critical"),
        high: filteredTasks.filter(t => t.urgency === "high"),
        standard: filteredTasks.filter(t => t.urgency === "standard"),
      };

      // Quick wins: short tasks (< 5 min) that aren't file uploads
      const quickWins = filteredTasks
        .filter(t => t.estimated_minutes <= 5 && t.field_type !== "file" && t.field_type !== "section_header")
        .sort((a, b) => a.estimated_minutes - b.estimated_minutes)
        .slice(0, 10);

      return {
        byProperty,
        byUrgency,
        quickWins,
        totalCount: filteredTasks.length,
        propertyCount: Object.keys(byProperty).length,
      };
    },
  });
}
