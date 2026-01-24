import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Phone, Mail, Star, Clock, Wrench, Shield, AlertTriangle, Loader2, ScanSearch, MessageSquare, PhoneCall, Trash2, ClipboardList, Mic, Video, Camera, Download } from "lucide-react";
import { SendVoicemailButton } from "@/components/communications/SendVoicemailButton";
import { Vendor, VENDOR_SPECIALTIES } from "@/types/maintenance";
import AddVendorDialog from "@/components/maintenance/AddVendorDialog";
import VendorDetailModal from "@/components/maintenance/VendorDetailModal";
import ServiceSignupDialog from "@/components/maintenance/ServiceSignupDialog";
import { CollapsibleActiveServices } from "@/components/maintenance/CollapsibleActiveServices";
import { VendorKPIBar } from "@/components/maintenance/VendorKPIBar";
import { WorkOrderStageCards } from "@/components/maintenance/WorkOrderStageCards";
import { WorkOrdersTable } from "@/components/maintenance/WorkOrdersTable";
import { VendorCommunicationsTab } from "@/components/maintenance/VendorCommunicationsTab";
import VendorPaymentDashboard from "@/components/maintenance/VendorPaymentDashboard";
import { CallDialog } from "@/components/communications/CallDialog";
import { SendSMSDialog } from "@/components/communications/SendSMSDialog";
import { SendVoicemailDialog } from "@/components/communications/SendVoicemailDialog";
import { MeetingsDialog } from "@/components/communications/MeetingsDialog";
import DeleteVendorDialog from "@/components/maintenance/DeleteVendorDialog";
import { StartWorkOrderDialog } from "@/components/maintenance/StartWorkOrderDialog";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import PremiumWorkOrderModal from "@/components/maintenance/PremiumWorkOrderModal";

