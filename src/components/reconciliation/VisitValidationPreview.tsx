import { validateVisitsBatch } from "@/lib/visitDataValidation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface VisitValidationPreviewProps {
  visits: any[];
  className?: string;
}

/**
 * Component to preview validation status of visits before adding to reconciliation
 * Used in reconciliation modal to ensure data quality
 */
export const VisitValidationPreview = ({ visits, className }: VisitValidationPreviewProps) => {
  if (!visits || visits.length === 0) {
    return null;
  }

  const { valid, invalid } = validateVisitsBatch(visits);

  if (invalid.length === 0) {
    return (
      <Alert className={className}>
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription>
          All {valid.length} visit(s) passed validation checks and are ready for reconciliation.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={className}>
      {/* Summary */}
      <div className="flex gap-2 mb-3">
        <Badge variant="default" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {valid.length} Valid
        </Badge>
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          {invalid.length} Invalid
        </Badge>
      </div>

      {/* Validation Errors */}
      {invalid.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-semibold mb-2">
              {invalid.length} visit(s) have validation errors and cannot be added:
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm max-h-40 overflow-y-auto">
              {invalid.map((item, idx) => (
                <li key={idx}>
                  <span className="font-medium">
                    Visit on {item.visit.date || "unknown date"}:
                  </span>{" "}
                  {item.errors[0]}
                </li>
              ))}
            </ul>
            <div className="mt-3 p-2 bg-background rounded text-xs">
              <strong>How to fix:</strong> Update the visit data in the Visits tab to correct the
              validation errors, then try adding to reconciliation again.
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
