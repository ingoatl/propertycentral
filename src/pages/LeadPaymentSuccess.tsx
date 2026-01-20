import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Loader2, PartyPopper } from "lucide-react";

const LeadPaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get("lead");
  const sessionId = searchParams.get("session_id");

  const [isLoading, setIsLoading] = useState(true);
  const [leadName, setLeadName] = useState<string>("");

  useEffect(() => {
    const confirmSetup = async () => {
      if (!leadId) {
        setIsLoading(false);
        return;
      }

      try {
        // Fetch lead name
        const { data: lead } = await supabase
          .from("leads")
          .select("name")
          .eq("id", leadId)
          .single();

        if (lead) {
          setLeadName(lead.name);
        }

        // Log success in timeline
        await supabase.from("lead_timeline").insert({
          lead_id: leadId,
          action: "Payment method successfully authorized",
          metadata: { sessionId },
        });

        // The webhook will handle updating the payment_method field
        // But we can also try to update it here as a backup
        // The actual payment method type will be set by the webhook
      } catch (err) {
        console.error("Error confirming setup:", err);
      } finally {
        setIsLoading(false);
      }
    };

    confirmSetup();
  }, [leadId, sessionId]);

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
          <p className="text-white/80 text-sm">Confirming your setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <img 
          src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" 
          alt="PeachHaus" 
          className="h-16 mx-auto mb-8"
        />
        
        <div className="relative mb-6">
          <CheckCircle className="h-20 w-20 text-emerald-400 mx-auto" />
          <PartyPopper className="h-8 w-8 text-[#fae052] absolute top-0 right-1/4 animate-bounce" />
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-3">You're All Set!</h1>
        
        <p className="text-white/70 text-lg mb-6">
          {leadName ? `Thank you, ${leadName.split(" ")[0]}!` : "Thank you!"} Your payment method has been saved securely.
        </p>
        
        <div className="bg-white/5 rounded-xl p-6 mb-6">
          <h2 className="text-white font-medium mb-3">What's Next?</h2>
          <ul className="text-white/60 text-sm space-y-2 text-left">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400">✓</span>
              Your payment method is now on file
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400">✓</span>
              You'll receive invoices before any charges
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400">✓</span>
              Our team will be in touch with next steps
            </li>
          </ul>
        </div>
        
        <p className="text-white/40 text-sm">
          Questions? Contact us at (404) 800-6804
        </p>
        
        <p className="text-white/20 text-xs mt-6">
          You can close this window now.
        </p>
      </div>
    </div>
  );
};

export default LeadPaymentSuccess;
