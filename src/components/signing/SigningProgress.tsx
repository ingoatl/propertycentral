import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Field {
  api_id: string;
  label: string;
  type: string;
  page: number;
  required: boolean;
}

interface SigningProgressProps {
  fields: Field[];
  completedFields: Set<string>;
  signatureData: string | null;
  currentPage: number;
  onNavigateToField: (field: Field) => void;
  onStart: () => void;
  onNext: () => void;
}

export function SigningProgress({
  fields,
  completedFields,
  signatureData,
  currentPage,
  onNavigateToField,
  onStart,
  onNext,
}: SigningProgressProps) {
  const [expanded, setExpanded] = useState(false);

  const isFieldComplete = (field: Field) => {
    if (field.type === "signature") {
      return !!signatureData;
    }
    return completedFields.has(field.api_id);
  };

  const completedCount = fields.filter(isFieldComplete).length;
  const totalCount = fields.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  
  const nextIncompleteField = fields.find(f => !isFieldComplete(f));
  const allComplete = completedCount === totalCount;

  // Group fields by page
  const fieldsByPage = fields.reduce((acc, field) => {
    if (!acc[field.page]) acc[field.page] = [];
    acc[field.page].push(field);
    return acc;
  }, {} as Record<number, Field[]>);

  return (
    <div className="bg-[#2d2d2d] border-b border-white/10">
      {/* Progress bar row */}
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!allComplete && nextIncompleteField && (
            <Button
              onClick={completedCount === 0 ? onStart : onNext}
              size="sm"
              className="bg-[#fae052] text-black hover:bg-[#f5d93a] font-semibold h-7 text-xs"
            >
              {completedCount === 0 ? "START" : "NEXT"}
            </Button>
          )}
          
          <div className="flex items-center gap-2">
            <div className="w-24 sm:w-32 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#fae052] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-white/70 text-xs whitespace-nowrap">
              {completedCount}/{totalCount} done
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="text-white/70 hover:text-white hover:bg-white/10 h-7 px-2"
        >
          <span className="text-xs mr-1 hidden sm:inline">Fields</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>

      {/* Expanded field list */}
      {expanded && (
        <div className="px-4 pb-3 max-h-48 overflow-y-auto">
          <div className="space-y-2">
            {Object.entries(fieldsByPage).map(([page, pageFields]) => (
              <div key={page}>
                <div className="text-xs text-white/40 mb-1">Page {page}</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                  {pageFields.map(field => {
                    const complete = isFieldComplete(field);
                    const isOnCurrentPage = parseInt(page) === currentPage;
                    
                    return (
                      <button
                        key={field.api_id}
                        onClick={() => onNavigateToField(field)}
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors",
                          complete
                            ? "bg-green-500/20 text-green-400"
                            : isOnCurrentPage
                              ? "bg-[#fae052]/20 text-[#fae052]"
                              : "bg-white/5 text-white/60 hover:bg-white/10"
                        )}
                      >
                        {complete ? (
                          <Check className="h-3 w-3 flex-shrink-0" />
                        ) : (
                          <Circle className="h-3 w-3 flex-shrink-0" />
                        )}
                        <span className="truncate">{field.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default SigningProgress;
