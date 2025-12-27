import { useState, useEffect } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import { getStripe } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Loader2 } from "lucide-react";

interface AddPaymentMethodProps {
  ownerId: string;
  ownerName: string;
  paymentMethod: "card" | "ach";
  onSuccess: () => void;
  onCancel: () => void;
}

const PaymentForm = ({ ownerId, onSuccess, onCancel }: Omit<AddPaymentMethodProps, "ownerName" | "paymentMethod">) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    try {
      const { error } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      });

      if (error) {
        throw error;
      }

      toast.success("Payment method added successfully!");
      onSuccess();
    } catch (error: any) {
      console.error("Error adding payment method:", error);
      toast.error(error.message || "Failed to add payment method");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <div className="flex gap-2">
        <Button type="submit" disabled={!stripe || processing} className="flex-1">
          {processing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Add Payment Method
            </>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={processing}>
          Cancel
        </Button>
      </div>
    </form>
  );
};

export const AddPaymentMethod = ({ ownerId, ownerName, paymentMethod, onSuccess, onCancel }: AddPaymentMethodProps) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stripe, setStripe] = useState<Stripe | null>(null);

  const initializePayment = async () => {
    setLoading(true);
    try {
      // Lazy-load Stripe when payment is initiated
      const stripeInstance = await getStripe();
      setStripe(stripeInstance);

      const { data, error } = await supabase.functions.invoke("create-setup-intent", {
        body: { ownerId },
      });

      if (error) throw error;

      setClientSecret(data.clientSecret);
    } catch (error: any) {
      console.error("Error creating setup intent:", error);
      toast.error(error.message || "Failed to initialize payment setup");
      onCancel();
    } finally {
      setLoading(false);
    }
  };

  if (!clientSecret && !loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Add Payment Method for {ownerName}</CardTitle>
          <CardDescription>
            {paymentMethod === "ach" 
              ? "You'll be able to enter bank account details to charge via ACH"
              : "You'll be able to enter credit card details to charge"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button onClick={initializePayment} className="flex-1">
              Continue
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Payment Method for {ownerName}</CardTitle>
        <CardDescription>
          {paymentMethod === "ach" 
            ? "Enter bank account details. All information is securely processed by Stripe."
            : "Enter credit card details. All information is securely processed by Stripe."
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {clientSecret && stripe && (
          <Elements 
            stripe={stripe} 
            options={{ 
              clientSecret,
              appearance: {
                theme: 'stripe',
              },
            }}
          >
            <PaymentForm ownerId={ownerId} onSuccess={onSuccess} onCancel={onCancel} />
          </Elements>
        )}
      </CardContent>
    </Card>
  );
};
