import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskSaveIndicatorProps {
  status: 'idle' | 'typing' | 'saving' | 'saved';
  className?: string;
}

export const TaskSaveIndicator = ({ status, className }: TaskSaveIndicatorProps) => {
  if (status === 'idle') return null;
  
  return (
    <div className={cn("flex items-center gap-1.5 text-xs", className)}>
      {status === 'typing' && (
        <>
          <Clock className="h-3 w-3 text-yellow-500" />
          <span className="text-muted-foreground">Unsaved changes</span>
        </>
      )}
      {status === 'saving' && (
        <>
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          <span className="text-muted-foreground">Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          <span className="text-muted-foreground">Saved</span>
        </>
      )}
    </div>
  );
};
