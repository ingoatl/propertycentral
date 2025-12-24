import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Phone, Delete, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VoiceDialerProps {
  defaultMessage?: string;
}

const VoiceDialer = ({ defaultMessage }: VoiceDialerProps) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const dialPad = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["*", "0", "#"],
  ];

  const handleDigitPress = (digit: string) => {
    setPhoneNumber((prev) => prev + digit);
  };

  const handleBackspace = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPhoneNumber("");
  };

  const formatPhoneDisplay = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const handleCall = async () => {
    if (!phoneNumber || phoneNumber.replace(/\D/g, "").length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }

    setIsLoading(true);

    try {
      // Create a temporary lead entry for the call or use a generic message
      const message = defaultMessage || 
        `Hi there, this is Ingo from PeachHaus. I hope you're having a wonderful day. I wanted to reach out personally because I believe we might be able to help you with your property management needs. If you have a moment, I'd love to chat about how we can help maximize your rental income while taking excellent care of your property. Feel free to call me back anytime. Looking forward to connecting with you!`;

      // Format phone number
      const formattedPhone = phoneNumber.replace(/\D/g, "");
      const fullPhone = formattedPhone.startsWith("1") ? `+${formattedPhone}` : `+1${formattedPhone}`;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-voice-call`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            phoneNumber: fullPhone,
            message,
            isManualDial: true,
          }),
        }
      );

      const data = await response.json();

      if (data?.success) {
        toast.success(`Calling ${formatPhoneDisplay(phoneNumber)}...`);
        setPhoneNumber("");
        setOpen(false);
      } else {
        toast.error(data?.error || "Failed to initiate call");
      }
    } catch (err) {
      console.error("Dialer call error:", err);
      toast.error("Failed to initiate call");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Phone className="h-4 w-4" />
          Dialer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[320px]">
        <DialogHeader>
          <DialogTitle className="text-center">Voice Dialer</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Phone number display */}
          <div className="relative">
            <Input
              value={formatPhoneDisplay(phoneNumber)}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter phone number"
              className="text-center text-xl font-medium h-14 pr-10"
            />
            {phoneNumber && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={handleBackspace}
              >
                <Delete className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Dial pad */}
          <div className="grid grid-cols-3 gap-2">
            {dialPad.flat().map((digit) => (
              <Button
                key={digit}
                variant="outline"
                className="h-14 text-xl font-medium"
                onClick={() => handleDigitPress(digit)}
              >
                {digit}
              </Button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleClear}
              disabled={!phoneNumber}
            >
              Clear
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={handleCall}
              disabled={isLoading || !phoneNumber}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VoiceDialer;
