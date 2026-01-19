import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Phone, Mail, Star, Clock, Wrench, Shield, AlertTriangle, DollarSign, FileText, Trash2, MessageSquare, Mic, PhoneCall, Inbox, Play, Volume2 } from "lucide-react";
import { SendVoicemailButton } from "@/components/communications/SendVoicemailButton";
import { Vendor, VENDOR_SPECIALTIES } from "@/types/maintenance";
import { format } from "date-fns";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import DeleteVendorDialog from "./DeleteVendorDialog";
import BillComSyncButton from "./BillComSyncButton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CallDialog } from "@/components/communications/CallDialog";

interface VendorDetailModalProps {
  vendor: Vendor & {
    billcom_vendor_id?: string | null;
    billcom_synced_at?: string | null;
    billcom_invite_sent_at?: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

const VendorDetailModal = ({ vendor, open, onOpenChange, onUpdate }: VendorDetailModalProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(vendor);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCallDialog, setShowCallDialog] = useState(false);
  const { isAdmin } = useAdminCheck();

  // Fetch work orders for this vendor
  const { data: workOrders = [] } = useQuery({
    queryKey: ["vendor-work-orders", vendor.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("*, property:properties(name, address)")
        .eq("assigned_vendor_id", vendor.id)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch communications with this vendor (by phone number) - including calls with recordings/transcripts
  const { data: vendorComms = [] } = useQuery({
    queryKey: ["vendor-communications", vendor.phone],
    queryFn: async () => {
      if (!vendor.phone) return [];
      
      // Normalize the vendor phone for matching
      const normalizePhone = (p: string) => p.replace(/\D/g, "").slice(-10);
      const vendorPhoneNormalized = normalizePhone(vendor.phone);
      
      // Query lead_communications for messages matching vendor's phone
      // This includes calls, voicemails, sms with metadata
      const { data, error } = await supabase
        .from("lead_communications")
        .select("id, communication_type, direction, body, subject, created_at, status, metadata")
        .or(`metadata->>unmatched_phone.ilike.%${vendorPhoneNormalized}%,metadata->>contact_phone.ilike.%${vendorPhoneNormalized}%,metadata->>to_number.ilike.%${vendorPhoneNormalized}%,metadata->>from_number.ilike.%${vendorPhoneNormalized}%`)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) {
        console.error("Error fetching vendor comms:", error);
        return [];
      }
      
      // Also check user_phone_messages for direct SMS
      const { data: directSms } = await supabase
        .from("user_phone_messages")
        .select("*")
        .or(`from_number.ilike.%${vendorPhoneNormalized}%,to_number.ilike.%${vendorPhoneNormalized}%`)
        .order("created_at", { ascending: false })
        .limit(50);
      
      // Combine and format messages with full metadata
      const allMessages = [
        ...(data || []).map((m: any) => ({
          id: m.id,
          type: m.communication_type,
          direction: m.direction,
          body: m.body,
          created_at: m.created_at,
          source: "lead_comms",
          metadata: m.metadata,
          // Extract recording and transcript if available
          recording_url: m.metadata?.recording_url || m.metadata?.audio_url,
          transcript: m.metadata?.transcript || m.metadata?.transcription,
          duration: m.metadata?.duration || m.metadata?.duration_seconds,
          call_status: m.metadata?.call_status,
        })),
        ...(directSms || []).map((m: any) => ({
          id: m.id,
          type: "sms",
          direction: m.direction,
          body: m.message_body,
          created_at: m.created_at,
          source: "direct",
          metadata: null,
          recording_url: null,
          transcript: null,
          duration: null,
          call_status: null,
        })),
      ];
      
      // Sort by date and dedupe
      return allMessages
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 50);
    },
    enabled: !!vendor.phone,
  });

  const updateVendor = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("vendors")
        .update({
          name: formData.name,
          company_name: formData.company_name || null,
          email: formData.email || null,
          phone: formData.phone,
          specialty: formData.specialty,
          hourly_rate: formData.hourly_rate || null,
          emergency_rate: formData.emergency_rate || null,
          emergency_available: formData.emergency_available,
          license_number: formData.license_number || null,
          insurance_verified: formData.insurance_verified,
          insurance_expiration: formData.insurance_expiration || null,
          w9_on_file: formData.w9_on_file,
          preferred_payment_method: formData.preferred_payment_method || null,
          notes: formData.notes || null,
          status: formData.status,
        })
        .eq("id", vendor.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vendor updated successfully");
      setIsEditing(false);
      onUpdate();
    },
    onError: (error) => {
      toast.error("Failed to update vendor: " + error.message);
    },
  });

