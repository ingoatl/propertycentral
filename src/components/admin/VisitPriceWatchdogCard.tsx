import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface PriceMismatch {
  visit_id: string;
  property_name: string;
  visit_date: string;
  entered_price: number;
  correct_price: number;
  visited_by: string | null;
  difference: number;
}

export const VisitPriceWatchdogCard = () => {
  const queryClient = useQueryClient();

  const { data: mismatches, isLoading, refetch } = useQuery({
    queryKey: ["visit-price-mismatches"],
    queryFn: async () => {
      // Check for visits where the price doesn't match property's visit_price + hourly
      const { data, error } = await supabase
        .from("visits")
        .select(`
          id,
          date,
          price,
          hours,
          visited_by,
          properties!inner(name, visit_price)
        `)
        .order("date", { ascending: false });

      if (error) throw error;

      const HOURLY_RATE = 50;
      const mismatches: PriceMismatch[] = [];

      (data || []).forEach((visit: any) => {
        const basePrice = Number(visit.properties.visit_price) || 0;
        const hours = Number(visit.hours) || 0;
        const expectedPrice = basePrice + (hours * HOURLY_RATE);
        const actualPrice = Number(visit.price);

        if (Math.abs(actualPrice - expectedPrice) > 0.01) {
          mismatches.push({
            visit_id: visit.id,
            property_name: visit.properties.name,
            visit_date: visit.date,
            entered_price: actualPrice,
            correct_price: expectedPrice,
            visited_by: visit.visited_by,
            difference: actualPrice - expectedPrice,
          });
        }
      });

      return mismatches;
    },
    refetchInterval: 30000, // Check every 30 seconds
  });

  const fixPriceMutation = useMutation({
    mutationFn: async (mismatch: PriceMismatch) => {
      const { error } = await supabase
        .from("visits")
        .update({ price: mismatch.correct_price })
        .eq("id", mismatch.visit_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visit-price-mismatches"] });
      toast.success("Visit price corrected");
    },
    onError: (error: any) => {
      toast.error(`Failed to fix price: ${error.message}`);
    },
  });

  const fixAllMutation = useMutation({
    mutationFn: async () => {
      if (!mismatches || mismatches.length === 0) return;

      for (const mismatch of mismatches) {
        const { error } = await supabase
          .from("visits")
          .update({ price: mismatch.correct_price })
          .eq("id", mismatch.visit_id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visit-price-mismatches"] });
      toast.success("All visit prices corrected");
    },
    onError: (error: any) => {
      toast.error(`Failed to fix prices: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            Visit Price Watchdog
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Checking for price mismatches...</p>
        </CardContent>
      </Card>
    );
  }

  const hasMismatches = mismatches && mismatches.length > 0;

  return (
    <Card className={hasMismatches ? "border-destructive" : "border-green-500"}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              {hasMismatches ? (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-600" />
              )}
              Visit Price Watchdog
            </CardTitle>
            <CardDescription>
              {hasMismatches
                ? `${mismatches.length} visit(s) with incorrect pricing`
                : "All visit prices match property configuration"}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            {hasMismatches && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => fixAllMutation.mutate()}
                disabled={fixAllMutation.isPending}
              >
                Fix All
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {hasMismatches && (
        <CardContent className="pt-0">
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {mismatches.map((mismatch) => (
              <div
                key={mismatch.visit_id}
                className="flex items-center justify-between p-3 bg-destructive/5 rounded-lg border border-destructive/20"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{mismatch.property_name}</span>
                    <Badge variant="outline" className="text-xs">
                      {format(new Date(mismatch.visit_date), "MMM d, yyyy")}
                    </Badge>
                    {mismatch.visited_by && (
                      <span className="text-xs text-muted-foreground">
                        by {mismatch.visited_by}
                      </span>
                    )}
                  </div>
                  <div className="text-sm mt-1">
                    <span className="text-destructive line-through">${mismatch.entered_price.toFixed(2)}</span>
                    <span className="mx-2">→</span>
                    <span className="text-green-600 font-medium">${mismatch.correct_price.toFixed(2)}</span>
                    <span className="text-muted-foreground ml-2">
                      ({mismatch.difference > 0 ? "+" : ""}${mismatch.difference.toFixed(2)})
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fixPriceMutation.mutate(mismatch)}
                  disabled={fixPriceMutation.isPending}
                >
                  Fix
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
};
