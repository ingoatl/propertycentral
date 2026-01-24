import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Send,
  Eye,
  MessageSquare,
  Edit,
  Wallet,
  Trash2,
  FileText,
  CheckCircle,
  Loader2,
  Users,
  Mic,
  Building2,
  Megaphone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PropertyOwner {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  service_type: "full_service" | "cohosting" | null;
  our_w9_sent_at: string | null;
  owner_w9_requested_at: string | null;
  owner_w9_uploaded_at: string | null;
  owner_w9_file_path: string | null;
}

interface OwnerActionsDropdownProps {
  owner: PropertyOwner;
  onEdit: () => void;
  onAddPayment: () => void;
  onViewMessages: () => void;
  onDelete: () => void;
  onDataRefresh: () => void;
}

export function OwnerActionsDropdown({
  owner,
  onEdit,
  onAddPayment,
  onViewMessages,
  onDelete,
  onDataRefresh,
}: OwnerActionsDropdownProps) {
  const [sendingW9, setSendingW9] = useState(false);
  const [requestingW9, setRequestingW9] = useState(false);
  const [sendingSpecialW9, setSendingSpecialW9] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [sendingVoiceReminder, setSendingVoiceReminder] = useState(false);
  const [sendingRecap, setSendingRecap] = useState(false);

  // Send OUR W-9 to co-hosting clients
  const handleSendOurW9 = async () => {
    setSendingW9(true);
    try {
      const { error } = await supabase.functions.invoke("send-w9-email", {
        body: { ownerId: owner.id, isManualSend: true },
      });
      if (error) throw error;
      toast.success(`Our W-9 sent to ${owner.email}!`);
      onDataRefresh();
    } catch (error: any) {
      toast.error("Failed to send W-9: " + (error.message || "Unknown error"));
    } finally {
      setSendingW9(false);
    }
  };

  // Request W-9 FROM full-service clients
  const handleRequestOwnerW9 = async () => {
    setRequestingW9(true);
    try {
      const { error } = await supabase.functions.invoke("request-owner-w9", {
        body: { ownerId: owner.id },
      });
      if (error) throw error;
      toast.success(`W-9 request sent to ${owner.email}!`);
      onDataRefresh();
    } catch (error: any) {
      toast.error("Failed to request W-9: " + (error.message || "Unknown error"));
    } finally {
      setRequestingW9(false);
    }
  };

  // Special W-9 request for co-hosting clients who received temporary housing payments
  const handleRequestSpecialW9 = async () => {
    setSendingSpecialW9(true);
    try {
      const { error } = await supabase.functions.invoke("request-owner-w9", {
        body: { 
          ownerId: owner.id,
          specialReason: "temporary_housing_payments"
        },
      });
      if (error) throw error;
      toast.success(`Special W-9 request sent to ${owner.email}!`, {
        description: "Email explains temporary housing agency payments."
      });
      onDataRefresh();
    } catch (error: any) {
      toast.error("Failed to send special W-9 request: " + (error.message || "Unknown error"));
    } finally {
      setSendingSpecialW9(false);
    }
  };

  // Send portal invite
  const handleSendPortalInvite = async () => {
    setSendingInvite(true);
    try {
      const { error } = await supabase.functions.invoke("owner-magic-link", {
        body: { owner_id: owner.id, send_email: true },
      });
      if (error) throw error;
      toast.success(`Portal invite sent to ${owner.email}!`);
    } catch (error: any) {
      toast.error("Failed to send portal invite: " + (error.message || "Unknown error"));
    } finally {
      setSendingInvite(false);
    }
  };

  // Send voice reminder for W-9
  const handleSendVoiceReminder = async () => {
    if (!owner.phone) {
      toast.error("No phone number on file for this owner");
      return;
    }
    setSendingVoiceReminder(true);
    try {
      const { error } = await supabase.functions.invoke("send-w9-voice-reminder", {
        body: { 
          entityId: owner.id,
          entityType: "owner"
        },
      });
      if (error) throw error;
      toast.success(`Voice reminder sent to ${owner.phone}!`);
      onDataRefresh();
    } catch (error: any) {
      toast.error("Failed to send voice reminder: " + (error.message || "Unknown error"));
    } finally {
      setSendingVoiceReminder(false);
    }
  };

  // Send monthly recap
  const handleSendMonthlyRecap = async () => {
    setSendingRecap(true);
    try {
      // Get the first property for this owner
      const { data: property } = await supabase
        .from('properties')
        .select('id, name')
        .eq('owner_id', owner.id)
        .is('offboarded_at', null)
        .limit(1)
        .single();
      
      if (!property) {
        toast.error("No active property found for this owner");
        return;
      }
      
      const { error } = await supabase.functions.invoke("send-monthly-owner-recap", {
        body: { 
          property_id: property.id,
          force: true
        },
      });
      
      if (error) throw error;
      toast.success(`Monthly recap sent to ${owner.email}!`, {
        description: `Generated for ${property.name}`
      });
    } catch (error: any) {
      toast.error("Failed to send recap: " + (error.message || "Unknown error"));
    } finally {
      setSendingRecap(false);
    }
  };

  // View owner's W-9
  const handleViewOwnerW9 = async () => {
    if (!owner.owner_w9_file_path) {
      toast.error("No W-9 file found");
      return;
    }
    try {
      const { data, error } = await supabase.storage
        .from("onboarding-documents")
        .createSignedUrl(owner.owner_w9_file_path, 3600);
      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (error: any) {
      toast.error("Failed to open W-9");
    }
  };

  const isLoading = sendingW9 || requestingW9 || sendingSpecialW9 || sendingInvite || sendingVoiceReminder || sendingRecap;

  return (
    <div className="flex gap-2 items-center">
      {/* Primary action buttons - always visible */}
      <Badge 
        variant={owner.service_type === 'cohosting' ? 'outline' : 'default'}
        className={owner.service_type === 'cohosting' ? 'border-orange-500 text-orange-600' : ''}
      >
        <Users className="w-3 h-3 mr-1" />
        {owner.service_type === 'cohosting' ? 'Co-Hosting' : 'Full Service'}
      </Badge>

      {/* W-9 status indicator */}
      {owner.owner_w9_uploaded_at ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleViewOwnerW9}
          className="text-green-600 gap-1"
        >
          <CheckCircle className="w-4 h-4" />
          W-9 Received
        </Button>
      ) : owner.owner_w9_requested_at ? (
        <Badge variant="outline" className="border-amber-500 text-amber-600">
          <FileText className="w-3 h-3 mr-1" />
          W-9 Pending
        </Badge>
      ) : null}

      {/* Portal Invite - Primary CTA */}
      <Button
        variant="default"
        size="sm"
        onClick={handleSendPortalInvite}
        disabled={sendingInvite}
        className="gap-2"
      >
        {sendingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Invite to Portal
      </Button>

      {/* Actions Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreVertical className="w-4 h-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-popover">
          <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
          
          <DropdownMenuItem onClick={() => window.open(`/owner?owner=${owner.id}`, '_blank')}>
            <Eye className="w-4 h-4 mr-2" />
            View Portal
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={onViewMessages}>
            <MessageSquare className="w-4 h-4 mr-2" />
            View Messages
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={onEdit}>
            <Edit className="w-4 h-4 mr-2" />
            Edit Details
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={handleSendMonthlyRecap} disabled={sendingRecap}>
            <Megaphone className="w-4 h-4 mr-2 text-blue-600" />
            {sendingRecap ? 'Sending Recap...' : 'Send Monthly Recap'}
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Tax Documents (W-9)</DropdownMenuLabel>
          
          {/* W-9 actions based on service type */}
          {owner.service_type === 'cohosting' ? (
            <>
              <DropdownMenuItem onClick={handleSendOurW9} disabled={sendingW9}>
                <FileText className="w-4 h-4 mr-2" />
                {owner.our_w9_sent_at ? 'Resend Our W-9' : 'Send Our W-9'}
              </DropdownMenuItem>
              
              {/* Special W-9 request for temporary housing payments */}
              <DropdownMenuItem onClick={handleRequestSpecialW9} disabled={sendingSpecialW9}>
                <Building2 className="w-4 h-4 mr-2 text-amber-600" />
                Request W-9 (Special)
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem onClick={handleRequestOwnerW9} disabled={requestingW9}>
              <FileText className="w-4 h-4 mr-2" />
              {owner.owner_w9_uploaded_at ? 'View W-9' : owner.owner_w9_requested_at ? 'Resend W-9 Request' : 'Request W-9'}
            </DropdownMenuItem>
          )}
          
          {owner.phone && (
            <DropdownMenuItem onClick={handleSendVoiceReminder} disabled={sendingVoiceReminder}>
              <Mic className="w-4 h-4 mr-2 text-purple-600" />
              Send Voice Reminder
            </DropdownMenuItem>
          )}
          
          {owner.owner_w9_uploaded_at && (
            <DropdownMenuItem onClick={handleViewOwnerW9}>
              <Eye className="w-4 h-4 mr-2 text-green-600" />
              View Uploaded W-9
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Payment</DropdownMenuLabel>
          
          <DropdownMenuItem onClick={onAddPayment}>
            <Wallet className="w-4 h-4 mr-2" />
            Add Payment Method
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Owner
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
