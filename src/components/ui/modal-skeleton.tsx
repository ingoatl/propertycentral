import { cn } from "@/lib/utils";

interface ModalSkeletonProps {
  variant?: "property-details" | "task" | "default";
  className?: string;
}

export function ModalSkeleton({ variant = "default", className }: ModalSkeletonProps) {
  if (variant === "property-details") {
    return (
      <div className={cn("p-6 space-y-6 animate-in fade-in-0 duration-300", className)}>
        {/* Header skeleton */}
        <div className="space-y-3">
          <div className="h-8 w-3/4 bg-muted rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-muted/70 rounded animate-pulse" />
        </div>
        
        {/* Tabs skeleton */}
        <div className="flex gap-2 border-b pb-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 w-20 bg-muted rounded animate-pulse" />
          ))}
        </div>
        
        {/* Content skeleton */}
        <div className="space-y-4">
          {/* Property info card */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="h-5 w-32 bg-muted rounded animate-pulse" />
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-3 w-16 bg-muted/60 rounded animate-pulse" />
                  <div className="h-5 w-full bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
          
          {/* Categories */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="h-5 w-40 bg-muted rounded animate-pulse" />
              <div className="space-y-2">
                {[1, 2].map((j) => (
                  <div key={j} className="flex items-center gap-3">
                    <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                    <div className="h-4 flex-1 bg-muted/70 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "task") {
    return (
      <div className={cn("p-6 space-y-4 animate-in fade-in-0 duration-300", className)}>
        {/* Task header */}
        <div className="flex items-start gap-4">
          <div className="h-6 w-6 bg-muted rounded animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-3/4 bg-muted rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-muted/70 rounded animate-pulse" />
          </div>
          <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
        </div>
        
        {/* Description */}
        <div className="space-y-2 pl-10">
          <div className="h-4 w-full bg-muted/60 rounded animate-pulse" />
          <div className="h-4 w-4/5 bg-muted/60 rounded animate-pulse" />
        </div>
        
        {/* Form fields */}
        <div className="space-y-4 pt-4 border-t">
          <div className="space-y-2">
            <div className="h-3 w-24 bg-muted/60 rounded animate-pulse" />
            <div className="h-10 w-full bg-muted rounded animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-20 bg-muted/60 rounded animate-pulse" />
            <div className="h-24 w-full bg-muted rounded animate-pulse" />
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <div className="h-9 w-20 bg-muted rounded animate-pulse" />
          <div className="h-9 w-24 bg-primary/30 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // Default skeleton
  return (
    <div className={cn("p-6 space-y-4 animate-in fade-in-0 duration-300", className)}>
      <div className="h-8 w-3/4 bg-muted rounded animate-pulse" />
      <div className="h-4 w-1/2 bg-muted/70 rounded animate-pulse" />
      <div className="h-px bg-border" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 w-full bg-muted rounded animate-pulse" />
        ))}
      </div>
      <div className="h-9 w-24 bg-muted rounded animate-pulse ml-auto" />
    </div>
  );
}

export function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn("h-4 bg-muted rounded animate-pulse", className)} />;
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("border rounded-lg p-4 space-y-3", className)}>
      <div className="h-5 w-32 bg-muted rounded animate-pulse" />
      <div className="space-y-2">
        <div className="h-4 w-full bg-muted/70 rounded animate-pulse" />
        <div className="h-4 w-3/4 bg-muted/70 rounded animate-pulse" />
      </div>
    </div>
  );
}
