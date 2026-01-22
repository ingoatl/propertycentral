import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Video, Phone, ExternalLink, Plus } from "lucide-react";
import { format } from "date-fns";
import { formatInEST } from "@/lib/timezone-utils";

interface OwnerUpcomingCallsProps {
  ownerEmail: string;
  ownerName: string;
}

const TOPIC_LABELS: Record<string, string> = {
  monthly_statement: "Monthly Statement",
  maintenance: "Maintenance",
  guest_concerns: "Guest Concerns",
  pricing: "Pricing",
  general_checkin: "Check-in",
  property_update: "Property Update",
  other: "Other",
};

export function OwnerUpcomingCalls({ ownerEmail, ownerName }: OwnerUpcomingCallsProps) {
  const { data: calls = [], isLoading } = useQuery({
    queryKey: ["owner-upcoming-calls", ownerEmail],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("owner_calls")
        .select("*")
        .ilike("contact_email", ownerEmail)
        .in("status", ["scheduled", "confirmed"])
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: !!ownerEmail,
  });

  const generateBookingLink = () => {
    const params = new URLSearchParams();
    params.set("name", ownerName);
    params.set("email", ownerEmail);
    return `https://propertycentral.lovable.app/book-owner-call?${params.toString()}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Scheduled Calls
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(generateBookingLink(), "_blank")}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Schedule a Call
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-4">Loading...</div>
        ) : calls.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-3">No upcoming calls scheduled</p>
            <Button
              variant="default"
              size="sm"
              onClick={() => window.open(generateBookingLink(), "_blank")}
              className="gap-2"
            >
              <Calendar className="h-4 w-4" />
              Book a Call with Your Manager
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {calls.map((call) => (
              <div
                key={call.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {TOPIC_LABELS[call.topic] || "Call"}
                    </Badge>
                    {call.google_meet_link && (
                      <Video className="h-3.5 w-3.5 text-green-600" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>
                      {formatInEST(new Date(call.scheduled_at), "EEE, MMM d 'at' h:mm a")} EST
                    </span>
                  </div>
                </div>
                {call.google_meet_link && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(call.google_meet_link, "_blank")}
                    className="gap-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Join
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
