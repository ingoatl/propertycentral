import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Check, Lock, Pencil } from "lucide-react";
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

  const fontSize = Math.max(11, Math.min(14, 13 * scale));

  // DocuSign-style field wrapper classes
  const baseFieldClass = "w-full transition-all duration-150";
  const pendingClass = "bg-[#fff8dc] border-2 border-[#fae052] hover:bg-[#fff5cc]";
  const completedClass = "bg-[#e8f5e9] border-2 border-[#4caf50]";
  const activeClass = "bg-white border-2 border-[#2196f3] shadow-lg ring-2 ring-[#2196f3]/20";
  const readOnlyClass = "bg-[#f5f5f5] border border-[#ddd]";

  if (field.type === "signature") {
    const hasSignature = signatureData || (typeof value === "string" && value.startsWith("data:"));
    
    if (isReadOnly) {
      return (
        <div 
          className={cn(
            baseFieldClass, 
            readOnlyClass,
            "h-full min-h-[50px] rounded flex items-center justify-center"
          )}
        >
          {hasSignature ? (
            <img 
              src={signatureData || (value as string)} 
              alt="Signature" 
              className="max-h-[40px] max-w-full object-contain" 
            />
          ) : (
            <div className="flex items-center gap-1 text-[#999] text-xs">
              <Lock className="h-3 w-3" />
              <span>Awaiting signature</span>
            </div>
          )}
        </div>
      );
    }
    
    return (
      <button
        onClick={onSignatureClick}
        className={cn(
          baseFieldClass,
          hasSignature ? completedClass : pendingClass,
          "h-full min-h-[50px] rounded flex items-center justify-center cursor-pointer"
        )}
        style={{ fontSize }}
      >
        {hasSignature ? (
          <div className="relative w-full h-full flex items-center justify-center p-1">
            <img 
              src={signatureData || (value as string)} 
              alt="Signature" 
              className="max-h-[45px] max-w-full object-contain" 
            />
            <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
              <Check className="h-2.5 w-2.5 text-white" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[#b8860b] font-semibold">
            <Pencil className="h-4 w-4" />
            <span>Sign</span>
          </div>
        )}
      </button>
    );
  }

  if (field.type === "checkbox") {
    return (
      <button 
        type="button"
        onClick={() => {
          if (!isReadOnly) {
            onChange(value !== true);
          }
        }}
        disabled={isReadOnly}
        className={cn(
          "flex items-center justify-center h-full w-full cursor-pointer",
          isReadOnly ? "opacity-60 cursor-not-allowed" : "hover:bg-[#fff5cc]",
          value === true ? completedClass : pendingClass,
          "rounded transition-all duration-150"
        )}
      >
        <Checkbox
          checked={value === true}
          onCheckedChange={(checked) => !isReadOnly && onChange(checked === true)}
          disabled={isReadOnly}
          className={cn(
            "h-6 w-6 rounded pointer-events-none",
            value === true ? "border-[#4caf50] bg-[#4caf50] text-white" : "border-[#fae052] border-2 bg-white"
          )}
        />
        {value === true && (
          <Check className="h-3 w-3 text-green-600 ml-1" />
        )}
      </button>
    );
  }

  if (field.type === "date") {
    const dateValue = value ? new Date(value as string) : undefined;
    
    if (isReadOnly) {
      return (
        <div 
          className={cn(baseFieldClass, readOnlyClass, "h-full flex items-center px-2 rounded text-[#666]")}
          style={{ fontSize }}
        >
          <Lock className="h-3 w-3 mr-1.5 flex-shrink-0 text-[#999]" />
          <span className="truncate">{dateValue ? format(dateValue, "MM/dd/yyyy") : "—"}</span>
        </div>
      );
    }

    return (
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          <button
            onClick={() => setDateOpen(true)}
            className={cn(
              baseFieldClass,
              isCompleted ? completedClass : pendingClass,
              "h-full flex items-center justify-between px-2 rounded cursor-pointer"
            )}
            style={{ fontSize }}
          >
            <span className={cn(dateValue ? "text-[#333]" : "text-[#b8860b]")}>
              {dateValue ? format(dateValue, "MM/dd/yyyy") : "Select date"}
            </span>
            {isCompleted ? (
              <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
            ) : (
              <CalendarIcon className="h-3.5 w-3.5 text-[#b8860b] flex-shrink-0" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 pointer-events-auto z-[200]" align="start" sideOffset={5}>
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
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    );
  }

  // Text, email, phone fields
  if (isReadOnly) {
    return (
      <div 
        className={cn(baseFieldClass, readOnlyClass, "h-full flex items-center px-2 rounded text-[#666]")}
        style={{ fontSize }}
      >
        <Lock className="h-3 w-3 mr-1.5 flex-shrink-0 text-[#999]" />
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
            e.preventDefault();
            onBlur();
          }
        }}
        placeholder={field.label}
        className={cn(baseFieldClass, activeClass, "h-full px-2 rounded")}
        style={{ fontSize }}
        autoFocus
      />
    );
  }

  // Inactive clickable state
  return (
    <button
      onClick={onFocus}
      className={cn(
        baseFieldClass,
        isCompleted ? completedClass : pendingClass,
        "h-full flex items-center px-2 rounded text-left cursor-pointer"
      )}
      style={{ fontSize }}
    >
      {value ? (
        <span className="truncate text-[#333] flex-1">{value as string}</span>
      ) : (
        <span className="text-[#b8860b] truncate flex-1">Enter {field.label.toLowerCase()}</span>
      )}
      {isCompleted && <Check className="h-3.5 w-3.5 ml-1 text-green-600 flex-shrink-0" />}
    </button>
  );
}

export default InlineField;
