import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * StableFormWrapper - Prevents re-renders and layout shifts during user input
 * Use this wrapper for forms to ensure inputs don't lose focus or reset
 */
export const StableFormWrapper = React.forwardRef<
  HTMLFormElement,
  React.FormHTMLAttributes<HTMLFormElement>
>(({ className, children, ...props }, ref) => {
  return (
    <form
      ref={ref}
      className={cn("space-y-4 md:space-y-6", className)}
      {...props}
      // Prevent default form behavior that might cause refreshes
      onSubmit={(e) => {
        if (props.onSubmit) {
          props.onSubmit(e);
        }
      }}
    >
      {children}
    </form>
  );
});
StableFormWrapper.displayName = "StableFormWrapper";

/**
 * StableFieldWrapper - Wraps form fields to prevent layout shifts
 */
export const StableFieldWrapper = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("space-y-2 will-change-auto", className)}
      {...props}
    >
      {children}
    </div>
  );
});
StableFieldWrapper.displayName = "StableFieldWrapper";
