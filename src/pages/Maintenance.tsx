import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Search, Filter, LayoutGrid, List, Wrench, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { WorkOrder, WorkOrderStatus, STATUS_CONFIG, URGENCY_CONFIG, WORK_ORDER_CATEGORIES } from "@/types/maintenance";
import CreateWorkOrderDialog from "@/components/maintenance/CreateWorkOrderDialog";
import WorkOrderCard from "@/components/maintenance/WorkOrderCard";
import WorkOrderDetailModal from "@/components/maintenance/WorkOrderDetailModal";
import WorkOrderKanban from "@/components/maintenance/WorkOrderKanban";

const Maintenance = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<WorkOrderStatus | "all">("all");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const queryClient = useQueryClient();

  const { data: workOrders = [], isLoading } = useQuery({
    queryKey: ["work-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select(`
          *,
          property:properties(id, name, address)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as any[];
    },
  });

  const filteredWorkOrders = workOrders.filter((wo) => {
    const matchesSearch = 
      wo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wo.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wo.property?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wo.property?.address?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = selectedStatus === "all" || wo.status === selectedStatus;
    const matchesCategory = !selectedCategory || wo.category === selectedCategory;
    
    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Stats
  const stats = {
    total: workOrders.length,
    new: workOrders.filter(wo => wo.status === 'new').length,
    inProgress: workOrders.filter(wo => ['dispatched', 'scheduled', 'in_progress'].includes(wo.status)).length,
    awaitingApproval: workOrders.filter(wo => wo.status === 'awaiting_approval').length,
    emergency: workOrders.filter(wo => wo.urgency === 'emergency' && wo.status !== 'completed' && wo.status !== 'cancelled').length,
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Maintenance</h1>
            <p className="text-muted-foreground mt-1">Manage work orders and maintenance requests</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Work Order
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-sm text-muted-foreground">Total Orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-blue-600">{stats.new}</div>
              <p className="text-sm text-muted-foreground">New</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-orange-600">{stats.inProgress}</div>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-yellow-600">{stats.awaitingApproval}</div>
              <p className="text-sm text-muted-foreground">Awaiting Approval</p>
            </CardContent>
          </Card>
          <Card className={stats.emergency > 0 ? "border-red-200 bg-red-50" : ""}>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-red-600">{stats.emergency}</div>
              <p className="text-sm text-muted-foreground">Emergencies</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Input
              placeholder="Search work orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === "kanban" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("kanban")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="icon"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            All Categories
          </Button>
          {WORK_ORDER_CATEGORIES.map((cat) => (
            <Button
              key={cat.value}
              variant={selectedCategory === cat.value ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.value)}
            >
              <span className="mr-1">{cat.icon}</span>
              {cat.label}
            </Button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="pt-6 h-48" />
              </Card>
            ))}
          </div>
        ) : viewMode === "kanban" ? (
          <WorkOrderKanban
            workOrders={filteredWorkOrders}
            onSelectWorkOrder={setSelectedWorkOrder}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ["work-orders"] })}
          />
        ) : (
          <div className="space-y-4">
            {filteredWorkOrders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No work orders found</h3>
                  <p className="text-muted-foreground mt-1">
                    {searchQuery || selectedCategory 
                      ? "Try adjusting your filters"
                      : "Create your first work order to get started"}
                  </p>
                  {!searchQuery && !selectedCategory && (
                    <Button onClick={() => setShowCreateDialog(true)} className="mt-4">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Work Order
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredWorkOrders.map((wo) => (
                <WorkOrderCard
                  key={wo.id}
                  workOrder={wo}
                  onClick={() => setSelectedWorkOrder(wo)}
                />
              ))
            )}
          </div>
        )}
      </div>

      <CreateWorkOrderDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["work-orders"] });
          toast.success("Work order created successfully");
        }}
      />

      {selectedWorkOrder && (
        <WorkOrderDetailModal
          workOrder={selectedWorkOrder}
          open={!!selectedWorkOrder}
          onOpenChange={(open) => !open && setSelectedWorkOrder(null)}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ["work-orders"] });
          }}
        />
      )}
    </>
  );
};

export default Maintenance;
