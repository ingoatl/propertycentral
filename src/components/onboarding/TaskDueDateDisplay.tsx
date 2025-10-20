import { Button } from "@/components/ui/button";
import { Calendar, AlertCircle } from "lucide-react";
import { format, formatDistanceToNow, isPast, isFuture, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

interface TaskDueDateDisplayProps {
  dueDate?: string | null;
  status: string;
  onClick: () => void;
}

export const TaskDueDateDisplay = ({ dueDate, status, onClick }: TaskDueDateDisplayProps) => {
  if (!dueDate) return null;

  const date = new Date(dueDate);
  const isOverdue = isPast(date) && status !== "completed";
  const daysUntil = differenceInDays(date, new Date());
  const isSoon = daysUntil >= 0 && daysUntil <= 3;

  const getRelativeText = () => {
    if (isOverdue) {
      return `${Math.abs(daysUntil)} days overdue`;
    }
    if (daysUntil === 0) return "Due today";
    if (daysUntil === 1) return "Due tomorrow";
    return `Due in ${daysUntil} days`;
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 font-medium",
        isOverdue && "border-red-500 bg-red-50 text-red-700 hover:bg-red-100",
        isSoon && !isOverdue && "border-yellow-500 bg-yellow-50 text-yellow-700 hover:bg-yellow-100",
        !isOverdue && !isSoon && "border-green-500 bg-green-50 text-green-700 hover:bg-green-100"
      )}
    >
      {isOverdue && <AlertCircle className="w-4 h-4" />}
      <Calendar className="w-4 h-4" />
      <div className="flex flex-col items-start">
        <span className="text-xs font-semibold">{getRelativeText()}</span>
        <span className="text-xs font-normal opacity-80">{format(date, "MMM d, yyyy")}</span>
      </div>
    </Button>
  );
};
