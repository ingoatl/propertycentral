import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, DollarSign, RefreshCw, CheckCircle, XCircle, Clock, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface MonthlyCharge {
  id: string;
  owner_id: string;
  charge_month: string;
  total_management_fees: number;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
  charge_status: "pending" | "processing" | "succeeded" | "failed" | "refunded";
  charged_at: string | null;
  created_at: string;
}

interface PropertyOwner {
  id: string;
  name: string;
  email: string;
  payment_method: "card" | "ach";
}

interface ChargeWithOwner extends MonthlyCharge {
  owner: PropertyOwner;
}

const MonthlyCharges = () => {
  const [charges, setCharges] = useState<ChargeWithOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [charging, setCharging] = useState(false);

  useEffect(() => {
    checkAdminStatus();
    loadCharges();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      setIsAdmin(!!roles);
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  };

  const loadCharges = async () => {
    try {
      setLoading(true);

      const { data: chargesData, error: chargesError } = await supabase
        .from("monthly_charges")
        .select("*")
        .order("charge_month", { ascending: false });

      if (chargesError) throw chargesError;

      const { data: ownersData, error: ownersError } = await supabase
        .from("property_owners")
        .select("*");

      if (ownersError) throw ownersError;

      const ownersMap = new Map(ownersData.map(owner => [owner.id, owner]));

      const chargesWithOwners = (chargesData || [])
        .map(charge => ({
          ...charge,
          owner: ownersMap.get(charge.owner_id),
        }))
        .filter(charge => charge.owner) as ChargeWithOwner[];

      setCharges(chargesWithOwners);
    } catch (error: any) {
      console.error("Error loading charges:", error);
      toast.error("Failed to load charges");
    } finally {
      setLoading(false);
    }
  };

  const handleChargeMonthlyFees = async () => {
    if (!confirm("This will charge all property owners for the previous month's management fees. Continue?")) {
      return;
    }

    setCharging(true);
    toast.loading("Processing monthly charges...");

    try {
      const { data, error } = await supabase.functions.invoke("charge-monthly-fees");

      if (error) throw error;

      console.log("Charge results:", data);

      toast.dismiss();
      
      const results = data.results || [];
      const succeeded = results.filter((r: any) => r.status === "charged").length;
      const failed = results.filter((r: any) => r.status === "failed").length;
      const skipped = results.filter((r: any) => r.status === "skipped").length;

      toast.success(
        `Monthly charges processed! ${succeeded} charged, ${failed} failed, ${skipped} skipped`
      );

      loadCharges();
    } catch (error: any) {
      console.error("Error charging fees:", error);
      toast.dismiss();
      toast.error(error.message || "Failed to process monthly charges");
    } finally {
      setCharging(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "succeeded":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "processing":
        return <Clock className="w-4 h-4 text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-amber-500" />;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "succeeded":
        return "default";
      case "failed":
        return "destructive";
      case "processing":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You need admin privileges to access this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="pb-4 border-b border-border/50 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Monthly Charges
          </h1>
          <p className="text-muted-foreground mt-1">Manage and track monthly management fee charges</p>
        </div>
        <Button
          className="gap-2"
          onClick={handleChargeMonthlyFees}
          disabled={charging}
        >
          <DollarSign className="w-4 h-4" />
          {charging ? "Processing..." : "Charge This Month's Fees"}
        </Button>
      </div>

      <Card className="bg-gradient-subtle border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            How Monthly Charging Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            When you click "Charge This Month's Fees", the system will:
          </p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Calculate management fees from all OwnerRez bookings for the <strong>previous month</strong></li>
            <li>Group fees by property owner</li>
            <li>Create Stripe payment intents using each owner's preferred payment method (Card or ACH)</li>
            <li>Record the charge status in this table</li>
          </ol>
          <p className="mt-4">
            <strong>Note:</strong> For ACH payments, make sure the bank account is set up in Stripe first.
            For credit card payments, the owner will receive a payment link if not set up.
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-card border-border/50">
        <CardHeader className="bg-gradient-subtle rounded-t-lg">
          <CardTitle>Charge History</CardTitle>
          <CardDescription>
            All monthly charges and their status
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {charges.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No charges yet. Click "Charge This Month's Fees" to create the first batch.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Charged Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {charges.map((charge) => (
                  <TableRow key={charge.id}>
                    <TableCell className="font-medium">
                      {format(new Date(charge.charge_month), "MMMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{charge.owner.name}</p>
                        <p className="text-xs text-muted-foreground">{charge.owner.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {charge.owner.payment_method === "ach" ? "ACH" : "Card"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">
                      ${Number(charge.total_management_fees).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(charge.charge_status)} className="gap-1">
                        {getStatusIcon(charge.charge_status)}
                        {charge.charge_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {charge.charged_at
                        ? format(new Date(charge.charged_at), "MMM d, yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {charge.stripe_payment_intent_id && (
                        <a
                          href={`https://dashboard.stripe.com/payments/${charge.stripe_payment_intent_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          View in Stripe
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MonthlyCharges;
