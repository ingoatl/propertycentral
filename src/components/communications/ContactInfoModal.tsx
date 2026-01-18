import { useState, useEffect } from "react";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Mail, MapPin, Building, User, ExternalLink, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ContactMemoriesPanel } from "./ContactMemoriesPanel";

interface ContactInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactType: "lead" | "owner" | "external" | "draft" | "personal";
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
}

interface LeadInfo {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  property_address: string | null;
  property_type: string | null;
  stage: string;
  notes: string | null;
  tags: string[] | null;
  opportunity_value: number | null;
}

interface OwnerInfo {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  properties: { id: string; name: string; address: string }[];
}

export function ContactInfoModal({
  open,
  onOpenChange,
  contactId,
  contactType,
  contactName,
  contactPhone,
  contactEmail,
}: ContactInfoModalProps) {
  const [leadInfo, setLeadInfo] = useState<LeadInfo | null>(null);
  const [ownerInfo, setOwnerInfo] = useState<OwnerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (open && (contactType === "lead" || contactType === "owner")) {
      fetchContactInfo();
    }
  }, [open, contactId, contactType]);

  const fetchContactInfo = async () => {
    setIsLoading(true);
    try {
      if (contactType === "lead") {
        const { data } = await supabase
          .from("leads")
          .select("*")
          .eq("id", contactId)
          .single();
        
        if (data) {
          setLeadInfo(data);
        }
      } else if (contactType === "owner") {
        const { data: owner } = await supabase
          .from("property_owners")
          .select("*")
          .eq("id", contactId)
          .single();

        if (owner) {
          const { data: properties } = await supabase
            .from("properties")
            .select("id, name, address")
            .eq("owner_id", owner.id);

          setOwnerInfo({
            ...owner,
            properties: properties || [],
          });
        }
      }
    } catch (error) {
      console.error("Error fetching contact info:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      new_lead: "bg-blue-100 text-blue-800",
      contacted: "bg-yellow-100 text-yellow-800",
      qualified: "bg-green-100 text-green-800",
      proposal_sent: "bg-purple-100 text-purple-800",
      won: "bg-emerald-100 text-emerald-800",
      lost: "bg-red-100 text-red-800",
    };
    return colors[stage] || "bg-gray-100 text-gray-800";
  };

  const handleViewDetails = () => {
    onOpenChange(false);
    if (contactType === "lead") {
      navigate("/leads");
    } else if (contactType === "owner") {
      navigate("/property-owners");
    }
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="sm:max-w-md">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Contact Information
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>

        <div className="p-4 md:p-6">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Basic Info */}
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-semibold text-primary">
                  {contactName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{contactName}</h3>
                <Badge variant="outline" className="mt-1 capitalize">
                  {contactType}
                </Badge>
              </div>
            </div>

            {/* Contact details */}
            <div className="space-y-2 text-sm">
              {(contactPhone || leadInfo?.phone || ownerInfo?.phone) && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{contactPhone || leadInfo?.phone || ownerInfo?.phone}</span>
                </div>
              )}
              {(contactEmail || leadInfo?.email || ownerInfo?.email) && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>{contactEmail || leadInfo?.email || ownerInfo?.email}</span>
                </div>
              )}
            </div>

            {/* Lead-specific info */}
            {leadInfo && (
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Stage:</span>
                  <Badge className={getStageColor(leadInfo.stage)}>
                    {leadInfo.stage.replace("_", " ")}
                  </Badge>
                </div>

                {leadInfo.property_address && (
                  <div className="flex items-start gap-3 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mt-0.5" />
                    <span>{leadInfo.property_address}</span>
                  </div>
                )}

                {leadInfo.property_type && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Building className="h-4 w-4" />
                    <span>{leadInfo.property_type}</span>
                  </div>
                )}

                {leadInfo.opportunity_value && leadInfo.opportunity_value > 0 && (
                  <div className="text-sm">
                    <span className="font-medium">Opportunity Value: </span>
                    <span className="text-primary font-semibold">
                      ${leadInfo.opportunity_value.toLocaleString()}
                    </span>
                  </div>
                )}

                {leadInfo.notes && (
                  <div className="text-sm">
                    <span className="font-medium">Notes: </span>
                    <span className="text-muted-foreground">{leadInfo.notes}</span>
                  </div>
                )}

                {leadInfo.tags && leadInfo.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {leadInfo.tags.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Owner-specific info */}
            {ownerInfo && ownerInfo.properties.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <span className="text-sm font-medium">Properties:</span>
                <div className="space-y-1">
                  {ownerInfo.properties.map((property) => (
                    <div
                      key={property.id}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <Building className="h-3.5 w-3.5" />
                      <span>{property.name || property.address}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* External/unknown contact */}
            {contactType === "external" && (
              <div className="text-sm text-muted-foreground pt-2 border-t">
                This is an external contact not linked to a lead or owner in the system.
              </div>
            )}

            {/* AI Memory Panel */}
            {(contactType === "lead" || contactType === "owner") && (
              <div className="pt-2 border-t">
                <ContactMemoriesPanel
                  leadId={contactType === "lead" ? contactId : undefined}
                  ownerId={contactType === "owner" ? contactId : undefined}
                  contactPhone={contactPhone}
                  contactName={contactName}
                />
              </div>
            )}

            {/* Actions */}
            {(contactType === "lead" || contactType === "owner") && (
              <div className="pt-2">
                <Button onClick={handleViewDetails} className="w-full" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Full Details
                </Button>
              </div>
            )}
          </div>
          </div>
        </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
