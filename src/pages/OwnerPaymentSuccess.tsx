import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, PartyPopper, Loader2 } from "lucide-react";

const OwnerPaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const [syncing, setSyncing] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  
  const ownerId = searchParams.get("owner");
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    const syncPaymentStatus = async () => {
      if (!ownerId) {
        setSyncing(false);
        return;
      }

      try {
        // Update the owner record to mark payment method as set up
        const { error: updateError } = await supabase
          .from("property_owners")
          .update({ 
            has_payment_method: true,
            updated_at: new Date().toISOString()
          })
          .eq("id", ownerId);

        if (updateError) {
          console.error("Error updating owner payment status:", updateError);
          setSyncError("Failed to sync payment status");
        } else {
          console.log("Payment method synced successfully for owner:", ownerId);
        }

        // Also mark the payment_setup_request as completed to stop reminders immediately
        const { error: requestError } = await supabase
          .from("payment_setup_requests")
          .update({ 
            status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq("owner_id", ownerId)
          .eq("status", "pending");

        if (requestError) {
          console.error("Error updating payment request status:", requestError);
        } else {
          console.log("Payment request marked as completed - reminders stopped for owner:", ownerId);
        }
      } catch (error) {
        console.error("Error syncing payment status:", error);
        setSyncError("An error occurred while syncing");
      } finally {
        setSyncing(false);
      }
    };

    syncPaymentStatus();
  }, [ownerId, sessionId]);

  if (syncing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mb-4" />
            <p className="text-lg text-gray-700">Confirming your payment setup...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <CardTitle className="text-2xl text-green-800">Payment Method Setup Complete!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <div className="flex justify-center">
            <PartyPopper className="h-12 w-12 text-amber-500" />
          </div>
          
          <p className="text-lg text-gray-700">
            Thank you! Your payment method has been securely saved.
          </p>

          {syncError && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              Note: {syncError}. Your payment method was saved with Stripe, but please contact us if you experience any issues.
            </div>
          )}
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
            <p className="font-medium text-green-800">What happens next?</p>
            <ul className="text-sm text-green-700 space-y-1 text-left list-disc list-inside">
              <li>Your monthly statements will be processed automatically</li>
              <li>You'll receive email confirmations for each transaction</li>
              <li>You can update your payment method anytime by contacting us</li>
            </ul>
          </div>

          <div className="pt-4">
            <img 
              src="/peachhaus-logo.png" 
              alt="PeachHaus" 
              className="h-8 mx-auto opacity-50"
            />
          </div>

          <p className="text-sm text-muted-foreground">
            Questions? Contact us at{" "}
            <a href="mailto:info@peachhausgroup.com" className="text-amber-600 hover:underline">
              info@peachhausgroup.com
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default OwnerPaymentSuccess;
