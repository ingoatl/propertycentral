import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PauseServiceDialog } from "./PauseServiceDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  Pause,
  Play,
  XCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  History,
} from "lucide-react";

interface VendorServicesTabProps {
  vendorId: string;
  vendorName: string;
  vendorEmail?: string;
}

export function VendorServicesTab({ vendorId, vendorName, vendorEmail }: VendorServicesTabProps) {
  const [pauseDialogOpen, setPauseDialogOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>();
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>();

  // Fetch active property assignments
  const { data: assignments, isLoading: isLoadingAssignments, refetch: refetchAssignments } = useQuery({
    queryKey: ['vendor-services', vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('property_vendor_assignments')
        .select(`
          id,
          property_id,
          specialty,
          monthly_cost,
          properties (
            id,
            address,
            city,
            state,
            zip_code
          )
        `)
        .eq('vendor_id', vendorId);

      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch service requests history
  const { data: serviceRequests, isLoading: isLoadingRequests, refetch: refetchRequests } = useQuery({
    queryKey: ['vendor-service-requests', vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_service_requests')
        .select(`
          *,
          properties (
            address,
            city
          )
        `)
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as any[];
    },
  });

  const handlePauseClick = (propertyId: string, assignmentId: string) => {
    setSelectedPropertyId(propertyId);
    setSelectedAssignmentId(assignmentId);
    setPauseDialogOpen(true);
  };

  const handleRequestSuccess = () => {
    refetchAssignments();
    refetchRequests();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Confirmed</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case 'expired':
        return <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />Expired</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const getRequestTypeBadge = (type: string) => {
    switch (type) {
      case 'pause':
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200"><Pause className="h-3 w-3 mr-1" />Pause</Badge>;
      case 'resume':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><Play className="h-3 w-3 mr-1" />Resume</Badge>;
      case 'cancel':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="h-3 w-3 mr-1" />Cancel</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const activeAssignments = assignments || [];
  const totalMonthlyCost = activeAssignments.reduce((sum: number, a: any) => sum + (a.monthly_cost || 0), 0);

  if (isLoadingAssignments) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-muted/30 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-primary">{activeAssignments.length}</p>
          <p className="text-sm text-muted-foreground">Active Properties</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-600">${totalMonthlyCost}</p>
          <p className="text-sm text-muted-foreground">Monthly Total</p>
        </div>
        <div className="bg-muted/30 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">
            {serviceRequests?.filter(r => r.status === 'pending').length || 0}
          </p>
          <p className="text-sm text-muted-foreground">Pending Requests</p>
        </div>
      </div>

      {/* Active Assignments */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Active Service Assignments
        </h3>
        {activeAssignments.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead className="text-right">Monthly Cost</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeAssignments.map((assignment) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{assignment.properties?.address}</p>
                        <p className="text-sm text-muted-foreground">
                          {assignment.properties?.city}, {assignment.properties?.state}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {assignment.specialty?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {assignment.monthly_cost ? `$${assignment.monthly_cost}` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePauseClick(assignment.property_id, assignment.id)}
                        disabled={!vendorEmail}
                      >
                        <Pause className="h-3 w-3 mr-1" />
                        Pause Service
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground border rounded-lg">
            <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No active service assignments</p>
          </div>
        )}
      </div>

      {/* Recent Requests History */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <History className="h-4 w-4" />
          Recent Service Requests
        </h3>
        {isLoadingRequests ? (
          <Skeleton className="h-32 w-full" />
        ) : serviceRequests && serviceRequests.length > 0 ? (
          <ScrollArea className="h-[200px] border rounded-lg">
            <div className="p-4 space-y-3">
              {serviceRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getRequestTypeBadge(request.request_type)}
                    <div>
                      <p className="text-sm font-medium">
                        {request.properties?.address}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {request.reference_number} • {format(new Date(request.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(request.status)}
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground border rounded-lg">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No service requests yet</p>
          </div>
        )}
      </div>


      {/* Pause Service Dialog */}
      <PauseServiceDialog
        open={pauseDialogOpen}
        onOpenChange={setPauseDialogOpen}
        vendorId={vendorId}
        vendorName={vendorName}
        vendorEmail={vendorEmail}
        preSelectedPropertyId={selectedPropertyId}
        preSelectedAssignmentId={selectedAssignmentId}
        onSuccess={handleRequestSuccess}
      />
    </div>
  );
}
