import React from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface YesNoToggleProps {
  value: boolean | null;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export const YesNoToggle: React.FC<YesNoToggleProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  return (
    <div className="flex gap-2">
      {/* Yes Button */}
      <button
        type="button"
        onClick={() => onChange(true)}
        disabled={disabled}
        className={cn(
          "flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl font-medium text-sm",
          "transition-all duration-200 active:scale-95",
          "min-w-[72px]",
          value === true
            ? "bg-green-500 text-white shadow-lg shadow-green-500/30"
            : "bg-muted text-muted-foreground hover:bg-muted/80",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <Check className="h-4 w-4" />
        Yes
      </button>
      
      {/* No Button */}
      <button
        type="button"
        onClick={() => onChange(false)}
        disabled={disabled}
        className={cn(
          "flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl font-medium text-sm",
          "transition-all duration-200 active:scale-95",
          "min-w-[72px]",
          value === false
            ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
            : "bg-muted text-muted-foreground hover:bg-muted/80",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <X className="h-4 w-4" />
        No
      </button>
    </div>
  );
};
