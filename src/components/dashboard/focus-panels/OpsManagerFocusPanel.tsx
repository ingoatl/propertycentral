import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wrench, Calendar, MapPin, AlertTriangle, ArrowRight, Clock, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format, addHours, isToday, isTomorrow } from "date-fns";

interface OpsManagerFocusData {
  visitsToday: Array<{
    id: string;
    propertyAddress: string;
    visitType: string;
    scheduledTime: string;
  }>;
  visitsTomorrow: Array<{
    id: string;
    propertyAddress: string;
    visitType: string;
    scheduledTime: string;
  }>;
  openTickets: number;
  pendingWorkOrders: number;
  upcomingInspections: Array<{
    id: string;
    propertyAddress: string;
    scheduledAt: string;
  }>;
}

interface OpsManagerFocusPanelProps {
  userName: string;
}

export const OpsManagerFocusPanel = ({ userName }: OpsManagerFocusPanelProps) => {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["ops-manager-focus"],
    queryFn: async (): Promise<OpsManagerFocusData> => {
      const now = new Date();
      const tomorrow = addHours(now, 24);
      const dayAfterTomorrow = addHours(now, 48);

      // Get visits for today and tomorrow
      const { data: visits } = await supabase
        .from("visits")
        .select(`
          id, date, visit_type,
          properties (address)
        `)
        .gte("date", now.toISOString().split('T')[0])
        .lte("date", dayAfterTomorrow.toISOString().split('T')[0])
        .order("date", { ascending: true });

      // Get open maintenance tickets
      const { count: openTickets } = await supabase
        .from("work_orders")
        .select("id", { count: "exact" })
        .in("status", ["in_progress", "dispatched", "scheduled"]);

      // Get pending work orders
      const { count: pendingWorkOrders } = await supabase
        .from("work_orders")
        .select("id", { count: "exact" })
        .in("status", ["new", "awaiting_approval"]);

      // Get upcoming inspections (discovery calls marked as inspection)
      const { data: inspections } = await supabase
        .from("discovery_calls")
        .select(`
          id, scheduled_at,
          leads (property_address)
        `)
        .in("meeting_type", ["inspection", "virtual_inspection"])
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", dayAfterTomorrow.toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(5);

      const visitsToday = (visits || [])
        .filter((v: any) => isToday(new Date(v.date)))
        .map((v: any) => ({
          id: v.id,
          propertyAddress: v.properties?.address || "Unknown Property",
          visitType: v.visit_type,
          scheduledTime: v.date,
        }));

      const visitsTomorrow = (visits || [])
        .filter((v: any) => isTomorrow(new Date(v.date)))
        .map((v: any) => ({
          id: v.id,
          propertyAddress: v.properties?.address || "Unknown Property",
          visitType: v.visit_type,
          scheduledTime: v.date,
        }));

      const upcomingInspections = (inspections || []).map((i: any) => ({
        id: i.id,
        propertyAddress: i.leads?.property_address || "Unknown Property",
        scheduledAt: i.scheduled_at,
      }));

      return {
        visitsToday,
        visitsTomorrow,
        openTickets: openTickets || 0,
        pendingWorkOrders: pendingWorkOrders || 0,
        upcomingInspections,
      };
    },
  });

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-6">
          <div className="h-32 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const hasUrgentItems = data.openTickets > 0 || data.pendingWorkOrders > 0;
  const totalVisits = data.visitsToday.length + data.visitsTomorrow.length;

  return (
    <Card className="border-teal-200 dark:border-teal-800 bg-gradient-to-br from-teal-50/50 via-background to-background dark:from-teal-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-teal-700 dark:text-teal-300">
          <Wrench className="h-5 w-5" />
          Today's Operations
          {hasUrgentItems && (
            <Badge variant="destructive" className="ml-auto">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {data.openTickets + data.pendingWorkOrders} needs attention
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-teal-100/50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-teal-600" />
              <span className="text-xs text-muted-foreground">Today</span>
            </div>
            <p className="text-xl font-bold text-teal-700 dark:text-teal-300">{data.visitsToday.length} visits</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-100/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Tomorrow</span>
            </div>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{data.visitsTomorrow.length} visits</p>
          </div>
          {data.openTickets > 0 && (
            <div className="p-3 rounded-lg bg-red-100/50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-xs text-muted-foreground">Open</span>
              </div>
              <p className="text-xl font-bold text-red-700 dark:text-red-300">{data.openTickets} tickets</p>
            </div>
          )}
          {data.pendingWorkOrders > 0 && (
            <div className="p-3 rounded-lg bg-orange-100/50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <span className="text-xs text-muted-foreground">Pending</span>
              </div>
              <p className="text-xl font-bold text-orange-700 dark:text-orange-300">{data.pendingWorkOrders} orders</p>
            </div>
          )}
        </div>

        {/* Today's Timeline */}
        {data.visitsToday.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Today's Schedule
            </h4>
            <div className="space-y-1.5">
              {data.visitsToday.slice(0, 3).map((visit) => (
                <div 
                  key={visit.id} 
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(visit.scheduledTime), "h:mm a")}
                    </span>
                    <span className="text-sm truncate max-w-[180px]">{visit.propertyAddress}</span>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">
                    {visit.visitType}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Inspections */}
        {data.upcomingInspections.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Upcoming Inspections
            </h4>
            <div className="space-y-1.5">
              {data.upcomingInspections.slice(0, 2).map((inspection) => (
                <div 
                  key={inspection.id} 
                  className="flex items-center justify-between p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
                >
                  <span className="text-sm truncate max-w-[180px]">{inspection.propertyAddress}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(inspection.scheduledAt), "MMM d, h:mm a")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {totalVisits === 0 && data.openTickets === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm">All caught up! No urgent operations.</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            className="flex-1" 
            variant="outline"
            size="sm"
            onClick={() => navigate("/visits")}
          >
            Log Visit
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <Button 
            className="flex-1" 
            variant="outline"
            size="sm"
            onClick={() => navigate("/work-orders")}
          >
            Work Orders
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
