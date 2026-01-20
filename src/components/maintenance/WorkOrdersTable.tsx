import { useState } from "react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Search,
  Eye,
  Send,
  UserPlus,
  CheckCircle,
  AlertTriangle,
  Clock,
  Wrench,
  Circle,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkOrder {
  id: string;
  title: string;
  status: string;
  urgency: string;
  category: string;
  quoted_cost: number | null;
  created_at: string;
  property?: { name: string | null; address: string | null } | null;
  assigned_vendor?: { name: string; company_name: string | null } | null;
}

interface WorkOrdersTableProps {
  workOrders: WorkOrder[];
  onViewDetails: (workOrder: WorkOrder) => void;
  onAssignVendor?: (workOrder: WorkOrder) => void;
  onSendReminder?: (workOrder: WorkOrder) => void;
  isLoading?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  new: { label: "New", color: "bg-blue-100 text-blue-800", icon: Circle },
  dispatched: { label: "Dispatched", color: "bg-purple-100 text-purple-800", icon: Send },
  scheduled: { label: "Scheduled", color: "bg-indigo-100 text-indigo-800", icon: Clock },
  in_progress: { label: "In Progress", color: "bg-orange-100 text-orange-800", icon: Wrench },
  awaiting_approval: { label: "Awaiting Approval", color: "bg-amber-100 text-amber-800", icon: Clock },
  pending_verification: { label: "Pending Verify", color: "bg-teal-100 text-teal-800", icon: CheckCircle },
  completed: { label: "Completed", color: "bg-green-100 text-green-800", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-800", icon: Circle },
};

const URGENCY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: "Low", color: "bg-slate-100 text-slate-700" },
  normal: { label: "Normal", color: "bg-blue-100 text-blue-700" },
  high: { label: "High", color: "bg-orange-100 text-orange-700" },
  emergency: { label: "Emergency", color: "bg-red-100 text-red-700" },
};

export function WorkOrdersTable({
  workOrders,
  onViewDetails,
  onAssignVendor,
  onSendReminder,
  isLoading,
}: WorkOrdersTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");

  const filteredOrders = workOrders.filter((wo) => {
    const matchesSearch =
      wo.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wo.property?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wo.property?.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wo.assigned_vendor?.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || wo.status === statusFilter;
    const matchesUrgency = urgencyFilter === "all" || wo.urgency === urgencyFilter;

    return matchesSearch && matchesStatus && matchesUrgency;
  });

  const getPropertyLabel = (wo: WorkOrder) => {
    if (wo.property?.name && wo.property?.address) {
      return `${wo.property.name} - ${wo.property.address}`;
    }
    return wo.property?.name || wo.property?.address || "Unknown";
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.new;
    const Icon = config.icon;
    return (
      <Badge className={cn("gap-1", config.color)}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getUrgencyBadge = (urgency: string) => {
    const config = URGENCY_CONFIG[urgency] || URGENCY_CONFIG.normal;
    return (
      <Badge variant="outline" className={cn("text-xs", config.color)}>
        {urgency === "emergency" && <AlertTriangle className="h-3 w-3 mr-1" />}
        {config.label}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            All Work Orders
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none sm:w-48">
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-9">
                <Filter className="h-3.5 w-3.5 mr-1" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="Urgency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Urgency</SelectItem>
                {Object.entries(URGENCY_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Issue</TableHead>
                <TableHead className="font-semibold">Property</TableHead>
                <TableHead className="font-semibold">Vendor</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Urgency</TableHead>
                <TableHead className="font-semibold">Quote</TableHead>
                <TableHead className="font-semibold">Created</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8} className="h-12 animate-pulse bg-muted/30" />
                  </TableRow>
                ))
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No work orders found
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((wo) => (
                  <TableRow
                    key={wo.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onViewDetails(wo)}
                  >
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {wo.title}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-muted-foreground">
                      {getPropertyLabel(wo)}
                    </TableCell>
                    <TableCell>
                      {wo.assigned_vendor ? (
                        <span className="text-sm">
                          {wo.assigned_vendor.name}
                        </span>
                      ) : (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
                          Unassigned
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(wo.status)}</TableCell>
                    <TableCell>{getUrgencyBadge(wo.urgency)}</TableCell>
                    <TableCell>
                      {wo.quoted_cost ? (
                        <span className="font-medium">${wo.quoted_cost}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(wo.created_at), "MMM d, h:mm a")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewDetails(wo);
                          }}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!wo.assigned_vendor && onAssignVendor && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAssignVendor(wo);
                            }}
                            title="Assign Vendor"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        )}
                        {wo.assigned_vendor && onSendReminder && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSendReminder(wo);
                            }}
                            title="Send Reminder"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