const Vendors = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showServiceSignupDialog, setShowServiceSignupDialog] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [callDialogVendor, setCallDialogVendor] = useState<Vendor | null>(null);
  const [smsDialogVendor, setSmsDialogVendor] = useState<Vendor | null>(null);
  const [voicemailDialogVendor, setVoicemailDialogVendor] = useState<Vendor | null>(null);
  const [videoDialogVendor, setVideoDialogVendor] = useState<Vendor | null>(null);
  const [meetingDialogVendor, setMeetingDialogVendor] = useState<Vendor | null>(null);
  const [deleteVendor, setDeleteVendor] = useState<Vendor | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showStartWorkOrder, setShowStartWorkOrder] = useState(false);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [isImportingFromBillcom, setIsImportingFromBillcom] = useState(false);
  const queryClient = useQueryClient();
  const { isAdmin } = useAdminCheck();

  const extractVendorsFromEmails = async () => {
    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-vendors-from-emails');
      if (error) throw error;
      if (data.success) {
        toast.success(data.message);
        queryClient.invalidateQueries({ queryKey: ["vendors"] });
      } else {
        toast.error(data.error || 'Failed to extract vendors');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to extract vendors from emails');
    } finally {
      setIsExtracting(false);
    }
  };

  const importFromBillcom = async () => {
    setIsImportingFromBillcom(true);
    try {
      const { data, error } = await supabase.functions.invoke('billcom-import-vendors');
      if (error) throw error;
      if (data.success) {
        toast.success(data.message);
        if (data.importedNames?.length > 0) {
          console.log("Imported vendors:", data.importedNames);
        }
        queryClient.invalidateQueries({ queryKey: ["vendors"] });
      } else {
        toast.error(data.error || 'Failed to import vendors from Bill.com');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to import vendors from Bill.com');
    } finally {
      setIsImportingFromBillcom(false);
    }
  };

  const { data: vendors = [], isLoading: vendorsLoading } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: workOrders = [], isLoading: workOrdersLoading } = useQuery({
    queryKey: ["all-work-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("id, title, status, urgency, category, quoted_cost, created_at, property:properties(name, address), assigned_vendor:vendors!work_orders_assigned_vendor_id_fkey(name, company_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: activeServices = [] } = useQuery({
    queryKey: ["active-vendor-services"],
    queryFn: async () => {
      const { data, error } = await supabase.from("property_vendor_assignments").select("monthly_cost");
      if (error) throw error;
      return data;
    },
  });

  const filteredVendors = vendors
    .filter((vendor) => {
      const matchesSearch = (vendor.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (vendor.company_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (vendor.phone || '').includes(searchQuery);
      const matchesSpecialty = !selectedSpecialty || (vendor.specialty || []).includes(selectedSpecialty);
      return matchesSearch && matchesSpecialty;
    })
    .sort((a, b) => {
      // Preferred vendors first
      if (a.status === 'preferred' && b.status !== 'preferred') return -1;
      if (b.status === 'preferred' && a.status !== 'preferred') return 1;
      // Then by name
      return (a.name || '').localeCompare(b.name || '');
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'preferred': return 'bg-green-100 text-green-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'blocked': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSpecialtyLabel = (specialty: string) => specialty.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

  const handleDeleteVendor = async () => {
    if (!deleteVendor) return;
    setIsDeleting(true);
    try {
      await supabase.from("work_orders").update({ assigned_vendor_id: null }).eq("assigned_vendor_id", deleteVendor.id);
      const { error } = await supabase.from("vendors").delete().eq("id", deleteVendor.id);
      if (error) throw error;
      toast.success("Vendor deleted successfully");
      setDeleteVendor(null);
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    } catch (error: any) {
      toast.error("Failed to delete vendor: " + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const togglePreferredStatus = async (vendor: Vendor, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = vendor.status === 'preferred' ? 'active' : 'preferred';
    try {
      const { error } = await supabase
        .from("vendors")
        .update({ status: newStatus })
        .eq("id", vendor.id);
      if (error) throw error;
      toast.success(newStatus === 'preferred' ? 'Vendor marked as preferred' : 'Vendor unmarked as preferred');
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    } catch (error: any) {
      toast.error("Failed to update vendor status: " + error.message);
    }
  };

  // KPI calculations
  const openWorkOrders = workOrders.filter(wo => !["completed", "cancelled"].includes(wo.status)).length;
  const avgResponseTime = vendors.reduce((sum, v) => sum + (v.average_response_time_hours || 0), 0) / Math.max(vendors.filter(v => v.average_response_time_hours).length, 1);
  const monthlyServicesCost = activeServices.reduce((sum, s) => sum + (s.monthly_cost || 0), 0);

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Vendor Command Center</h1>
            <p className="text-muted-foreground mt-1">Manage vendors and work orders</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowStartWorkOrder(true)} className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Start Work Order
            </Button>
            <Button variant="outline" onClick={importFromBillcom} disabled={isImportingFromBillcom} className="gap-2">
              {isImportingFromBillcom ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isImportingFromBillcom ? 'Importing...' : 'Import from Bill.com'}
            </Button>
            <Button variant="outline" onClick={extractVendorsFromEmails} disabled={isExtracting} className="gap-2">
              {isExtracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
              {isExtracting ? 'Scanning...' : 'Extract from Emails'}
            </Button>
            <Button onClick={() => setShowAddDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Vendor
            </Button>
          </div>
        </div>

        {/* KPI Bar */}
        <VendorKPIBar
          totalVendors={vendors.length}
          openWorkOrders={openWorkOrders}
          avgResponseTime={avgResponseTime || null}
          monthlyServicesCost={monthlyServicesCost}
        />

        {/* Work Order Stage Cards */}
        <WorkOrderStageCards
          workOrders={workOrders}
          onViewDetails={(wo) => setSelectedWorkOrderId(wo.id)}
          isLoading={workOrdersLoading}
        />

        {/* Work Orders Table */}
        <WorkOrdersTable
          workOrders={workOrders}
          onViewDetails={(wo) => setSelectedWorkOrderId(wo.id)}
          isLoading={workOrdersLoading}
        />

        {/* Vendor Communications Tab */}
        <VendorCommunicationsTab />

        {/* Vendor Payment Dashboard */}
        <VendorPaymentDashboard />

        {/* Collapsible Active Services */}
        <CollapsibleActiveServices />

        {/* Vendor Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Input placeholder="Search vendors..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant={selectedSpecialty === null ? "default" : "outline"} size="sm" onClick={() => setSelectedSpecialty(null)}>All</Button>
            {VENDOR_SPECIALTIES.slice(0, 6).map((specialty) => (
              <Button key={specialty} variant={selectedSpecialty === specialty ? "default" : "outline"} size="sm" onClick={() => setSelectedSpecialty(specialty)}>
                {getSpecialtyLabel(specialty)}
              </Button>
            ))}
          </div>
        </div>

        {/* Vendor Grid */}
        {vendorsLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <Card key={i} className="animate-pulse"><CardContent className="pt-6 h-48" /></Card>)}
          </div>
        ) : filteredVendors.length === 0 ? (
          <Card><CardContent className="py-12 text-center"><Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><h3 className="text-lg font-medium">No vendors found</h3></CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredVendors.map((vendor) => (
              <Card key={vendor.id} className={`cursor-pointer hover:shadow-md transition-shadow ${vendor.status === 'preferred' ? 'ring-2 ring-primary/50 bg-primary/5' : ''}`} onClick={() => setSelectedVendor(vendor)}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-2">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className={`h-6 w-6 p-0 ${vendor.status === 'preferred' ? 'text-yellow-500' : 'text-muted-foreground hover:text-yellow-500'}`}
                        onClick={(e) => togglePreferredStatus(vendor, e)}
                        title={vendor.status === 'preferred' ? 'Remove from preferred' : 'Mark as preferred'}
                      >
                        <Star className={`h-4 w-4 ${vendor.status === 'preferred' ? 'fill-yellow-500' : ''}`} />
                      </Button>
                      <div>
                        <CardTitle className="text-lg">{vendor.name}</CardTitle>
                        {vendor.company_name && <p className="text-sm text-muted-foreground">{vendor.company_name}</p>}
                      </div>
                    </div>
                    <Badge className={getStatusColor(vendor.status)}>{vendor.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3.5 w-3.5" />{vendor.phone}</div>
                    {vendor.email && <div className="flex items-center gap-1 text-muted-foreground truncate"><Mail className="h-3.5 w-3.5" /><span className="truncate">{vendor.email}</span></div>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {vendor.specialty.slice(0, 3).map((s) => <Badge key={s} variant="secondary" className="text-xs">{getSpecialtyLabel(s)}</Badge>)}
                    {vendor.specialty.length > 3 && <Badge variant="secondary" className="text-xs">+{vendor.specialty.length - 3}</Badge>}
                  </div>
                  <div className="flex items-center gap-4 text-sm pt-2 border-t">
                    {vendor.average_rating > 0 && <div className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />{vendor.average_rating.toFixed(1)}</div>}
                    <div className="flex items-center gap-1 text-muted-foreground"><Wrench className="h-3.5 w-3.5" />{vendor.total_jobs_completed} jobs</div>
                    {vendor.average_response_time_hours && <div className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3.5 w-3.5" />{vendor.average_response_time_hours}h</div>}
                  </div>
                  <div className="flex gap-2">
                    {vendor.emergency_available && <Badge variant="outline" className="text-xs border-red-200 text-red-600"><AlertTriangle className="h-3 w-3 mr-1" />24/7</Badge>}
                    {vendor.insurance_verified && <Badge variant="outline" className="text-xs border-green-200 text-green-600"><Shield className="h-3 w-3 mr-1" />Insured</Badge>}
                  </div>
                  <div className="flex items-center gap-1.5 pt-2 border-t">
                    {vendor.phone && (
                      <>
                        <Button size="icon" variant="default" className="h-8 w-8 flex-shrink-0" onClick={(e) => { e.stopPropagation(); setCallDialogVendor(vendor); }} title="Call">
                          <PhoneCall className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="outline" className="h-8 w-8 flex-shrink-0" onClick={(e) => { e.stopPropagation(); setSmsDialogVendor(vendor); }} title="Text">
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="outline" className="h-8 w-8 flex-shrink-0" onClick={(e) => { e.stopPropagation(); setVoicemailDialogVendor(vendor); }} title="Voice">
                          <Mic className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="outline" className="h-8 w-8 flex-shrink-0" onClick={(e) => { e.stopPropagation(); setVideoDialogVendor(vendor); }} title="Video Message">
                          <Video className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="secondary" className="h-8 w-8 flex-shrink-0" onClick={(e) => { e.stopPropagation(); setMeetingDialogVendor(vendor); }} title="Record Meeting">
                          <Camera className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {vendor.email && (
                      <Button size="icon" variant="outline" className="h-8 w-8 flex-shrink-0" onClick={(e) => { e.stopPropagation(); window.location.href = `mailto:${vendor.email}`; }} title="Email">
                        <Mail className="h-4 w-4" />
                      </Button>
                    )}
                    <div className="flex-1" />
                    {isAdmin && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); setDeleteVendor(vendor); }} title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AddVendorDialog open={showAddDialog} onOpenChange={setShowAddDialog} onSuccess={() => { queryClient.invalidateQueries({ queryKey: ["vendors"] }); setShowAddDialog(false); }} />
      <ServiceSignupDialog open={showServiceSignupDialog} onOpenChange={setShowServiceSignupDialog} />
      {selectedVendor && <VendorDetailModal open={!!selectedVendor} onOpenChange={(open) => !open && setSelectedVendor(null)} vendor={selectedVendor} onUpdate={() => queryClient.invalidateQueries({ queryKey: ["vendors"] })} />}
      {callDialogVendor && <CallDialog open={!!callDialogVendor} onOpenChange={(open) => !open && setCallDialogVendor(null)} contactName={callDialogVendor.name} contactPhone={callDialogVendor.phone} contactType="vendor" />}
      {smsDialogVendor && <SendSMSDialog open={!!smsDialogVendor} onOpenChange={(open) => !open && setSmsDialogVendor(null)} contactName={smsDialogVendor.name} contactPhone={smsDialogVendor.phone} contactType="vendor" contactId={smsDialogVendor.id} />}
      {voicemailDialogVendor && voicemailDialogVendor.phone && (
        <SendVoicemailDialog
          open={!!voicemailDialogVendor}
          onOpenChange={(open) => !open && setVoicemailDialogVendor(null)}
          recipientPhone={voicemailDialogVendor.phone}
          recipientName={voicemailDialogVendor.name}
        />
      )}
      {videoDialogVendor && videoDialogVendor.phone && (
        <SendVoicemailDialog
          open={!!videoDialogVendor}
          onOpenChange={(open) => !open && setVideoDialogVendor(null)}
          recipientPhone={videoDialogVendor.phone}
          recipientName={videoDialogVendor.name}
          vendorId={videoDialogVendor.id}
        />
      )}
      {meetingDialogVendor && (
        <MeetingsDialog
          open={!!meetingDialogVendor}
          onOpenChange={(open) => !open && setMeetingDialogVendor(null)}
          contactName={meetingDialogVendor.name}
          contactEmail={meetingDialogVendor.email}
        />
      )}
      {deleteVendor && <DeleteVendorDialog open={!!deleteVendor} onOpenChange={(open) => !open && setDeleteVendor(null)} vendorName={deleteVendor.name} onConfirm={handleDeleteVendor} isDeleting={isDeleting} />}
      <StartWorkOrderDialog open={showStartWorkOrder} onOpenChange={setShowStartWorkOrder} onSuccess={() => queryClient.invalidateQueries({ queryKey: ["all-work-orders"] })} />
      {selectedWorkOrderId && <PremiumWorkOrderModal workOrderId={selectedWorkOrderId} open={!!selectedWorkOrderId} onOpenChange={(open) => !open && setSelectedWorkOrderId(null)} onUpdate={() => queryClient.invalidateQueries({ queryKey: ["all-work-orders"] })} />}
    </>
  );
};

export default Vendors;
