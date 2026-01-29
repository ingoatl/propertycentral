import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const PaymentSetup = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [leadData, setLeadData] = useState<{ name: string; email: string } | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const leadId = searchParams.get("lead");

  useEffect(() => {
    const fetchLeadData = async () => {
      if (!leadId) {
        setIsLoading(false);
        return;
      }

      try {
        // Use edge function to fetch lead data without requiring auth
        const { data, error } = await supabase.functions.invoke("get-lead-for-payment", {
          body: { leadId },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);
        
        setLeadData({ name: data.name, email: data.email });
      } catch (error) {
        console.error("Error fetching lead:", error);
        toast.error("Could not find your information");
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeadData();
  }, [leadId]);

  const handleSetupPayment = async () => {
    if (!leadId || !leadData) {
      toast.error("Missing lead information");
      return;
    }

    setIsRedirecting(true);

    try {
      // Call edge function to create Stripe checkout session
      const { data, error } = await supabase.functions.invoke("create-payment-setup", {
        body: { 
          leadId,
          email: leadData.email,
          name: leadData.name
        },
      });

      if (error) throw error;

      if (data?.url) {
        // Redirect to Stripe
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (!leadId || !leadData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 p-4">
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center">
            <CreditCard className="h-8 w-8 text-amber-600" />
          </div>
          <CardTitle className="text-2xl">Set Up Your Payment Method</CardTitle>
          <CardDescription className="text-base">
            Hi {leadData.name.split(' ')[0]}! Please set up a payment method for your account. This will be used for:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* What this is for */}
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-blue-800">Receiving Rental Income</p>
                <p className="text-blue-700">We'll deposit your rental earnings directly to your account</p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <CheckCircle2 className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-800">Property Expenses & Fees</p>
                <p className="text-amber-700">For any management fees or property expenses when needed</p>
              </div>
            </div>
          </div>

          {/* Payment method options */}
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

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-800">Secure & Encrypted</p>
                <p className="text-sm text-green-700">
                  We use Stripe, the industry leader in payment security. Your information is never stored on our servers.
                </p>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleSetupPayment} 
            className="w-full bg-amber-600 hover:bg-amber-700 text-white py-6 text-lg"
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
                Continue to Stripe
              </>
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
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

export default PaymentSetup;
