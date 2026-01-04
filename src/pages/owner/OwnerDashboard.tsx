import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  Receipt,
  TrendingUp,
  FileText,
  Download,
  Calendar,
  DollarSign,
  Home,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface OwnerSession {
  ownerId: string;
  ownerName: string;
  email: string;
  propertyId?: string;
  propertyName?: string;
}

interface Statement {
  id: string;
  reconciliation_month: string;
  total_revenue: number;
  total_expenses: number;
  net_to_owner: number;
  status: string;
}

interface Expense {
  id: string;
  date: string;
  amount: number;
  purpose: string | null;
  vendor: string | null;
  category: string | null;
}

interface PropertyData {
  id: string;
  name: string;
  address: string;
  rental_type: string | null;
}

export default function OwnerDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<OwnerSession | null>(null);
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      validateToken(token);
    } else {
      // Check for existing session in localStorage
      const storedSession = localStorage.getItem("owner_session");
      if (storedSession) {
        try {
          const parsed = JSON.parse(storedSession);
          // Check if session is still valid (30 days)
          const expiresAt = new Date(parsed.expiresAt);
          if (expiresAt > new Date()) {
            setSession(parsed);
            loadOwnerData(parsed.ownerId);
          } else {
            localStorage.removeItem("owner_session");
            setLoading(false);
          }
        } catch {
          localStorage.removeItem("owner_session");
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }
  }, [searchParams]);

  const validateToken = async (token: string) => {
    try {
      const { data, error } = await supabase
        .from("owner_portal_sessions")
        .select(`
          *,
          property_owners(id, name, email)
        `)
        .eq("token", token)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (error || !data) {
        toast.error("Invalid or expired link. Please request a new one.");
        setLoading(false);
        return;
      }

      // Mark token as used
      await supabase
        .from("owner_portal_sessions")
        .update({ used_at: new Date().toISOString() })
        .eq("id", data.id);

      // Create session
      const ownerSession: OwnerSession = {
        ownerId: data.owner_id,
        ownerName: data.property_owners?.name || "Owner",
        email: data.email,
      };

      // Store session with 30-day expiry
      const sessionData = {
        ...ownerSession,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };
      localStorage.setItem("owner_session", JSON.stringify(sessionData));
      setSession(ownerSession);

      // Remove token from URL
      navigate("/owner", { replace: true });
      
      loadOwnerData(data.owner_id);
      toast.success("Welcome to your owner portal!");
    } catch (err) {
      console.error("Token validation error:", err);
      toast.error("Failed to validate access link");
      setLoading(false);
    }
  };

  const loadOwnerData = async (ownerId: string) => {
    try {
      // Load property
      const { data: propertyData } = await supabase
        .from("properties")
        .select("id, name, address, rental_type")
        .eq("owner_id", ownerId)
        .is("offboarded_at", null)
        .single();

      if (propertyData) {
        setProperty(propertyData);

        // Load statements
        const { data: statementsData } = await supabase
          .from("monthly_reconciliations")
          .select("id, reconciliation_month, total_revenue, total_expenses, net_to_owner, status")
          .eq("property_id", propertyData.id)
          .in("status", ["statement_sent", "approved"])
          .order("reconciliation_month", { ascending: false })
          .limit(12);

        setStatements((statementsData || []) as Statement[]);

        // Load recent expenses
        const { data: expensesData } = await supabase
          .from("expenses")
          .select("id, date, amount, purpose, vendor, category")
          .eq("property_id", propertyData.id)
          .order("date", { ascending: false })
          .limit(50);

        setExpenses(expensesData || []);
      }
    } catch (err) {
      console.error("Error loading owner data:", err);
      toast.error("Failed to load your data");
    } finally {
      setLoading(false);
    }
  };

  const downloadStatement = async (statement: Statement) => {
    // Generate PDF path from reconciliation data
    const pdfPath = `${statement.id}.pdf`;
    
    setDownloadingPdf(statement.id);
    try {
      const { data, error } = await supabase.storage
        .from("statement-pdfs")
        .createSignedUrl(pdfPath, 300);

      if (error) {
        // PDF might not exist yet - try to generate it
        toast.error("Statement PDF not available. Please contact support.");
        return;
      }

      window.open(data.signedUrl, "_blank");
    } catch (err) {
      console.error("Download error:", err);
      toast.error("Failed to download statement");
    } finally {
      setDownloadingPdf(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("owner_session");
    setSession(null);
    toast.success("Logged out successfully");
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Home className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Owner Portal</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Access your property dashboard through the secure link in your monthly statement email.
            </p>
            <p className="text-sm text-muted-foreground">
              Don't have a link? Contact us at{" "}
              <a href="mailto:info@peachhausgroup.com" className="text-primary underline">
                info@peachhausgroup.com
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalRevenue = statements.reduce((sum, s) => sum + (s.total_revenue || 0), 0);
  const totalNet = statements.reduce((sum, s) => sum + (s.net_to_owner || 0), 0);
  const latestStatement = statements[0];

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold">{property?.name || "Your Property"}</h1>
              <p className="text-sm text-muted-foreground">{session.ownerName}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">YTD Revenue</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">YTD Net Earnings</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalNet)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Statements</p>
                  <p className="text-2xl font-bold">{statements.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="statements">Statements</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-6">
              {latestStatement && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Latest Statement
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-medium">
                          {format(new Date(latestStatement.reconciliation_month), "MMMM yyyy")}
                        </p>
                        <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                          <span>Revenue: {formatCurrency(latestStatement.total_revenue || 0)}</span>
                          <span>Net: {formatCurrency(latestStatement.net_to_owner || 0)}</span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => downloadStatement(latestStatement)}
                        disabled={downloadingPdf === latestStatement.id}
                      >
                        {downloadingPdf === latestStatement.id ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        Download PDF
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Recent Expenses
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {expenses.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No recent expenses</p>
                  ) : (
                    <div className="space-y-3">
                      {expenses.slice(0, 5).map((expense) => (
                        <div key={expense.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <p className="font-medium">{expense.purpose || expense.category || "Expense"}</p>
                            <p className="text-sm text-muted-foreground">
                              {expense.vendor ? `${expense.vendor} • ` : ""}
                              {format(new Date(expense.date), "MMM d, yyyy")}
                            </p>
                          </div>
                          <p className="font-mono">{formatCurrency(expense.amount)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="statements">
            <Card>
              <CardHeader>
                <CardTitle>Statement History</CardTitle>
              </CardHeader>
              <CardContent>
                {statements.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No statements available yet</p>
                ) : (
                  <div className="space-y-2">
                    {statements.map((statement) => (
                      <div
                        key={statement.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {format(new Date(statement.reconciliation_month), "MMMM yyyy")}
                            </p>
                            <div className="flex gap-3 text-sm text-muted-foreground">
                              <span>Revenue: {formatCurrency(statement.total_revenue || 0)}</span>
                              <span>Net: {formatCurrency(statement.net_to_owner || 0)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{statement.status}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadStatement(statement)}
                            disabled={downloadingPdf === statement.id}
                          >
                            {downloadingPdf === statement.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expenses">
            <Card>
              <CardHeader>
                <CardTitle>Expense History</CardTitle>
              </CardHeader>
              <CardContent>
                {expenses.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No expenses recorded</p>
                ) : (
                  <div className="space-y-2">
                    {expenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <Receipt className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium">{expense.purpose || expense.category || "Expense"}</p>
                            <p className="text-sm text-muted-foreground">
                              {expense.vendor ? `${expense.vendor} • ` : ""}
                              {format(new Date(expense.date), "MMM d, yyyy")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {expense.category && (
                            <Badge variant="outline">{expense.category}</Badge>
                          )}
                          <p className="font-mono font-medium">{formatCurrency(expense.amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>PeachHaus Group LLC • Questions? Email info@peachhausgroup.com</p>
        </div>
      </footer>
    </div>
  );
}