  const deleteVendor = useMutation({
    mutationFn: async () => {
      // First, unassign any work orders
      const { error: woError } = await supabase
        .from("work_orders")
        .update({ assigned_vendor_id: null })
        .eq("assigned_vendor_id", vendor.id);

      if (woError) throw woError;

      // Then delete the vendor
      const { error } = await supabase
        .from("vendors")
        .delete()
        .eq("id", vendor.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vendor deleted successfully");
      setShowDeleteDialog(false);
      onOpenChange(false);
      onUpdate();
    },
    onError: (error) => {
      toast.error("Failed to delete vendor: " + error.message);
    },
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

  const getSpecialtyLabel = (specialty: string) => {
    return specialty.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const toggleSpecialty = (specialty: string) => {
    setFormData(prev => ({
      ...prev,
      specialty: prev.specialty.includes(specialty)
        ? prev.specialty.filter(s => s !== specialty)
        : [...prev.specialty, specialty],
    }));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl">{vendor.name}</DialogTitle>
              <Badge className={getStatusColor(vendor.status)}>
                {vendor.status}
              </Badge>
            </div>
            {vendor.company_name && (
              <p className="text-muted-foreground">{vendor.company_name}</p>
            )}
          </DialogHeader>

          <Tabs defaultValue="details" className="mt-4">
            <TabsList className="flex-wrap">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="comms">Communications ({vendorComms.length})</TabsTrigger>
              <TabsTrigger value="jobs">Work Orders ({workOrders.length})</TabsTrigger>
              <TabsTrigger value="billing">Bill.com</TabsTrigger>
              <TabsTrigger value="edit">Edit</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6 mt-4">
              {/* Quick Action Buttons */}
              <div className="flex flex-wrap gap-2 pb-2">
                {vendor.phone && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCallDialog(true);
                      }}
                    >
                      <PhoneCall className="h-4 w-4 text-green-600" />
                      Call
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = `sms:${vendor.phone}`;
                      }}
                    >
                      <MessageSquare className="h-4 w-4 text-blue-600" />
                      SMS
                    </Button>
                    <SendVoicemailButton
                      recipientPhone={vendor.phone}
                      recipientName={vendor.name}
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                    />
                  </>
                )}
                {vendor.email && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.location.href = `mailto:${vendor.email}`;
                    }}
                  >
                    <Mail className="h-4 w-4 text-purple-600" />
                    Email
                  </Button>
                )}
              </div>

              {/* Contact & Stats */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold">Contact Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${vendor.phone}`} className="hover:underline">
                        {vendor.phone}
                      </a>
                    </div>
                    {vendor.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${vendor.email}`} className="hover:underline">
                          {vendor.email}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Performance</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span>{vendor.average_rating > 0 ? vendor.average_rating.toFixed(1) : "N/A"} rating</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-muted-foreground" />
                      <span>{vendor.total_jobs_completed} jobs</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {vendor.average_response_time_hours 
                          ? `${vendor.average_response_time_hours}h avg response`
                          : "No data"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Specialties */}
              <div className="space-y-2">
                <h3 className="font-semibold">Specialties</h3>
                <div className="flex flex-wrap gap-2">
                  {vendor.specialty.map((s) => (
                    <Badge key={s} variant="secondary">
                      {getSpecialtyLabel(s)}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Rates */}
              <div className="space-y-2">
                <h3 className="font-semibold">Rates</h3>
                <div className="flex gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Hourly: {vendor.hourly_rate ? `$${vendor.hourly_rate}` : "Not set"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span>
                      Emergency: {vendor.emergency_rate ? `$${vendor.emergency_rate}` : "Not set"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Compliance */}
              <div className="space-y-2">
                <h3 className="font-semibold">Compliance</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Shield className={`h-4 w-4 ${vendor.insurance_verified ? "text-green-500" : "text-gray-400"}`} />
                    <span>
                      Insurance: {vendor.insurance_verified ? "Verified" : "Not verified"}
                      {vendor.insurance_expiration && (
                        <span className="text-muted-foreground ml-1">
                          (expires {format(new Date(vendor.insurance_expiration), "MMM d, yyyy")})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className={`h-4 w-4 ${vendor.w9_on_file ? "text-green-500" : "text-gray-400"}`} />
                    <span>W-9: {vendor.w9_on_file ? "On file" : "Not on file"}</span>
                  </div>
                  {vendor.license_number && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>License: {vendor.license_number}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={`h-4 w-4 ${vendor.emergency_available ? "text-red-500" : "text-gray-400"}`} />
                    <span>24/7 Available: {vendor.emergency_available ? "Yes" : "No"}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {vendor.notes && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Notes</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {vendor.notes}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="comms" className="mt-4">
              {!vendor.phone ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Phone className="h-8 w-8 mx-auto mb-2" />
                  <p>No phone number on file</p>
                  <p className="text-sm">Add a phone number to see communications</p>
                </div>
              ) : vendorComms.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Inbox className="h-8 w-8 mx-auto mb-2" />
                  <p>No communications yet</p>
                  <p className="text-sm">Start a conversation with {vendor.name}</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3 pr-4">
                    {vendorComms.map((msg: any) => (
                      <div 
                        key={msg.id} 
                        className={`p-3 rounded-lg ${
                          msg.direction === "outbound" 
                            ? "bg-primary/10 ml-8" 
                            : "bg-muted mr-8"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {msg.type === "sms" ? (
                            <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                          ) : msg.type === "voicemail" ? (
                            <Mic className="h-3.5 w-3.5 text-amber-500" />
                          ) : msg.type === "call" ? (
                            <PhoneCall className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Mail className="h-3.5 w-3.5 text-purple-500" />
                          )}
                          <span className="text-xs text-muted-foreground">
                            {msg.direction === "outbound" ? "You" : vendor.name} · {format(new Date(msg.created_at), "MMM d, h:mm a")}
                          </span>
                          {msg.duration && (
                            <Badge variant="outline" className="text-[10px] h-4">
                              {Math.floor(msg.duration / 60)}:{String(msg.duration % 60).padStart(2, '0')}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Message body */}
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                        
                        {/* Call transcript */}
                        {msg.transcript && (
                          <div className="mt-2 p-2 bg-background/50 rounded text-xs border">
                            <div className="flex items-center gap-1 text-muted-foreground mb-1">
                              <FileText className="h-3 w-3" />
                              <span className="font-medium">Transcript</span>
                            </div>
                            <p className="text-foreground leading-relaxed">{msg.transcript}</p>
                          </div>
                        )}
                        
                        {/* Recording playback */}
                        {msg.recording_url && (
                          <div className="mt-2">
                            <audio 
                              controls 
                              className="w-full h-8" 
                              src={msg.recording_url}
                              preload="none"
                            >
                              <a href={msg.recording_url} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="ghost" className="gap-1.5 h-6 text-xs">
                                  <Volume2 className="h-3 w-3" />
                                  Listen to recording
                                </Button>
                              </a>
                            </audio>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="jobs" className="mt-4">
              {workOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Wrench className="h-8 w-8 mx-auto mb-2" />
                  <p>No work orders assigned yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {workOrders.map((wo: any) => (
                    <div key={wo.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{wo.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {wo.property?.name || wo.property?.address}
                          </p>
                        </div>
                        <Badge variant="secondary">{wo.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(wo.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="billing" className="mt-4">
              <div className="space-y-6">
                <div className="p-4 border rounded-lg">
                  <BillComSyncButton
                    vendorId={vendor.id}
                    vendorName={vendor.name}
                    vendorEmail={vendor.email}
                    billcomVendorId={vendor.billcom_vendor_id}
                    billcomSyncedAt={vendor.billcom_synced_at}
                    billcomInviteSentAt={vendor.billcom_invite_sent_at}
                    onUpdate={onUpdate}
                  />
                </div>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">How Bill.com Payment Works</h4>
                  <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                    <li>Sync or invite the vendor to Bill.com</li>
                    <li>Vendor receives work order and completes the job</li>
                    <li>Vendor creates and submits invoice through Bill.com</li>
                    <li>You approve the invoice in Bill.com</li>
                    <li>Bill.com processes payment to vendor</li>
                  </ol>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="edit" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contact Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input
                    value={formData.company_name || ""}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Specialties</Label>
                <div className="flex flex-wrap gap-2">
                  {VENDOR_SPECIALTIES.map((specialty) => (
                    <Button
                      key={specialty}
                      type="button"
                      variant={formData.specialty.includes(specialty) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleSpecialty(specialty)}
                    >
                      {getSpecialtyLabel(specialty)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Hourly Rate ($)</Label>
                  <Input
                    type="number"
                    value={formData.hourly_rate || ""}
                    onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value ? parseFloat(e.target.value) : undefined })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Emergency Rate ($)</Label>
                  <Input
                    type="number"
                    value={formData.emergency_rate || ""}
                    onChange={(e) => setFormData({ ...formData, emergency_rate: e.target.value ? parseFloat(e.target.value) : undefined })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="preferred">Preferred</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit_emergency"
                    checked={formData.emergency_available}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, emergency_available: !!checked })
                    }
                  />
                  <Label htmlFor="edit_emergency" className="font-normal">24/7 Available</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit_insurance"
                    checked={formData.insurance_verified}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, insurance_verified: !!checked })
                    }
                  />
                  <Label htmlFor="edit_insurance" className="font-normal">Insurance Verified</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit_w9"
                    checked={formData.w9_on_file}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, w9_on_file: !!checked })
                    }
                  />
                  <Label htmlFor="edit_w9" className="font-normal">W-9 on File</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes || ""}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setFormData(vendor)}
                >
                  Reset
                </Button>
                <Button
                  onClick={() => updateVendor.mutate()}
                  disabled={updateVendor.isPending}
                >
                  {updateVendor.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>

              {/* Admin-only danger zone */}
              {isAdmin && (
                <>
                  <Separator className="my-6" />
                  <div className="border border-destructive/20 rounded-lg p-4 bg-destructive/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-destructive">Danger Zone</p>
                        <p className="text-sm text-muted-foreground">
                          Permanently delete this vendor from the system
                        </p>
                      </div>
                      <Button 
                        variant="destructive" 
                        onClick={() => setShowDeleteDialog(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Vendor
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <DeleteVendorDialog
        vendorName={vendor.name}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={() => deleteVendor.mutate()}
        isDeleting={deleteVendor.isPending}
      />

      {vendor.phone && (
        <CallDialog
          open={showCallDialog}
          onOpenChange={setShowCallDialog}
          contactPhone={vendor.phone}
          contactName={vendor.name}
        />
      )}
    </>
  );
};

export default VendorDetailModal;
