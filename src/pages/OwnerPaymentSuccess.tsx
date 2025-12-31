import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, PartyPopper } from "lucide-react";

const OwnerPaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const ownerId = searchParams.get("owner");

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
