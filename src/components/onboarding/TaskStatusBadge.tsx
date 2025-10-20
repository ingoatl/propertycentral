import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPast } from "date-fns";

interface TaskStatusBadgeProps {
  status: string;
  dueDate?: string | null;
}

export const TaskStatusBadge = ({ status, dueDate }: TaskStatusBadgeProps) => {
  const isOverdue = dueDate && isPast(new Date(dueDate)) && status !== "completed";

  if (status === "completed") {
    return (
      <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Completed
      </Badge>
    );
  }

  if (isOverdue) {
    return (
      <Badge variant="destructive">
        <AlertCircle className="w-3 h-3 mr-1" />
        Overdue
      </Badge>
    );
  }

  return (
    <Badge variant="outline">
      <Clock className="w-3 h-3 mr-1" />
      Pending
    </Badge>
  );
};
