import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, CheckCircle2, Building2, AlertCircle, Shield, Lock } from "lucide-react";
import { toast } from "sonner";

interface OwnerData {
  name: string;
  email: string;
  payment_method: string;
  stripe_customer_id: string | null;
  service_type: "full_service" | "cohosting" | null;
  properties: { name: string }[];
}

const OwnerPaymentSetup = () => {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [ownerData, setOwnerData] = useState<OwnerData | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [wasCanceled, setWasCanceled] = useState(false);

  const ownerId = searchParams.get("owner");
  const canceled = searchParams.get("canceled");

  const isFullService = ownerData?.service_type === "full_service";

  useEffect(() => {
    if (canceled === "true") {
      setWasCanceled(true);
    }
    
    const fetchOwnerData = async () => {
      if (!ownerId) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("get-owner-for-payment", {
          body: { ownerId },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);
        
        setOwnerData(data);
      } catch (error) {
        console.error("Error fetching owner:", error);
        toast.error("Could not find your information");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOwnerData();
  }, [ownerId, canceled]);

  const handleSetupPayment = async () => {
    if (!ownerId || !ownerData) {
      toast.error("Missing owner information");
      return;
    }

    setIsRedirecting(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-owner-payment-setup", {
        body: { 
          ownerId,
          email: ownerData.email,
          name: ownerData.name
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      console.error("Error creating payment session:", error);
      toast.error("Failed to start payment setup. Please try again.");
      setIsRedirecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!ownerId || !ownerData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600">Invalid Link</CardTitle>
            <CardDescription>
              This payment setup link is invalid or has expired. Please contact us at info@peachhausgroup.com for assistance.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="max-w-lg w-full shadow-xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4">
            <img 
              src="/peachhaus-logo.png" 
              alt="PeachHaus" 
              className="h-12 mx-auto"
            />
          </div>
          <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold mb-3">
            {isFullService ? "💰 FULL SERVICE • PAYOUT SETUP" : "🔒 CO-HOSTING • PAYMENT SETUP"}
          </div>
          <CardTitle className="text-2xl">
            {isFullService ? "Set Up Your Payout Account" : "Set Up Your Payment Method"}
          </CardTitle>
          <CardDescription className="text-base">
            Hi {ownerData.name.split(' ')[0]}! {isFullService 
              ? "Link your bank account to receive your rental earnings."
              : "We're upgrading to Stripe for secure, automated payments."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {wasCanceled && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-800">Setup was canceled</p>
                <p className="text-sm text-amber-700">You can try again when you're ready.</p>
              </div>
            </div>
          )}

          {/* No Forms Banner */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-blue-900">No Forms to Fill Out</p>
                <p className="text-sm text-blue-700">
                  Just securely link your {isFullService ? "bank account" : "bank or card"} through Stripe's protected portal. Takes about 2 minutes.
                </p>
              </div>
            </div>
          </div>

          {/* Properties under management */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-5 w-5 text-slate-600" />
              <p className="font-medium text-slate-800">Properties Under Management</p>
            </div>
            <ul className="space-y-1 ml-7">
              {ownerData.properties.length > 0 ? (
                ownerData.properties.map((prop, idx) => (
                  <li key={idx} className="text-sm text-slate-600">{prop.name}</li>
                ))
              ) : (
                <li className="text-sm text-slate-600">Your managed property</li>
              )}
            </ul>
          </div>

          {/* Purpose section - different for full-service vs co-hosting */}
          {isFullService ? (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-800">Receive Your Rental Earnings</p>
                  <p className="text-sm text-green-700">
                    We'll deposit your net earnings on the 5th of each month via secure bank transfer. No fees for payouts.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-amber-800">Monthly Property Charges</p>
                    <p className="text-sm text-amber-700">Management fees, property expenses, and visit fees</p>
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-blue-800">Complete Transparency</p>
                    <p className="text-sm text-blue-700">See every charge before it posts — no surprises</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payment method options - only show for co-hosting */}
          {!isFullService && (
            <div className="border rounded-lg p-4 space-y-3">
              <p className="font-medium text-center">Choose Your Payment Method</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col items-center p-3 bg-green-50 border-2 border-green-200 rounded-lg">
                  <span className="text-2xl mb-1">🏦</span>
                  <span className="font-medium text-green-800">US Bank Account</span>
                  <span className="text-xs text-green-700">1% fee • Recommended</span>
                </div>
                <div className="flex flex-col items-center p-3 bg-gray-50 border-2 border-gray-200 rounded-lg">
                  <span className="text-2xl mb-1">💳</span>
                  <span className="font-medium text-gray-800">Credit Card</span>
                  <span className="text-xs text-gray-600">3% processing fee</span>
                </div>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                You'll choose your preferred method on the next screen
              </p>
            </div>
          )}

          {/* Why Stripe section */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-5 w-5 text-slate-600" />
              <p className="font-semibold text-slate-800">Why Stripe?</p>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span><strong>Bank-level encryption</strong> — 256-bit SSL security</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span><strong>Never stored on our servers</strong> — Details in Stripe's vault</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span><strong>Trusted by millions</strong> — Amazon, Google, Shopify</span>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleSetupPayment} 
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-6 text-lg"
            disabled={isRedirecting}
          >
            {isRedirecting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Redirecting to Stripe...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-5 w-5" />
                {isFullService ? "Set Up Payout Account" : "Continue to Stripe"}
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            This link won't expire — complete setup whenever you're ready!
          </p>

          <p className="text-center text-sm text-muted-foreground">
            Questions? Contact us at{" "}
            <a href="mailto:info@peachhausgroup.com" className="text-emerald-600 hover:underline">
              info@peachhausgroup.com
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default OwnerPaymentSetup;
