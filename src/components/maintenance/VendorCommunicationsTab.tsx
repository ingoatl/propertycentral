import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Phone, Voicemail, Mail, Clock, ArrowUpRight, ArrowDownLeft, User } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Vendor {
  id: string;
  name: string;
  company_name: string | null;
  phone: string;
}

interface Communication {
  id: string;
  communication_type: string;
  direction: string;
  body: string | null;
  status: string | null;
  created_at: string;
  metadata: unknown;
  assigned_user_id: string | null;
}

export function VendorCommunicationsTab() {
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");

  // Fetch all vendors
  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors-list-for-comms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("id, name, company_name, phone")
        .order("name");
      if (error) throw error;
      return data as Vendor[];
    },
  });

  // Fetch communications for selected vendor
  const { data: communications = [], isLoading } = useQuery({
    queryKey: ["vendor-communications", selectedVendorId],
    queryFn: async () => {
      if (!selectedVendorId) return [];

      const vendor = vendors.find((v) => v.id === selectedVendorId);
      if (!vendor) return [];

      // Normalize phone for matching
      const normalizePhone = (phone: string) => phone.replace(/\D/g, "").slice(-10);
      const vendorPhoneNormalized = normalizePhone(vendor.phone);

      // Fetch all communications and filter by vendor metadata or phone
      const { data, error } = await supabase
        .from("lead_communications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      // Filter for vendor communications
      const vendorComms = (data || []).filter((comm: Communication) => {
        const meta = comm.metadata as Record<string, unknown> | null;
        if (!meta) return false;

        // Check vendor_id match
        if (meta.vendor_id === selectedVendorId) return true;

        // Check phone match
        const commPhone = (meta.vendor_phone as string) || (meta.to_number as string) || 
          ((meta.ghl_data as Record<string, unknown>)?.contactPhone as string);
        if (commPhone && normalizePhone(commPhone) === vendorPhoneNormalized) return true;

        return false;
      });

      return vendorComms as Communication[];
    },
    enabled: !!selectedVendorId && vendors.length > 0,
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "sms":
        return <MessageSquare className="h-3.5 w-3.5" />;
      case "call":
        return <Phone className="h-3.5 w-3.5" />;
      case "voicemail":
        return <Voicemail className="h-3.5 w-3.5" />;
      case "email":
        return <Mail className="h-3.5 w-3.5" />;
      default:
        return <MessageSquare className="h-3.5 w-3.5" />;
    }
  };

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            Vendor Communications
          </CardTitle>
          <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a vendor..." />
            </SelectTrigger>
            <SelectContent>
              {vendors.map((vendor) => (
                <SelectItem key={vendor.id} value={vendor.id}>
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{vendor.name}</span>
                    {vendor.company_name && (
                      <span className="text-muted-foreground text-xs">
                        ({vendor.company_name})
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {!selectedVendorId ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Select a vendor to view communications</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : communications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No communications found for {selectedVendor?.name}</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {communications.map((comm) => (
                <div
                  key={comm.id}
                  className={cn(
                    "p-3 rounded-lg border",
                    comm.direction === "outbound"
                      ? "bg-primary/5 border-primary/20 ml-8"
                      : "bg-muted/50 mr-8"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs gap-1">
                        {getTypeIcon(comm.communication_type)}
                        {comm.communication_type.toUpperCase()}
                      </Badge>
                      {comm.direction === "outbound" ? (
                        <span className="flex items-center gap-0.5 text-xs text-primary">
                          <ArrowUpRight className="h-3 w-3" />
                          Sent
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                          <ArrowDownLeft className="h-3 w-3" />
                          Received
                        </span>
                      )}
                    </div>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(comm.created_at), "MMM d, h:mm a")}
                    </span>
                  </div>
                  {comm.body && (
                    <p className="text-sm whitespace-pre-wrap">{comm.body}</p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
