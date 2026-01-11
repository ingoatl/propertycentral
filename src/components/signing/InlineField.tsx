import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon, Check, Lock, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { GooglePlacesAutocomplete } from "@/components/ui/google-places-autocomplete";

export interface FieldData {
  api_id: string;
  label: string;
  type: "text" | "date" | "email" | "phone" | "signature" | "checkbox" | "radio";
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  filled_by: "admin" | "guest";
  required: boolean;
  group_name?: string; // For radio buttons - fields with same group_name are mutually exclusive
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

  const fontSize = Math.max(10, Math.min(12, 11 * scale));
  const fontFamily = "'Lato', 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif";

  // Compact field heights based on type
  const getFieldHeight = () => {
    if (field.type === "signature") return "h-[50px] max-h-[50px]";
    if (field.type === "checkbox" || field.type === "radio") return "h-[22px] max-h-[22px] w-[22px] max-w-[22px]";
    return "h-[24px] max-h-[24px]"; // text, date, email, phone
  };

  // DocuSign-style field wrapper classes
  const baseFieldClass = "transition-all duration-150";
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
            "w-full h-[50px] rounded flex items-center justify-center"
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
              <span>Awaiting</span>
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
          "w-full h-[50px] rounded flex items-center justify-center cursor-pointer"
        )}
        style={{ fontSize, fontFamily }}
      >
        {hasSignature ? (
          <div className="relative w-full h-full flex items-center justify-center p-1">
            <img 
              src={signatureData || (value as string)} 
              alt="Signature" 
              className="max-h-[40px] max-w-full object-contain" 
            />
            <div className="absolute top-0 right-0 bg-green-500 rounded-full p-0.5">
              <Check className="h-2 w-2 text-white" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[#b8860b] font-semibold text-xs">
            <Pencil className="h-3 w-3" />
            <span>Sign</span>
          </div>
        )}
      </button>
    );
  }

  if (field.type === "checkbox" || field.type === "radio") {
    const isSelected = value === true;
    
    return (
      <button 
        type="button"
        onClick={() => {
          if (!isReadOnly) {
            if (field.type === "radio") {
              onChange(true);
            } else {
              onChange(!isSelected);
            }
          }
        }}
        disabled={isReadOnly}
        className={cn(
          "flex items-center justify-center cursor-pointer",
          "w-[22px] h-[22px]",
          isReadOnly ? "opacity-60 cursor-not-allowed" : "hover:bg-[#fff5cc]",
          isSelected ? completedClass : pendingClass,
          "rounded transition-all duration-150"
        )}
      >
        <div className={cn(
          "flex items-center justify-center",
          field.type === "radio" ? "rounded-full" : "rounded",
          "h-4 w-4 border-2 transition-colors",
          isSelected 
            ? "border-[#4caf50] bg-[#4caf50]" 
            : "border-[#fae052] bg-white"
        )}>
          {isSelected && (
            field.type === "radio" 
              ? <div className="w-1.5 h-1.5 rounded-full bg-white" />
              : <Check className="h-2.5 w-2.5 text-white" />
          )}
        </div>
      </button>
    );
  }

  if (field.type === "date") {
    const dateValue = value ? new Date(value as string) : undefined;
    
    if (isReadOnly) {
      return (
        <div 
          className={cn(baseFieldClass, readOnlyClass, "w-full h-[24px] flex items-center px-1.5 rounded text-[#666]")}
          style={{ fontSize, fontFamily }}
        >
          <Lock className="h-2.5 w-2.5 mr-1 flex-shrink-0 text-[#999]" />
          <span className="truncate">{dateValue ? format(dateValue, "MM/dd/yy") : "—"}</span>
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
              "w-full h-[24px] flex items-center justify-between px-1.5 rounded cursor-pointer"
            )}
            style={{ fontSize, fontFamily }}
          >
            <span className={cn(dateValue ? "text-[#333]" : "text-[#b8860b]", "text-xs")}>
              {dateValue ? format(dateValue, "MM/dd/yy") : "Date"}
            </span>
            {isCompleted ? (
              <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
            ) : (
              <CalendarIcon className="h-3 w-3 text-[#b8860b] flex-shrink-0" />
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

  // Check if field is an address field
  const isAddressField = () => {
    const label = field.label.toLowerCase();
    const apiId = field.api_id.toLowerCase();
    return label.includes("address") || apiId.includes("address") ||
           label.includes("property location") || apiId.includes("property_location");
  };

  // Text, email, phone fields
  if (isReadOnly) {
    return (
      <div 
        className={cn(baseFieldClass, readOnlyClass, "w-full h-[24px] flex items-center px-1.5 rounded text-[#666]")}
        style={{ fontSize, fontFamily }}
      >
        <Lock className="h-2.5 w-2.5 mr-1 flex-shrink-0 text-[#999]" />
        <span className="truncate text-xs">{(value as string) || "—"}</span>
      </div>
    );
  }

  if (isActive) {
    // Use Google Places Autocomplete for address fields
    if (isAddressField()) {
      return (
        <div className="relative" style={{ fontSize, fontFamily }}>
          <GooglePlacesAutocomplete
            value={(value as string) || ""}
            onChange={(val) => {
              onChange(val);
            }}
            onPlaceSelect={(place) => {
              onChange(place.formattedAddress);
              onBlur();
            }}
            placeholder={field.label}
            className={cn(baseFieldClass, activeClass, "w-full h-[24px] px-1.5 rounded text-xs")}
          />
        </div>
      );
    }
    
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
        className={cn(baseFieldClass, activeClass, "w-full h-[24px] px-1.5 rounded text-xs")}
        style={{ fontSize, fontFamily }}
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
        "w-full h-[24px] flex items-center px-1.5 rounded text-left cursor-pointer"
      )}
      style={{ fontSize, fontFamily }}
    >
      {value ? (
        <span className="truncate text-[#333] flex-1 text-xs">{value as string}</span>
      ) : (
        <span className="text-[#b8860b] truncate flex-1 text-xs">{field.label}</span>
      )}
      {isCompleted && <Check className="h-3 w-3 ml-1 text-green-600 flex-shrink-0" />}
    </button>
  );
}

export default InlineField;
