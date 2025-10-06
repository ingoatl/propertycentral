import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, DollarSign, RefreshCw, CheckCircle, XCircle, Clock, ExternalLink, Mail, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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

interface ChargeBreakdownProps {
  charge: ChargeWithOwner;
}

const ChargeBreakdown = ({ charge }: ChargeBreakdownProps) => {
  const [properties, setProperties] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBreakdownData();
  }, [charge.id]);

  const loadBreakdownData = async () => {
    try {
      setLoading(true);
      
      // Get the month range
      const chargeDate = new Date(charge.charge_month);
      const firstDay = new Date(chargeDate.getFullYear(), chargeDate.getMonth(), 1);
      const lastDay = new Date(chargeDate.getFullYear(), chargeDate.getMonth() + 1, 0);

      // Fetch properties for this owner
      const { data: propsData } = await supabase
        .from("properties")
        .select("*")
        .eq("owner_id", charge.owner_id);

      setProperties(propsData || []);

      const propertyIds = (propsData || []).map(p => p.id);

      if (propertyIds.length > 0) {
        // Fetch visits for this month
        const { data: visitsData } = await supabase
          .from("visits")
          .select("*")
          .in("property_id", propertyIds)
          .gte("date", firstDay.toISOString().split('T')[0])
          .lte("date", lastDay.toISOString().split('T')[0]);

        setVisits(visitsData || []);

        // Fetch expenses for this month
        const { data: expensesData } = await supabase
          .from("expenses")
          .select("*")
          .in("property_id", propertyIds)
          .gte("date", firstDay.toISOString().split('T')[0])
          .lte("date", lastDay.toISOString().split('T')[0]);

        setExpenses(expensesData || []);

        // Fetch bookings
        const { data: bookingsData } = await supabase
          .from("ownerrez_bookings")
          .select("*")
          .in("property_id", propertyIds);

        setBookings(bookingsData || []);
      }
    } catch (error) {
      console.error("Error loading breakdown:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading breakdown...</div>;
  }

  const totalRevenue = bookings.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
  const totalVisits = visits.length;
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netIncome = totalRevenue - Number(charge.total_management_fees) - totalExpenses;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-bold text-green-600">${totalRevenue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Management Fees</p>
            <p className="text-2xl font-bold">${Number(charge.total_management_fees).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Expenses</p>
            <p className="text-2xl font-bold text-red-600">${totalExpenses.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Net Income</p>
            <p className="text-2xl font-bold">${netIncome.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Properties ({properties.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {properties.map(prop => (
                <div key={prop.id} className="p-2 border rounded-lg">
                  <p className="font-medium text-sm">{prop.name}</p>
                  <p className="text-xs text-muted-foreground">{prop.address}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visits ({totalVisits})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {visits.map(visit => {
                const prop = properties.find(p => p.id === visit.property_id);
                return (
                  <div key={visit.id} className="p-2 border rounded-lg text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{prop?.name}</span>
                      <span className="text-green-600">${Number(visit.price).toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(visit.date), "MMM d, yyyy")}
                    </p>
                  </div>
                );
              })}
              {visits.length === 0 && (
                <p className="text-sm text-muted-foreground">No visits this month</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expenses ({expenses.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {expenses.map(expense => {
                const prop = properties.find(p => p.id === expense.property_id);
                return (
                  <div key={expense.id} className="p-2 border rounded-lg text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{prop?.name}</span>
                      <span className="text-red-600">${Number(expense.amount).toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{expense.purpose || 'No description'}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(expense.date), "MMM d, yyyy")}
                    </p>
                  </div>
                );
              })}
              {expenses.length === 0 && (
                <p className="text-sm text-muted-foreground">No expenses this month</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bookings ({bookings.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {bookings.map(booking => (
                <div key={booking.id} className="p-2 border rounded-lg text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{booking.ownerrez_listing_name}</span>
                    <span className="text-green-600">${Number(booking.total_amount).toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Fee: ${Number(booking.management_fee).toFixed(2)}
                  </p>
                </div>
              ))}
              {bookings.length === 0 && (
                <p className="text-sm text-muted-foreground">No bookings</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};


const MonthlyCharges = () => {
  const [charges, setCharges] = useState<ChargeWithOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [charging, setCharging] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [expandedCharge, setExpandedCharge] = useState<string | null>(null);

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

  const handleSendTestEmail = async () => {
    setSendingTest(true);
    toast.loading("Sending test monthly statement to ingo@peachhausgroup.com...");

    try {
      const { data, error } = await supabase.functions.invoke("send-monthly-report");

      if (error) throw error;

      toast.dismiss();
      toast.success(`Test email sent successfully! ${data.emailsSent?.length || 0} statements sent.`);
    } catch (error: any) {
      console.error("Error sending test email:", error);
      toast.dismiss();
      toast.error(error.message || "Failed to send test email");
    } finally {
      setSendingTest(false);
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
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleSendTestEmail}
            disabled={sendingTest}
          >
            <Mail className="w-4 h-4" />
            {sendingTest ? "Sending..." : "Send Test Email"}
          </Button>
          <Button
            className="gap-2"
            onClick={handleChargeMonthlyFees}
            disabled={charging}
          >
            <DollarSign className="w-4 h-4" />
            {charging ? "Processing..." : "Charge This Month's Fees"}
          </Button>
        </div>
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
                {charges.map((charge) => {
                  const isExpanded = expandedCharge === charge.id;
                  
                  return (
                    <>
                      <TableRow key={charge.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedCharge(isExpanded ? null : charge.id)}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            {format(new Date(charge.charge_month), "MMMM yyyy")}
                          </div>
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
                        <TableCell onClick={(e) => e.stopPropagation()}>
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
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/30 p-6">
                            <ChargeBreakdown charge={charge} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MonthlyCharges;
