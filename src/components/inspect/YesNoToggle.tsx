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
    <div className="flex gap-3">
      {/* Yes Button */}
      <button
        type="button"
        onClick={() => onChange(true)}
        disabled={disabled}
        className={cn(
          "flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-base",
          "transition-all duration-200 active:scale-95",
          "min-w-[88px] min-h-[48px]",
          value === true
            ? "bg-green-500 text-white shadow-lg shadow-green-500/30"
            : "bg-muted text-muted-foreground hover:bg-muted/80",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <Check className="h-5 w-5" />
        Yes
      </button>
      
      {/* No Button */}
      <button
        type="button"
        onClick={() => onChange(false)}
        disabled={disabled}
        className={cn(
          "flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium text-base",
          "transition-all duration-200 active:scale-95",
          "min-w-[88px] min-h-[48px]",
          value === false
            ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
            : "bg-muted text-muted-foreground hover:bg-muted/80",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <X className="h-5 w-5" />
        No
      </button>
    </div>
  );
};
