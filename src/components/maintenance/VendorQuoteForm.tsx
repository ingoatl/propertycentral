import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, DollarSign, Calendar as CalendarIcon, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VendorQuoteFormProps {
  requestId: string;
  vendorToken?: string;
}

interface QuoteRequest {
  id: string;
  property_id: string;
  template_id: string;
  status: string;
  deadline_at: string | null;
  property?: { name: string; address: string };
  template?: { name: string; category: string; description: string };
}

export function VendorQuoteForm({ requestId, vendorToken }: VendorQuoteFormProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [quoteRequest, setQuoteRequest] = useState<QuoteRequest | null>(null);
  const [amount, setAmount] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [notes, setNotes] = useState("");
  const [vendorId, setVendorId] = useState<string | null>(null);

  useEffect(() => {
    loadQuoteRequest();
  }, [requestId, vendorToken]);

  const loadQuoteRequest = async () => {
    try {
      // Validate vendor token and get vendor ID
      if (vendorToken) {
        const vendorResult = await (supabase as any)
          .from("vendors")
          .select("id, name")
          .eq("vendor_access_token", vendorToken)
          .single();
        
        if (vendorResult.data) {
          setVendorId(vendorResult.data.id);
        }
      }

      // Fetch quote request details
      const { data, error } = await (supabase as any)
        .from("maintenance_quote_requests")
        .select(`
          id, property_id, template_id, status, deadline_at,
          property:properties(name, address),
          template:preventive_maintenance_templates(name, category, description)
        `)
        .eq("id", requestId)
        .single();

      if (error) throw error;
      setQuoteRequest(data);

      // Check if vendor already submitted a quote
      if (vendorId) {
        const { data: existingQuote } = await supabase
          .from("maintenance_quotes")
          .select("id")
          .eq("request_id", requestId)
          .eq("vendor_id", vendorId)
          .single();

        if (existingQuote) {
          setSubmitted(true);
        }
      }
    } catch (err) {
      console.error("Failed to load quote request:", err);
      toast.error("Failed to load quote request");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!amount || selectedDates.length === 0) {
      toast.error("Please enter an amount and select at least one available date");
      return;
    }

    if (!vendorId) {
      toast.error("Vendor authentication failed");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("maintenance_quotes")
        .insert({
          request_id: requestId,
          vendor_id: vendorId,
          amount: parseFloat(amount),
          estimated_duration_minutes: estimatedMinutes ? parseInt(estimatedMinutes) : null,
          available_dates: selectedDates.map(d => d.toISOString().split("T")[0]),
          notes: notes || null,
          status: "submitted"
        });

      if (error) throw error;

      // Update request status
      await supabase
        .from("maintenance_quote_requests")
        .update({ status: "quoted" })
        .eq("id", requestId);

      setSubmitted(true);
      toast.success("Quote submitted successfully!");
    } catch (err: any) {
      console.error("Failed to submit quote:", err);
      toast.error(err.message || "Failed to submit quote");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!quoteRequest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Quote request not found or has expired.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
            <h2 className="text-xl font-semibold">Quote Submitted!</h2>
            <p className="text-muted-foreground">
              Thank you for submitting your quote. We'll notify you if your quote is accepted.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isExpired = quoteRequest.deadline_at && new Date(quoteRequest.deadline_at) < new Date();

  if (isExpired || quoteRequest.status === "expired" || quoteRequest.status === "accepted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              This quote request is no longer accepting submissions.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline">{quoteRequest.template?.category}</Badge>
              {quoteRequest.deadline_at && (
                <span className="text-xs text-muted-foreground">
                  Due: {new Date(quoteRequest.deadline_at).toLocaleDateString()}
                </span>
              )}
            </div>
            <CardTitle className="text-lg">{quoteRequest.template?.name}</CardTitle>
            <CardDescription>
              {quoteRequest.property?.name}<br />
              <span className="text-xs">{quoteRequest.property?.address}</span>
            </CardDescription>
          </CardHeader>
          {quoteRequest.template?.description && (
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground">{quoteRequest.template.description}</p>
            </CardContent>
          )}
        </Card>

        {/* Quote Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Submit Your Quote
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Quote Amount
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {/* Estimated Duration */}
            <div className="space-y-2">
              <Label htmlFor="duration">Estimated Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                placeholder="e.g., 60"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                min="0"
              />
            </div>

            {/* Available Dates */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Available Dates (select multiple)
              </Label>
              <div className="border rounded-lg p-2 flex justify-center">
                <Calendar
                  mode="multiple"
                  selected={selectedDates}
                  onSelect={(dates) => setSelectedDates(dates || [])}
                  disabled={(date) => date < new Date()}
                  className="pointer-events-auto"
                />
              </div>
              {selectedDates.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedDates.map(date => (
                    <Badge key={date.toISOString()} variant="secondary" className="text-xs">
                      {date.toLocaleDateString()}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any conditions, requirements, or additional details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            {/* Submit */}
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={submitting || !amount || selectedDates.length === 0}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Submit Quote
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
