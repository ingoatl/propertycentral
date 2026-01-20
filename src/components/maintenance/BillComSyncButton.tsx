import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, Send, CheckCircle, MessageSquare } from "lucide-react";
import { format } from "date-fns";

interface BillComSyncButtonProps {
  vendorId: string;
  vendorName: string;
  vendorEmail?: string;
  vendorPhone?: string;
  billcomVendorId?: string | null;
  billcomSyncedAt?: string | null;
  billcomInviteSentAt?: string | null;
  onUpdate: () => void;
}

const BillComSyncButton = ({
  vendorId,
  vendorName,
  vendorEmail,
  vendorPhone,
  billcomVendorId,
  billcomSyncedAt,
  billcomInviteSentAt,
  onUpdate,
}: BillComSyncButtonProps) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isSmsInviting, setIsSmsInviting] = useState(false);

  const syncToBillCom = async () => {
    if (!vendorEmail) {
      toast.error("Vendor email is required to sync with Bill.com");
      return;
    }

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("billcom-sync-vendor", {
        body: { vendorId },
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Vendor synced to Bill.com successfully");
        onUpdate();
      } else {
        toast.error(data.error || "Failed to sync vendor");
      }
    } catch (error: any) {
      console.error("Sync error:", error);
      toast.error("Failed to sync vendor: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const inviteToBillCom = async () => {
    if (!vendorEmail) {
      toast.error("Vendor email is required to send Bill.com invitation");
      return;
    }

    setIsInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("billcom-invite-vendor", {
        body: { vendorId },
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Bill.com invitation sent to vendor");
        onUpdate();
      } else {
        toast.error(data.error || "Failed to send invitation");
      }
    } catch (error: any) {
      console.error("Invite error:", error);
      toast.error("Failed to send invitation: " + error.message);
    } finally {
      setIsInviting(false);
    }
  };

  const sendSmsInvite = async () => {
    if (!vendorPhone) {
      toast.error("Vendor phone is required to send SMS invitation");
      return;
    }

    setIsSmsInviting(true);
    try {
      // Send SMS with Bill.com signup link
      const smsBody = `Hi ${vendorName}! PeachHaus Property Management invites you to join Bill.com for easy invoice submission and fast payments. Sign up here: https://app.bill.com/BDCRegistration\n\nOnce registered, you can submit invoices directly through Bill.com and receive payments quickly. Reply with any questions!`;

      const { data, error } = await supabase.functions.invoke("ghl-send-sms", {
        body: {
          phone: vendorPhone,
          message: smsBody,
          vendorId, // Include vendorId so the function uses the correct vendor number
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Bill.com invite SMS sent to vendor");
        
        // Update vendor record to track SMS invite
        await supabase
          .from("vendors")
          .update({
            billcom_invite_sent_at: new Date().toISOString(),
          })
          .eq("id", vendorId);
        
        onUpdate();
      } else {
        toast.error(data.error || "Failed to send SMS");
      }
    } catch (error: any) {
      console.error("SMS invite error:", error);
      toast.error("Failed to send SMS: " + error.message);
    } finally {
      setIsSmsInviting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Bill.com Integration</h4>
        {billcomVendorId ? (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        ) : billcomInviteSentAt ? (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Invite Pending
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-gray-100 text-gray-800">
            Not Connected
          </Badge>
        )}
      </div>

      {billcomVendorId && billcomSyncedAt && (
        <p className="text-xs text-muted-foreground">
          Last synced: {format(new Date(billcomSyncedAt), "MMM d, yyyy h:mm a")}
        </p>
      )}

      {billcomInviteSentAt && !billcomVendorId && (
        <p className="text-xs text-muted-foreground">
          Invite sent: {format(new Date(billcomInviteSentAt), "MMM d, yyyy h:mm a")}
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        {billcomVendorId ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={syncToBillCom}
              disabled={isSyncing || !vendorEmail}
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Re-sync
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={inviteToBillCom}
              disabled={isInviting || !vendorEmail}
            >
              {isInviting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {billcomInviteSentAt ? "Resend Email Invite" : "Email Invite"}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={syncToBillCom}
              disabled={isSyncing || !vendorEmail}
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync to Bill.com
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={inviteToBillCom}
              disabled={isInviting || !vendorEmail}
            >
              {isInviting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {billcomInviteSentAt ? "Resend Email" : "Email Invite"}
            </Button>
          </>
        )}
        
        {/* SMS Invite Option */}
        <Button
          variant="outline"
          size="sm"
          onClick={sendSmsInvite}
          disabled={isSmsInviting || !vendorPhone}
        >
          {isSmsInviting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <MessageSquare className="h-4 w-4 mr-2" />
          )}
          SMS Invite
        </Button>
      </div>

      {!vendorEmail && !vendorPhone && (
        <p className="text-xs text-amber-600">
          Add vendor email or phone to enable Bill.com integration
        </p>
      )}
      
      {!vendorEmail && vendorPhone && (
        <p className="text-xs text-muted-foreground">
          Add email for full Bill.com sync, or use SMS invite
        </p>
      )}
    </div>
  );
};

export default BillComSyncButton;
