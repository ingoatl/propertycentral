import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CalendarIcon, Loader2, Pause, Play, XCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface PauseServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string;
  vendorName: string;
  vendorEmail?: string;
  preSelectedPropertyId?: string;
  preSelectedAssignmentId?: string;
  onSuccess?: () => void;
}

export function PauseServiceDialog({
  open,
  onOpenChange,
  vendorId,
  vendorName,
  vendorEmail,
  preSelectedPropertyId,
  preSelectedAssignmentId,
  onSuccess,
}: PauseServiceDialogProps) {
  const [requestType, setRequestType] = useState<'pause' | 'resume' | 'cancel'>('pause');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(preSelectedPropertyId || '');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(preSelectedAssignmentId || '');
  const [pauseStartDate, setPauseStartDate] = useState<Date>();
  const [pauseEndDate, setPauseEndDate] = useState<Date>();
  const [reason, setReason] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Fetch property assignments for this vendor
  const { data: assignments, isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['vendor-assignments', vendorId],
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
    enabled: open,
  });

  // Reset form when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setRequestType('pause');
      setSelectedPropertyId(preSelectedPropertyId || '');
      setSelectedAssignmentId(preSelectedAssignmentId || '');
      setPauseStartDate(undefined);
      setPauseEndDate(undefined);
      setReason('');
    }
    onOpenChange(newOpen);
  };

  const handlePropertyChange = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    const assignment = assignments?.find(a => a.property_id === propertyId);
    setSelectedAssignmentId(assignment?.id || '');
  };

  const handleSendRequest = async () => {
    if (!selectedPropertyId) {
      toast.error("Please select a property");
      return;
    }

    if (!vendorEmail) {
      toast.error("Vendor does not have an email address configured");
      return;
    }

    if (requestType !== 'resume' && !pauseStartDate) {
      toast.error("Please select a start date");
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-vendor-pause-request', {
        body: {
          vendorId,
          propertyId: selectedPropertyId,
          assignmentId: selectedAssignmentId || undefined,
          requestType,
          pauseStartDate: pauseStartDate ? format(pauseStartDate, 'yyyy-MM-dd') : undefined,
          pauseEndDate: pauseEndDate ? format(pauseEndDate, 'yyyy-MM-dd') : undefined,
          reason: reason || undefined,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Service ${requestType} request sent successfully`, {
          description: `Reference: ${data.referenceNumber}`,
        });
        onSuccess?.();
        onOpenChange(false);
      } else {
        throw new Error(data?.error || 'Failed to send request');
      }
    } catch (error: any) {
      console.error('Error sending pause request:', error);
      toast.error("Failed to send request", {
        description: error.message,
      });
    } finally {
      setIsSending(false);
    }
  };

  const selectedAssignment = assignments?.find(a => a.property_id === selectedPropertyId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pause className="h-5 w-5 text-primary" />
            Service Modification Request
          </DialogTitle>
          <DialogDescription>
            Send a professional service modification request to {vendorName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Request Type */}
          <div className="space-y-3">
            <Label>Request Type</Label>
            <RadioGroup
              value={requestType}
              onValueChange={(value) => setRequestType(value as 'pause' | 'resume' | 'cancel')}
              className="grid grid-cols-3 gap-4"
            >
              <div>
                <RadioGroupItem
                  value="pause"
                  id="pause"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="pause"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <Pause className="mb-2 h-5 w-5" />
                  <span className="text-sm font-medium">Pause</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem
                  value="resume"
                  id="resume"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="resume"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <Play className="mb-2 h-5 w-5" />
                  <span className="text-sm font-medium">Resume</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem
                  value="cancel"
                  id="cancel"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="cancel"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-destructive [&:has([data-state=checked])]:border-destructive cursor-pointer"
                >
                  <XCircle className="mb-2 h-5 w-5" />
                  <span className="text-sm font-medium">Cancel</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Property Selection */}
          <div className="space-y-2">
            <Label>Property</Label>
            {isLoadingAssignments ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading properties...
              </div>
            ) : assignments && assignments.length > 0 ? (
              <Select value={selectedPropertyId} onValueChange={handlePropertyChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  {assignments.map((assignment) => (
                    <SelectItem key={assignment.id} value={assignment.property_id}>
                      {assignment.properties?.address}, {assignment.properties?.city}
                      {assignment.monthly_cost && (
                        <span className="text-muted-foreground ml-2">
                          (${assignment.monthly_cost}/mo)
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">
                No active property assignments found for this vendor.
              </p>
            )}
          </div>

          {/* Selected Assignment Info */}
          {selectedAssignment && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service:</span>
                <span className="font-medium">
                  {selectedAssignment.specialty?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </span>
              </div>
              {selectedAssignment.monthly_cost && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly Cost:</span>
                  <span className="font-medium">${selectedAssignment.monthly_cost}</span>
                </div>
              )}
            </div>
          )}

          {/* Start Date */}
          {requestType !== 'resume' && (
            <div className="space-y-2">
              <Label>{requestType === 'cancel' ? 'Effective Date' : 'Pause Start Date'}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !pauseStartDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {pauseStartDate ? format(pauseStartDate, "PPP") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={pauseStartDate}
                    onSelect={setPauseStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* End Date (only for pause) */}
          {requestType === 'pause' && (
            <div className="space-y-2">
              <Label>Pause End Date (optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !pauseEndDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {pauseEndDate ? format(pauseEndDate, "PPP") : "Select end date (if temporary)"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={pauseEndDate}
                    onSelect={setPauseEndDate}
                    disabled={(date) => pauseStartDate ? date < pauseStartDate : false}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Resume Date (for resume type) */}
          {requestType === 'resume' && (
            <div className="space-y-2">
              <Label>Resume Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !pauseStartDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {pauseStartDate ? format(pauseStartDate, "PPP") : "Select resume date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={pauseStartDate}
                    onSelect={setPauseStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea
              placeholder="e.g., Property undergoing renovation, tenant moving out..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          {/* Email Preview Note */}
          {vendorEmail && (
            <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
              <p>
                A professional email will be sent to <strong>{vendorEmail}</strong> with all the details above.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSendRequest} 
            disabled={isSending || !selectedPropertyId || !vendorEmail}
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
