import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, AlertTriangle, FileText } from "lucide-react";
import { validateVisitForReconciliation, checkVisitReconciliationSync } from "@/lib/visitDataValidation";
import { format } from "date-fns";

interface VisitReconciliationStatusProps {
  visitId?: string;
  propertyId?: string;
  showAll?: boolean;
}

export const VisitReconciliationStatus = ({
  visitId,
  propertyId,
  showAll = false,
}: VisitReconciliationStatusProps) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["visit-reconciliation-status", visitId, propertyId, showAll],
    queryFn: async () => {
      let query = supabase
        .from("visits")
        .select(`
          *,
          properties(name, address)
        `)
        .order("date", { ascending: false });

      if (visitId) {
        query = query.eq("id", visitId);
      } else if (propertyId) {
        query = query.eq("property_id", propertyId);
      }

      if (!showAll && !visitId) {
        query = query.limit(50);
      }

      const { data: visits, error: visitsError } = await query;
      if (visitsError) throw visitsError;

      // Get reconciliation line items for these visits
      const visitIds = visits?.map((v) => v.id) || [];
      const { data: lineItems, error: lineItemsError } = await supabase
        .from("reconciliation_line_items")
        .select(`
          *,
          monthly_reconciliations(
            id,
            reconciliation_month,
            status,
            net_to_owner
          )
        `)
        .eq("item_type", "visit")
        .in("item_id", visitIds);

      if (lineItemsError) throw lineItemsError;

      // Validate and sync check
      const results = visits?.map((visit) => {
        const validation = validateVisitForReconciliation(visit);
        const relatedLineItems = lineItems?.filter(
          (li) => li.item_id === visit.id
        ) || [];

        const syncResults = relatedLineItems.map((li) =>
          checkVisitReconciliationSync(visit, li)
        );

        return {
          visit,
          validation,
          reconciliations: relatedLineItems.map((li, idx) => ({
            lineItem: li,
            reconciliation: (li as any).monthly_reconciliations,
            syncStatus: syncResults[idx],
          })),
          isInReconciliation: relatedLineItems.length > 0,
          isVerified: relatedLineItems.some((li) => li.verified),
        };
      });

      return results || [];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load visit reconciliation status: {(error as Error).message}
        </AlertDescription>
      </Alert>
    );
  }

  const validVisits = data?.filter((d: any) => d.validation.isValid) || [];
  const invalidVisits = data?.filter((d: any) => !d.validation.isValid) || [];
  const reconciledVisits = data?.filter((d: any) => d.isInReconciliation) || [];
  const unsynced = data?.filter(
    (d: any) =>
      d.reconciliations.some((r: any) => !r.syncStatus.isSynced)
  ) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Visit Reconciliation Status
        </CardTitle>
        <CardDescription>
          Data validation and synchronization between visits and owner statements
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 border rounded-lg">
            <div className="text-2xl font-bold text-foreground">{data?.length || 0}</div>
            <div className="text-xs text-muted-foreground">Total Visits</div>
          </div>
          <div className="p-3 border rounded-lg">
            <div className="text-2xl font-bold text-green-600">{validVisits.length}</div>
            <div className="text-xs text-muted-foreground">Valid</div>
          </div>
          <div className="p-3 border rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{reconciledVisits.length}</div>
            <div className="text-xs text-muted-foreground">Reconciled</div>
          </div>
          <div className="p-3 border rounded-lg">
            <div className="text-2xl font-bold text-amber-600">{unsynced.length}</div>
            <div className="text-xs text-muted-foreground">Needs Sync</div>
          </div>
        </div>

        {/* Validation Errors */}
        {invalidVisits && invalidVisits.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold mb-2">
                {invalidVisits.length} visit(s) have validation errors:
              </div>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {invalidVisits.slice(0, 5).map((item, idx) => (
                  <li key={idx}>
                    Visit on {item.visit.date}: {item.validation.errors[0]}
                  </li>
                ))}
                {invalidVisits.length > 5 && (
                  <li className="text-muted-foreground">
                    ...and {invalidVisits.length - 5} more
                  </li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Sync Issues */}
        {unsynced.length > 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold mb-2">
                {unsynced.length} visit(s) have synchronization issues:
              </div>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {unsynced.slice(0, 5).map((item, idx) => (
                  <li key={idx}>
                    Visit on {item.visit.date}: {item.reconciliations[0]?.syncStatus.mismatches[0]}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Visit Details List */}
        <div className="space-y-2">
          <div className="font-semibold text-sm text-muted-foreground">
            Recent Visits
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data?.slice(0, 10).map((item: any) => (
              <div
                key={item.visit.id}
                className="p-3 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium truncate">
                        {(item.visit as any).properties?.name}
                      </span>
                      {item.validation.isValid ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(item.visit.date), "MMM d, yyyy")} at {item.visit.time}
                    </div>
                    <div className="text-sm font-medium">
                      ${Number(item.visit.price).toFixed(2)}
                      {item.visit.visited_by && (
                        <span className="text-muted-foreground ml-2">
                          • {item.visit.visited_by}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    {item.isInReconciliation ? (
                      <Badge variant={item.isVerified ? "default" : "secondary"}>
                        {item.isVerified ? "Verified" : "In Reconciliation"}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Not Reconciled</Badge>
                    )}
                    {item.reconciliations.map((rec, idx) => (
                      <div key={idx} className="text-xs text-muted-foreground">
                        {format(new Date(rec.reconciliation.reconciliation_month), "MMM yyyy")}
                      </div>
                    ))}
                  </div>
                </div>
                {!item.validation.isValid && (
                  <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
                    {item.validation.errors.join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
