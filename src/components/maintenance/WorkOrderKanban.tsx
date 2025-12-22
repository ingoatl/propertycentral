import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { WorkOrder, WorkOrderStatus, STATUS_CONFIG } from "@/types/maintenance";
import WorkOrderCard from "./WorkOrderCard";

interface WorkOrderKanbanProps {
  workOrders: WorkOrder[];
  onSelectWorkOrder: (workOrder: WorkOrder) => void;
  onRefresh: () => void;
}

const KANBAN_COLUMNS: { status: WorkOrderStatus; title: string }[] = [
  { status: "new", title: "New" },
  { status: "triaging", title: "Triaging" },
  { status: "awaiting_approval", title: "Awaiting Approval" },
  { status: "approved", title: "Approved" },
  { status: "dispatched", title: "Dispatched" },
  { status: "scheduled", title: "Scheduled" },
  { status: "in_progress", title: "In Progress" },
  { status: "pending_verification", title: "Pending Verification" },
  { status: "completed", title: "Completed" },
];

const WorkOrderKanban = ({ workOrders, onSelectWorkOrder, onRefresh }: WorkOrderKanbanProps) => {
  const updateStatus = useMutation({
    mutationFn: async ({ workOrderId, newStatus }: { workOrderId: string; newStatus: WorkOrderStatus }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const workOrder = workOrders.find(wo => wo.id === workOrderId);
      
      // Update work order
      const { error } = await supabase
        .from("work_orders")
        .update({ 
          status: newStatus,
          ...(newStatus === "completed" ? { completed_at: new Date().toISOString() } : {})
        })
        .eq("id", workOrderId);

      if (error) throw error;

      // Add timeline entry
      await supabase.from("work_order_timeline").insert({
        work_order_id: workOrderId,
        action: `Status changed to ${STATUS_CONFIG[newStatus].label}`,
        performed_by_type: "pm",
        performed_by_name: user?.email,
        performed_by_user_id: user?.id,
        previous_status: workOrder?.status,
        new_status: newStatus,
      });
    },
    onSuccess: () => {
      onRefresh();
    },
    onError: (error) => {
      toast.error("Failed to update status: " + error.message);
    },
  });

  const handleDragStart = (e: React.DragEvent, workOrderId: string) => {
    e.dataTransfer.setData("workOrderId", workOrderId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, newStatus: WorkOrderStatus) => {
    e.preventDefault();
    const workOrderId = e.dataTransfer.getData("workOrderId");
    const workOrder = workOrders.find(wo => wo.id === workOrderId);
    
    if (workOrder && workOrder.status !== newStatus) {
      updateStatus.mutate({ workOrderId, newStatus });
    }
  };

  const getColumnWorkOrders = (status: WorkOrderStatus) => {
    return workOrders.filter(wo => wo.status === status);
  };

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4 min-w-max">
        {KANBAN_COLUMNS.map((column) => {
          const columnOrders = getColumnWorkOrders(column.status);
          const config = STATUS_CONFIG[column.status];
          
          return (
            <div
              key={column.status}
              className="w-72 shrink-0"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column.status)}
            >
              {/* Column Header */}
              <div className={`p-3 rounded-t-lg ${config.bgColor}`}>
                <div className="flex items-center justify-between">
                  <h3 className={`font-semibold ${config.color}`}>
                    {column.title}
                  </h3>
                  <span className={`text-sm font-medium ${config.color}`}>
                    {columnOrders.length}
                  </span>
                </div>
              </div>

              {/* Column Content */}
              <div className="bg-muted/30 rounded-b-lg p-2 min-h-[400px] space-y-2">
                {columnOrders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No work orders
                  </div>
                ) : (
                  columnOrders.map((wo) => (
                    <div
                      key={wo.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, wo.id)}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <WorkOrderCard
                        workOrder={wo}
                        onClick={() => onSelectWorkOrder(wo)}
                        compact
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
};

export default WorkOrderKanban;
