import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Check, Lock, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FieldData {
  api_id: string;
  label: string;
  type: "text" | "date" | "email" | "phone" | "signature" | "checkbox";
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  filled_by: "admin" | "guest";
  required: boolean;
}

interface InlineFieldProps {
  field: FieldData;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
  isActive: boolean;
  isCompleted: boolean;
  isReadOnly: boolean;
  signatureData?: string | null;
  onFocus: () => void;
  onBlur: () => void;
  onSignatureClick: () => void;
  scale: number;
}

export function InlineField({
  field,
  value,
  onChange,
  isActive,
  isCompleted,
  isReadOnly,
  signatureData,
  onFocus,
  onBlur,
  onSignatureClick,
  scale,
}: InlineFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dateOpen, setDateOpen] = useState(false);

  useEffect(() => {
    if (isActive && inputRef.current && field.type !== "signature" && field.type !== "checkbox" && field.type !== "date") {
      inputRef.current.focus();
    }
  }, [isActive, field.type]);

  // Calculate dynamic font size based on scale
  const fontSize = Math.max(10, Math.min(14, 12 * scale));

  if (field.type === "signature") {
    const hasSignature = signatureData || (typeof value === "string" && value.startsWith("data:"));
    
    return (
      <button
        onClick={isReadOnly ? undefined : onSignatureClick}
        disabled={isReadOnly}
        className={cn(
          "w-full h-full min-h-[40px] border-2 border-dashed rounded flex items-center justify-center transition-all",
          isReadOnly
            ? "border-muted bg-muted/20 cursor-not-allowed"
            : hasSignature
              ? "border-green-500 bg-green-50"
              : "border-[#fae052] bg-[#fae052]/10 hover:bg-[#fae052]/20"
        )}
        style={{ fontSize }}
      >
        {hasSignature ? (
          <img 
            src={signatureData || (value as string)} 
            alt="Signature" 
            className="max-h-full max-w-full object-contain p-1" 
          />
        ) : isReadOnly ? (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Lock className="h-3 w-3" />
            <span className="text-xs">Pending</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[#b8860b] font-medium animate-pulse">
            <Edit3 className="h-4 w-4" />
            <span>Sign Here</span>
          </div>
        )}
      </button>
    );
  }

  if (field.type === "checkbox") {
    return (
      <div 
        className={cn(
          "flex items-center justify-center w-full h-full",
          isReadOnly ? "opacity-60" : ""
        )}
      >
        <Checkbox
          checked={value === true}
          onCheckedChange={(checked) => !isReadOnly && onChange(checked === true)}
          disabled={isReadOnly}
          className={cn(
            "h-5 w-5",
            !isReadOnly && !value && "border-[#fae052] bg-[#fae052]/10"
          )}
        />
      </div>
    );
  }

  if (field.type === "date") {
    const dateValue = value ? new Date(value as string) : undefined;
    
    if (isReadOnly) {
      return (
        <div 
          className="w-full h-full flex items-center px-2 bg-muted/30 rounded border border-muted text-muted-foreground"
          style={{ fontSize }}
        >
          <Lock className="h-3 w-3 mr-1 flex-shrink-0" />
          <span className="truncate">{dateValue ? format(dateValue, "MM/dd/yyyy") : "—"}</span>
        </div>
      );
    }

    return (
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          <button
            onClick={() => !isReadOnly && setDateOpen(true)}
            className={cn(
              "w-full h-full flex items-center justify-between px-2 rounded border-2 transition-all",
              isCompleted
                ? "border-green-500 bg-green-50"
                : "border-[#fae052] bg-[#fae052]/10 border-dashed hover:bg-[#fae052]/20"
            )}
            style={{ fontSize }}
          >
            <span className={cn(dateValue ? "text-foreground" : "text-muted-foreground")}>
              {dateValue ? format(dateValue, "MM/dd/yyyy") : "Select date"}
            </span>
            {isCompleted ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <CalendarIcon className="h-3 w-3 text-[#b8860b]" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={(date) => {
              if (date) {
                onChange(format(date, "yyyy-MM-dd"));
                setDateOpen(false);
              }
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Text, email, phone fields
  if (isReadOnly) {
    return (
      <div 
        className="w-full h-full flex items-center px-2 bg-muted/30 rounded border border-muted text-muted-foreground"
        style={{ fontSize }}
      >
        <Lock className="h-3 w-3 mr-1 flex-shrink-0" />
        <span className="truncate">{(value as string) || "—"}</span>
      </div>
    );
  }

  if (isActive) {
    return (
      <Input
        ref={inputRef}
        type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}
        value={(value as string) || ""}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Tab") {
            onBlur();
          }
        }}
        placeholder={field.label}
        className="w-full h-full border-2 border-blue-500 bg-white shadow-lg"
        style={{ fontSize }}
        autoFocus
      />
    );
  }

  // Inactive state - show as clickable field
  return (
    <button
      onClick={onFocus}
      className={cn(
        "w-full h-full flex items-center px-2 rounded border-2 transition-all text-left",
        isCompleted
          ? "border-green-500 bg-green-50"
          : "border-[#fae052] bg-[#fae052]/10 border-dashed hover:bg-[#fae052]/20"
      )}
      style={{ fontSize }}
    >
      {value ? (
        <span className="truncate text-foreground">{value as string}</span>
      ) : (
        <span className="text-muted-foreground truncate">Click to enter {field.label.toLowerCase()}</span>
      )}
      {isCompleted && <Check className="h-3 w-3 ml-auto text-green-600 flex-shrink-0" />}
    </button>
  );
}

export default InlineField;
