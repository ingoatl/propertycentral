import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  User, Phone, Mail, MessageCircle, Mic, 
  Sparkles, ChevronRight, Loader2
} from "lucide-react";
import { SendSMSDialog } from "@/components/communications/SendSMSDialog";
import { SendVoicemailDialog } from "@/components/communications/SendVoicemailDialog";
import { OWNER_MAINTENANCE_TEMPLATES, fillTemplate, OwnerMessageTemplate } from "./ownerMessageTemplates";

interface OwnerInfo {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

interface WorkOrderSummary {
  summary: string;
  keyFacts: {
    vendorName: string | null;
    quotedAmount: number | null;
    scope: string;
    status: string;
    nextStep: string;
  };
  suggestedAction: string | null;
  messageCount: number;
}

interface MessageOwnerPanelProps {
  workOrderId: string;
  owner: OwnerInfo | null;
  propertyAddress: string;
  workOrderTitle: string;
  workOrderDescription?: string;
  vendorQuoteAmount?: number | null;
  vendorName?: string | null;
  totalCost?: number | null;
}

export function MessageOwnerPanel({
  workOrderId,
  owner,
  propertyAddress,
  workOrderTitle,
  workOrderDescription,
  vendorQuoteAmount,
  vendorName,
  totalCost,
}: MessageOwnerPanelProps) {
  const [showSMSDialog, setShowSMSDialog] = useState(false);
  const [showVoicemailDialog, setShowVoicemailDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<OwnerMessageTemplate | null>(null);
  const [prefilledMessage, setPrefilledMessage] = useState("");
  const [expandedTemplates, setExpandedTemplates] = useState(false);

  // Fetch AI summary of vendor communications
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ["work-order-summary", workOrderId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("summarize-work-order-communication", {
        body: { workOrderId }
      });
      if (error) throw error;
      return data as WorkOrderSummary;
    },
    staleTime: 60000, // 1 minute
  });

  // Get current user for sender name
  const { data: currentUser } = useQuery({
    queryKey: ["current-user-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      // Profiles table uses 'id' as user identifier
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email")
        .eq("id", user.id)
        .single();
      
      return {
        id: user.id,
        email: user.email || profile?.email,
        fullName: user.email?.split("@")[0] || "Property Manager"
      };
    },
  });

  const templateVariables = {
    owner_name: owner?.name?.split(" ")[0] || "there",
    property_address: propertyAddress || "your property",
    quote_amount: vendorQuoteAmount?.toString() || "[quote]",
    work_description: workOrderDescription || workOrderTitle || "[work description]",
    total_cost: (totalCost || vendorQuoteAmount)?.toString() || "[total]",
    vendor_name: vendorName || "[vendor]",
    sender_name: currentUser?.fullName || "Alex",
    additional_issue: "[describe issue]",
    available_times: "[available times]",
    emergency_details: "[emergency details]",
  };

  const handleTemplateClick = (template: OwnerMessageTemplate, type: "sms" | "voice") => {
    setSelectedTemplate(template);
    const filledMessage = fillTemplate(
      type === "sms" ? template.sms : template.voice,
      templateVariables
    );
    setPrefilledMessage(filledMessage);
    
    if (type === "sms") {
      setShowSMSDialog(true);
    } else {
      setShowVoicemailDialog(true);
    }
  };

  const handleQuickSMS = () => {
    setSelectedTemplate(null);
    setPrefilledMessage("");
    setShowSMSDialog(true);
  };

  const handleQuickVoice = () => {
    setSelectedTemplate(null);
    setPrefilledMessage("");
    setShowVoicemailDialog(true);
  };

  // Find suggested template based on AI analysis
  const suggestedTemplate = summary?.suggestedAction 
    ? OWNER_MAINTENANCE_TEMPLATES.find(t => t.id === summary.suggestedAction)
    : null;

  if (!owner) {
    return (
      <Card className="border-border/50 bg-muted/30">
        <CardContent className="p-4 text-center text-muted-foreground">
          <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No owner information available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/50 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 p-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Property Owner</span>
            </div>
          </div>
        </div>
        
        <CardContent className="p-4 space-y-4">
          {/* Owner Info */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <User className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{owner.name}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {owner.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {owner.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleQuickSMS}
              disabled={!owner.phone}
              className="w-full"
            >
              <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
              Text Owner
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleQuickVoice}
              disabled={!owner.phone}
              className="w-full"
            >
              <Mic className="h-3.5 w-3.5 mr-1.5" />
              Voice Message
            </Button>
          </div>

          <Separator />

          {/* AI Summary Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Sparkles className="h-3 w-3 text-primary" />
                AI Summary
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => refetchSummary()}
              >
                Refresh
              </Button>
            </div>
            
            {summaryLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : summary ? (
              <div className="text-sm text-foreground bg-muted/50 rounded-lg p-3">
                <p className="leading-relaxed">{summary.summary}</p>
                {summary.keyFacts.quotedAmount && (
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      Quote: ${summary.keyFacts.quotedAmount}
                    </Badge>
                    {summary.keyFacts.vendorName && (
                      <Badge variant="outline" className="text-xs">
                        {summary.keyFacts.vendorName}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No vendor communication yet</p>
            )}
          </div>

          <Separator />

          {/* Quick Templates */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Quick Templates
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setExpandedTemplates(!expandedTemplates)}
              >
                {expandedTemplates ? "Show Less" : "Show All"}
              </Button>
            </div>

            {/* Suggested Template (if available) */}
            {suggestedTemplate && (
              <div className="p-2 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span className="text-xs font-medium text-primary">Suggested</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 justify-start gap-2"
                    onClick={() => handleTemplateClick(suggestedTemplate, "sms")}
                  >
                    <suggestedTemplate.icon className="h-3.5 w-3.5" />
                    {suggestedTemplate.label}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTemplateClick(suggestedTemplate, "voice")}
                  >
                    <Mic className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* Template Grid */}
            <div className="grid grid-cols-1 gap-1.5">
              {(expandedTemplates ? OWNER_MAINTENANCE_TEMPLATES : OWNER_MAINTENANCE_TEMPLATES.slice(0, 3))
                .filter(t => t.id !== suggestedTemplate?.id)
                .map((template) => (
                  <div key={template.id} className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 justify-start gap-2 text-xs h-8"
                      onClick={() => handleTemplateClick(template, "sms")}
                    >
                      <template.icon className="h-3.5 w-3.5" />
                      {template.label}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleTemplateClick(template, "voice")}
                    >
                      <Mic className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SMS Dialog */}
      <SendSMSDialog
        open={showSMSDialog}
        onOpenChange={setShowSMSDialog}
        contactName={owner.name}
        contactPhone={owner.phone || ""}
        contactType="owner"
        contactId={owner.id}
        workOrderId={workOrderId}
      />

      {/* Voicemail Dialog */}
      <SendVoicemailDialog
        open={showVoicemailDialog}
        onOpenChange={setShowVoicemailDialog}
        recipientName={owner.name}
        recipientPhone={owner.phone || ""}
        ownerId={owner.id}
        workOrderId={workOrderId}
      />
    </>
  );
}
