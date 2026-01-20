import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CreditCard, Building2, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface LeadData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  propertyAddress: string | null;
  stripeCustomerId: string | null;
  paymentMethod: string | null;
  hasPaymentMethod: boolean;
}

const LeadPaymentSetup = () => {
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get("lead");
  const wasCanceled = searchParams.get("canceled") === "true";

  const [isLoading, setIsLoading] = useState(true);
  const [leadData, setLeadData] = useState<LeadData | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeadData = async () => {
      if (!leadId) {
        setError("No lead ID provided");
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("get-lead-for-payment", {
          body: { leadId },
        });

        if (error) throw error;
        if (!data) throw new Error("Lead not found");

        setLeadData(data);
      } catch (err: any) {
        console.error("Error fetching lead:", err);
        setError(err.message || "Failed to load lead information");
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeadData();
  }, [leadId]);

  const handleSetupPayment = async () => {
    if (!leadId) return;

    setIsRedirecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-lead-payment-setup", {
        body: { leadId },
      });

      if (error) throw error;
      if (!data?.url) throw new Error("Failed to create payment session");

      window.location.href = data.url;
    } catch (err: any) {
      console.error("Error creating payment session:", err);
      setError(err.message || "Failed to start payment setup");
      setIsRedirecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="text-center">
          <img 
            src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" 
            alt="PeachHaus" 
            className="h-16 mx-auto mb-4"
          />
          <Loader2 className="h-8 w-8 animate-spin text-[#fae052] mx-auto mb-3" />
          <p className="text-white/80 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !leadData) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <img 
            src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" 
            alt="PeachHaus" 
            className="h-16 mx-auto mb-6"
          />
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Something went wrong</h1>
          <p className="text-white/60 text-sm">{error || "Unable to load your information"}</p>
          <p className="text-white/40 text-xs mt-4">
            Please contact us at (404) 800-6804 if you need assistance.
          </p>
        </div>
      </div>
    );
  }

  if (leadData.hasPaymentMethod) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <img 
            src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" 
            alt="PeachHaus" 
            className="h-16 mx-auto mb-6"
          />
          <CheckCircle className="h-16 w-16 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-white mb-2">Already Set Up!</h1>
          <p className="text-white/70">
            Your payment method has already been configured. You're all set!
          </p>
          <div className="mt-6 p-4 bg-white/5 rounded-lg">
            <p className="text-white/50 text-sm">Payment Method</p>
            <p className="text-white font-medium capitalize">
              {leadData.paymentMethod === "ach" ? "Bank Account" : "Credit Card"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <img 
            src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" 
            alt="PeachHaus" 
            className="h-16 mx-auto mb-6"
          />
          <h1 className="text-2xl font-semibold text-white mb-2">Payment Authorization</h1>
          <p className="text-white/60">Set up your payment method for property management</p>
        </div>

        {wasCanceled && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-yellow-400 text-sm text-center">
              Setup was canceled. You can try again whenever you're ready.
            </p>
          </div>
        )}

        <div className="bg-white/5 rounded-xl p-6 mb-6">
          <h2 className="text-white font-medium mb-4">Hello, {leadData.name.split(" ")[0]}!</h2>
          
          {leadData.propertyAddress && (
            <div className="flex items-start gap-3 mb-4 p-3 bg-[#fae052]/10 rounded-lg">
              <Building2 className="h-5 w-5 text-[#fae052] mt-0.5" />
              <div>
                <p className="text-[#fae052] text-xs font-medium uppercase tracking-wide">Property</p>
                <p className="text-white text-sm">{leadData.propertyAddress}</p>
              </div>
            </div>
          )}

          <div className="space-y-3 text-white/70 text-sm">
            <p>This authorizes PeachHaus to charge for:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Monthly property management fees</li>
              <li>Pre-approved maintenance & supplies</li>
              <li>Utility reimbursements (if applicable)</li>
            </ul>
            <p className="text-emerald-400 font-medium">
              ✓ You won't be charged today — this just saves your payment method.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white/5 rounded-lg p-4 text-center">
            <div className="text-2xl mb-2">🏦</div>
            <p className="text-white text-sm font-medium">Bank Account</p>
            <p className="text-white/50 text-xs">1% processing fee</p>
          </div>
          <div className="bg-white/5 rounded-lg p-4 text-center">
            <div className="text-2xl mb-2">💳</div>
            <p className="text-white text-sm font-medium">Credit Card</p>
            <p className="text-white/50 text-xs">3% processing fee</p>
          </div>
        </div>

        <Button
          onClick={handleSetupPayment}
          disabled={isRedirecting}
          className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white py-6 text-lg font-medium rounded-xl shadow-lg shadow-emerald-500/25"
        >
          {isRedirecting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Redirecting to Stripe...
            </>
          ) : (
            <>
              <CreditCard className="h-5 w-5 mr-2" />
              Continue to Stripe
            </>
          )}
        </Button>

        <p className="text-center text-white/40 text-xs mt-4">
          Secure payment processing by Stripe. Your information is encrypted.
        </p>
        <p className="text-center text-white/30 text-xs mt-2">
          Questions? Call (404) 800-6804
        </p>
      </div>
    </div>
  );
};

export default LeadPaymentSetup;
