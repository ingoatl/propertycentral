import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import {
  Wrench,
  Clock,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Camera,
  ChevronRight,
  Loader2,
  CalendarDays,
} from "lucide-react";
import WorkOrderPhotos from "@/components/maintenance/WorkOrderPhotos";

interface PropertyMaintenanceTabProps {
  propertyId: string;
  propertyName: string;
}

interface WorkOrder {
  id: string;
  work_order_number: number;
  title: string;
  description: string | null;
  status: string;
  urgency: string;
  category: string | null;
  quoted_cost: number | null;
  actual_cost: number | null;
  created_at: string;
  completed_at: string | null;
  vendors: {
    name: string;
  } | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  new: { label: "New", color: "bg-blue-100 text-blue-800", icon: AlertCircle },
  assigned: { label: "Assigned", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  scheduled: { label: "Scheduled", color: "bg-purple-100 text-purple-800", icon: CalendarDays },
  in_progress: { label: "In Progress", color: "bg-orange-100 text-orange-800", icon: Wrench },
  pending_verification: { label: "Pending Verification", color: "bg-indigo-100 text-indigo-800", icon: CheckCircle },
  completed: { label: "Completed", color: "bg-green-100 text-green-800", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-800", icon: AlertCircle },
};

export function PropertyMaintenanceTab({ propertyId, propertyName }: PropertyMaintenanceTabProps) {
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "completed" | "all">("active");

  // Fetch work orders for this property
  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ["property-work-orders", propertyId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("work_orders")
        .select(`
          id,
          work_order_number,
          title,
          description,
          status,
          urgency,
          category,
          quoted_cost,
          actual_cost,
          created_at,
          completed_at,
          vendors!work_orders_assigned_vendor_id_fkey(name)
        `)
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false });

      if (statusFilter === "active") {
        query = query.not("status", "in", '("completed","cancelled")');
      } else if (statusFilter === "completed") {
        query = query.in("status", ["completed", "cancelled"]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as WorkOrder[];
    },
  });

  // Calculate stats
  const totalCost = workOrders.reduce((sum, wo) => sum + (wo.actual_cost || wo.quoted_cost || 0), 0);
  const completedCount = workOrders.filter(wo => wo.status === "completed").length;
  const activeCount = workOrders.filter(wo => !["completed", "cancelled"].includes(wo.status)).length;

  const renderWorkOrderCard = (wo: WorkOrder) => {
    const statusConfig = STATUS_CONFIG[wo.status] || STATUS_CONFIG.new;
    const StatusIcon = statusConfig.icon;

    return (
      <Card
        key={wo.id}
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setSelectedWorkOrderId(wo.id)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground font-mono">
                  #{wo.work_order_number}
                </span>
                <Badge className={statusConfig.color} variant="secondary">
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig.label}
                </Badge>
                {wo.urgency === "emergency" && (
                  <Badge variant="destructive">Emergency</Badge>
                )}
              </div>
              <h4 className="font-medium text-sm">{wo.title}</h4>
              {wo.description && (
                <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                  {wo.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span>{format(new Date(wo.created_at), "MMM d, yyyy")}</span>
                {wo.vendors && (
                  <span className="flex items-center gap-1">
                    <Wrench className="h-3 w-3" />
                    {wo.vendors.name}
                  </span>
                )}
                {(wo.actual_cost || wo.quoted_cost) && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    ${(wo.actual_cost || wo.quoted_cost)?.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{activeCount}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">${totalCost.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Total Cost</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Work Orders List */}
      {workOrders.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Wrench className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No work orders found</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-3 pr-4">
            {workOrders.map(renderWorkOrderCard)}
          </div>
        </ScrollArea>
      )}

      {/* Work Order Photos Dialog */}
      <Dialog open={!!selectedWorkOrderId} onOpenChange={() => setSelectedWorkOrderId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Work Order Photos
            </DialogTitle>
          </DialogHeader>
          {selectedWorkOrderId && (
            <WorkOrderPhotos workOrderId={selectedWorkOrderId} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
