import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Delete, Loader2, PhoneOff, PhoneCall, User, Home, Circle, Search, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useTwilioDevice } from "@/hooks/useTwilioDevice";
import { formatPhoneForDisplay, cleanPhoneNumber } from "@/lib/phoneUtils";
import { Badge } from "@/components/ui/badge";
import { DialerPropertySearch } from "./DialerPropertySearch";

interface CallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  contactPhone: string;
  contactType?: 'lead' | 'owner' | 'vendor';
  contactAddress?: string | null;
  leadId?: string | null;
  ownerId?: string | null;
}

const dialPad = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

export function CallDialog({
  open,
  onOpenChange,
  contactName,
  contactPhone,
  contactType = 'lead',
  contactAddress,
  leadId,
  ownerId,
}: CallDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showPropertySearch, setShowPropertySearch] = useState(false);
  const [currentContact, setCurrentContact] = useState({
    name: contactName,
    phone: contactPhone,
    address: contactAddress,
    ownerIdOverride: ownerId,
  });
  const isMobile = useIsMobile();
  
  const { isConnecting, isOnCall, callStatus, callDuration, makeCall, endCall, sendDigits, formatDuration, preInitDevice } = useTwilioDevice({
    leadId,
    ownerId: currentContact.ownerIdOverride || ownerId,
    contactPhone: currentContact.phone,
  });

  // Pre-initialize Twilio device when dialog opens for faster call initiation
  useEffect(() => {
    if (open) {
      preInitDevice();
    }
  }, [open, preInitDevice]);

  // Set phone number when dialog opens or contact changes
  useEffect(() => {
    if (open && currentContact.phone) {
      setPhoneNumber(cleanPhoneNumber(currentContact.phone));
    }
  }, [open, currentContact.phone]);

  // Reset to original contact when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentContact({
        name: contactName,
        phone: contactPhone,
        address: contactAddress,
        ownerIdOverride: ownerId,
      });
      setShowPropertySearch(false);
    }
  }, [open, contactName, contactPhone, contactAddress, ownerId]);

  const handleSelectFromSearch = (contact: {
    name: string;
    phone: string;
    type: "owner";
    ownerId: string;
    propertyName?: string;
    propertyAddress?: string;
  }) => {
    setCurrentContact({
      name: contact.name,
      phone: contact.phone,
      address: contact.propertyAddress || contact.propertyName,
      ownerIdOverride: contact.ownerId,
    });
    setPhoneNumber(cleanPhoneNumber(contact.phone));
    setShowPropertySearch(false);
  };

  const handleDigitPress = (digit: string) => {
    setPhoneNumber((prev) => prev + digit);
    sendDigits(digit);
  };

  const handleBackspace = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  // Using formatPhoneForDisplay from phoneUtils

  const handleCall = async () => {
    await makeCall(phoneNumber, leadId, ownerId);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isOnCall) {
      // Don't close if on a call
      return;
    }
    if (!newOpen) {
      endCall();
      setPhoneNumber("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className={cn(
          "p-4 max-h-[90vh] overflow-y-auto",
          isMobile 
            ? "fixed inset-0 w-full h-full max-w-none max-h-none rounded-none m-0 flex flex-col overflow-y-auto" 
            : "sm:max-w-[380px]"
        )} 
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-center text-xl flex items-center justify-center gap-2">
            Call {currentContact.name}
            {!isOnCall && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowPropertySearch(!showPropertySearch)}
                title="Search properties"
              >
                <Search className="h-4 w-4" />
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className={cn(
          "space-y-3 flex-1 flex flex-col",
          isMobile && "justify-start pb-[env(safe-area-inset-bottom)]"
        )}>
          {/* Property Search Panel */}
          {showPropertySearch && !isOnCall && (
            <div className="border rounded-lg p-3 bg-muted/50">
              <DialerPropertySearch
                onSelectContact={handleSelectFromSearch}
                onClose={() => setShowPropertySearch(false)}
              />
            </div>
          )}

          {/* Contact info */}
          <div className="p-3 bg-muted rounded-xl shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                {contactType === 'owner' ? (
                  <Home className="h-5 w-5 text-primary" />
                ) : (
                  <User className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{currentContact.name}</p>
                {currentContact.address && (
                  <p className="text-xs text-muted-foreground truncate">{currentContact.address}</p>
                )}
              </div>
            </div>
          </div>

          {/* Recording indicator when on call */}
          {isOnCall && (
            <div className="flex items-center justify-center gap-2 py-2">
              <Circle className="h-3 w-3 fill-red-500 text-red-500 animate-pulse" />
              <span className="text-sm font-medium text-red-600">Recording</span>
              <Badge variant="secondary" className="text-xs">
                Auto-transcribed
              </Badge>
            </div>
          )}
          
          {/* Phone input */}
          <div className="relative">
            <Input
              value={formatPhoneForDisplay(phoneNumber)}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter phone number"
              className={cn(
                "text-center font-medium pr-12",
                isMobile ? "text-xl h-14" : "text-lg h-12"
              )}
              disabled={isOnCall}
            />
            {phoneNumber && !isOnCall && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10"
                onClick={handleBackspace}
              >
                <Delete className="h-5 w-5" />
              </Button>
            )}
          </div>

          {isOnCall && (
            <div className={cn(
              "text-center font-semibold text-lg py-2",
              callStatus === 'ringing' ? 'text-warning' : 'text-primary'
            )}>
              {callStatus === 'ringing' ? (
                <>Ringing... 📞</>
              ) : (
                <>Connected • {formatDuration(callDuration)}</>
              )}
            </div>
          )}

          {/* Dial pad */}
          <div className={cn(
            "grid grid-cols-3 shrink-0",
            isMobile ? "gap-2" : "gap-1.5"
          )}>
            {dialPad.flat().map((digit) => (
              <Button
                key={digit}
                variant="outline"
                className={cn(
                  "font-semibold rounded-xl active:scale-95 transition-transform",
                  isMobile ? "h-12 text-xl" : "h-10 text-lg"
                )}
                onClick={() => handleDigitPress(digit)}
              >
                {digit}
              </Button>
            ))}
          </div>

          {/* Call buttons */}
          <div className="flex gap-3 pt-1 shrink-0">
            {isOnCall ? (
              <Button
                variant="destructive"
                className={cn(
                  "flex-1 font-semibold",
                  isMobile ? "h-12 text-base" : "h-10"
                )}
                onClick={endCall}
              >
                <PhoneOff className="h-4 w-4 mr-2" />
                End Call
              </Button>
            ) : (
              <Button
                className={cn(
                  "flex-1 bg-primary hover:bg-primary/90 font-semibold",
                  isMobile ? "h-12 text-base" : "h-10"
                )}
                onClick={handleCall}
                disabled={isConnecting || !phoneNumber}
              >
                {isConnecting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <PhoneCall className="h-5 w-5 mr-2" />
                    Call
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Recording info */}
          <p className="text-xs text-center text-muted-foreground">
            All calls are automatically recorded and transcribed via Twilio
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
