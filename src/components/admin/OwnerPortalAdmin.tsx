import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Users,
  Mail,
  ExternalLink,
  RefreshCw,
  Eye,
  Building2,
  Calendar,
  TrendingUp,
  DollarSign,
  Send,
  CheckCircle,
  Clock,
  Search,
} from "lucide-react";

interface OwnerWithProperty {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  second_owner_name: string | null;
  second_owner_email: string | null;
  property_id: string | null;
  property_name: string | null;
  property_address: string | null;
  last_invite_sent: string | null;
  last_portal_access: string | null;
}

interface OwnerStats {
  totalOwners: number;
  withProperties: number;
  invitedThisMonth: number;
  activeThisMonth: number;
}

interface OwnerDashboardData {
  owner: OwnerWithProperty;
  statements: Array<{
    id: string;
    reconciliation_month: string;
    total_revenue: number;
    net_to_owner: number;
    status: string;
  }>;
  bookings: Array<{
    id: string;
    guest_name: string | null;
    check_in: string | null;
    check_out: string | null;
    total_amount: number;
  }>;
  recentExpenses: Array<{
    id: string;
    date: string;
    amount: number;
    purpose: string | null;
    vendor: string | null;
  }>;
}

export function OwnerPortalAdmin() {
  const [owners, setOwners] = useState<OwnerWithProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);
  const [stats, setStats] = useState<OwnerStats>({
    totalOwners: 0,
    withProperties: 0,
    invitedThisMonth: 0,
    activeThisMonth: 0,
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<OwnerDashboardData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [allOwnerProperties, setAllOwnerProperties] = useState<OwnerWithProperty[]>([]);

  useEffect(() => {
    loadOwners();
  }, []);

  const loadOwners = async () => {
    setLoading(true);
    try {
      // Load owners with their properties
      const { data: ownersData, error } = await supabase
        .from("property_owners")
        .select(`
          id,
          name,
          email,
          phone,
          second_owner_name,
          second_owner_email
        `)
        .order("name");

      if (error) throw error;

      // Load properties to match with owners
      const { data: propertiesData } = await supabase
        .from("properties")
        .select("id, name, address, owner_id")
        .is("offboarded_at", null);

      // Load portal sessions to track invites
      const { data: sessionsData } = await supabase
        .from("owner_portal_sessions")
        .select("owner_id, created_at, used_at")
        .order("created_at", { ascending: false });

      // Combine data
      const ownersWithProperties: OwnerWithProperty[] = (ownersData || []).map((owner) => {
        const property = propertiesData?.find((p) => p.owner_id === owner.id);
        const sessions = sessionsData?.filter((s) => s.owner_id === owner.id) || [];
        const lastInvite = sessions[0];
        const lastAccess = sessions.find((s) => s.used_at);

        return {
          ...owner,
          property_id: property?.id || null,
          property_name: property?.name || null,
          property_address: property?.address || null,
          last_invite_sent: lastInvite?.created_at || null,
          last_portal_access: lastAccess?.used_at || null,
        };
      });

      setOwners(ownersWithProperties);

      // Calculate stats
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      setStats({
        totalOwners: ownersWithProperties.length,
        withProperties: ownersWithProperties.filter((o) => o.property_id).length,
        invitedThisMonth: ownersWithProperties.filter(
          (o) => o.last_invite_sent && new Date(o.last_invite_sent) >= thisMonth
        ).length,
        activeThisMonth: ownersWithProperties.filter(
          (o) => o.last_portal_access && new Date(o.last_portal_access) >= thisMonth
        ).length,
      });
    } catch (error) {
      console.error("Error loading owners:", error);
      toast.error("Failed to load owners");
    } finally {
      setLoading(false);
    }
  };

  const sendInvite = async (owner: OwnerWithProperty) => {
    if (!owner.property_id) {
      toast.error("Owner has no active property");
      return;
    }

    setSendingInvite(owner.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/owner-magic-link`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            ownerId: owner.id,
            email: owner.email,
            propertyId: owner.property_id,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send invite");
      }

      toast.success(`Portal invite sent to ${owner.email}`);
      loadOwners(); // Refresh to show updated invite date
    } catch (error: unknown) {
      console.error("Error sending invite:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send invite");
    } finally {
      setSendingInvite(null);
    }
  };

  const openPortalAsOwner = async (owner: OwnerWithProperty) => {
    if (!owner.property_id) {
      toast.error("Owner has no active property");
      return;
    }

    try {
      // Create a real session token in the database (works across domains/tabs)
      const token = crypto.randomUUID();
      const { error } = await supabase
        .from("owner_portal_sessions")
        .insert({
          owner_id: owner.id,
          email: owner.email,
          token: token,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          is_admin_preview: true,
          property_id: owner.property_id,
          property_name: owner.property_name,
        });

      if (error) {
        console.error("Error creating session:", error);
        toast.error("Failed to create portal session");
        return;
      }
      
      // Open the owner portal with the token in URL
      window.open(`/owner?token=${token}`, "_blank");
      toast.success(`Opening portal as ${owner.name}`);
    } catch (error) {
      console.error("Error opening portal:", error);
      toast.error("Failed to open portal");
    }
  };

  const loadOwnerPreview = async (owner: OwnerWithProperty) => {
    if (!owner.property_id) {
      toast.error("Owner has no active property");
      return;
    }

    setLoadingPreview(true);
    setPreviewOpen(true);
    
    // Store the current owner and all owners with properties for switching
    setAllOwnerProperties(owners.filter(o => o.property_id));

    await loadPreviewDataForOwner(owner);
  };

  const loadPreviewDataForOwner = async (owner: OwnerWithProperty) => {
    if (!owner.property_id) return;
    
    setLoadingPreview(true);
    try {
      // Load statements
      const { data: statements } = await supabase
        .from("monthly_reconciliations")
        .select("id, reconciliation_month, total_revenue, net_to_owner, status")
        .eq("property_id", owner.property_id)
        .in("status", ["statement_sent", "approved"])
        .order("reconciliation_month", { ascending: false })
        .limit(12);

      // Load bookings
      const { data: bookings } = await supabase
        .from("ownerrez_bookings")
        .select("id, guest_name, check_in, check_out, total_amount")
        .eq("property_id", owner.property_id)
        .order("check_in", { ascending: false })
        .limit(10);

      // Load expenses
      const { data: expenses } = await supabase
        .from("expenses")
        .select("id, date, amount, purpose, vendor")
        .eq("property_id", owner.property_id)
        .order("date", { ascending: false })
        .limit(10);

      setPreviewData({
        owner,
        statements: statements || [],
        bookings: bookings || [],
        recentExpenses: expenses || [],
      });
    } catch (error) {
      console.error("Error loading preview:", error);
      toast.error("Failed to load owner dashboard");
    } finally {
      setLoadingPreview(false);
    }
  };

  const filteredOwners = owners.filter(
    (o) =>
      o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.property_address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Owners</p>
                <p className="text-2xl font-bold">{stats.totalOwners}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">With Properties</p>
                <p className="text-2xl font-bold">{stats.withProperties}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Send className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Invited (Month)</p>
                <p className="text-2xl font-bold">{stats.invitedThisMonth}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active (Month)</p>
                <p className="text-2xl font-bold">{stats.activeThisMonth}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search owners..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={loadOwners}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Owners Table */}
      <Card>
        <CardHeader>
          <CardTitle>Owner Portal Management</CardTitle>
          <CardDescription>
            Send portal invites and preview owner dashboards
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Owner</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Last Invite</TableHead>
                <TableHead>Last Access</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOwners.map((owner) => (
                <TableRow key={owner.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{owner.name}</p>
                      <p className="text-sm text-muted-foreground">{owner.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {owner.property_address ? (
                      <div className="max-w-[200px] truncate" title={owner.property_address}>
                        {owner.property_address}
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-amber-600">
                        No Property
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {owner.last_invite_sent ? (
                      <div className="flex items-center gap-1 text-sm">
                        <Mail className="h-3 w-3" />
                        {format(new Date(owner.last_invite_sent), "MMM d, yyyy")}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Never</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {owner.last_portal_access ? (
                      <div className="flex items-center gap-1 text-sm text-emerald-600">
                        <CheckCircle className="h-3 w-3" />
                        {format(new Date(owner.last_portal_access), "MMM d, yyyy")}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Not accessed
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loadOwnerPreview(owner)}
                        disabled={!owner.property_id}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPortalAsOwner(owner)}
                        disabled={!owner.property_id}
                        title="Open full portal as this owner"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Open Portal
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => sendInvite(owner)}
                        disabled={sendingInvite === owner.id || !owner.property_id}
                      >
                        {sendingInvite === owner.id ? (
                          <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-1" />
                        )}
                        Send Invite
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Owner Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Owner Dashboard Preview
                </DialogTitle>
                <DialogDescription>
                  {previewData?.owner.name} - {previewData?.owner.property_address}
                </DialogDescription>
              </div>
              {/* Property Switcher */}
              {allOwnerProperties.length > 1 && (
                <Select 
                  value={previewData?.owner.id || ""} 
                  onValueChange={(ownerId) => {
                    const owner = allOwnerProperties.find(o => o.id === ownerId);
                    if (owner) loadPreviewDataForOwner(owner);
                  }}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Switch property" />
                  </SelectTrigger>
                  <SelectContent>
                    {allOwnerProperties.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        <span className="truncate max-w-[180px]">{o.property_address || o.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </DialogHeader>

          {loadingPreview ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : previewData ? (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm text-muted-foreground">YTD Revenue</span>
                    </div>
                    <p className="text-xl font-bold mt-1">
                      {formatCurrency(
                        previewData.statements.reduce((sum, s) => sum + (s.total_revenue || 0), 0)
                      )}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-muted-foreground">YTD Net</span>
                    </div>
                    <p className="text-xl font-bold mt-1">
                      {formatCurrency(
                        previewData.statements.reduce((sum, s) => sum + (s.net_to_owner || 0), 0)
                      )}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-purple-600" />
                      <span className="text-sm text-muted-foreground">Statements</span>
                    </div>
                    <p className="text-xl font-bold mt-1">{previewData.statements.length}</p>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="statements">
                <TabsList>
                  <TabsTrigger value="statements">Statements</TabsTrigger>
                  <TabsTrigger value="bookings">Bookings</TabsTrigger>
                  <TabsTrigger value="expenses">Expenses</TabsTrigger>
                </TabsList>

                <TabsContent value="statements" className="mt-4">
                  {previewData.statements.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No statements available</p>
                  ) : (
                    <div className="space-y-2">
                      {previewData.statements.map((s) => (
                        <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">
                              {format(new Date(s.reconciliation_month), "MMMM yyyy")}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Revenue: {formatCurrency(s.total_revenue || 0)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-emerald-600">
                              {formatCurrency(s.net_to_owner || 0)}
                            </p>
                            <Badge variant="secondary">{s.status}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="bookings" className="mt-4">
                  {previewData.bookings.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No bookings available</p>
                  ) : (
                    <div className="space-y-2">
                      {previewData.bookings.map((b) => (
                        <div key={b.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{b.guest_name || "Guest"}</p>
                            <p className="text-sm text-muted-foreground">
                              {b.check_in && format(new Date(b.check_in), "MMM d")} -{" "}
                              {b.check_out && format(new Date(b.check_out), "MMM d, yyyy")}
                            </p>
                          </div>
                          <p className="font-mono font-medium">{formatCurrency(b.total_amount)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="expenses" className="mt-4">
                  {previewData.recentExpenses.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">No expenses available</p>
                  ) : (
                    <div className="space-y-2">
                      {previewData.recentExpenses.map((e) => (
                        <div key={e.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{e.purpose || e.vendor || "Expense"}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(e.date), "MMM d, yyyy")}
                            </p>
                          </div>
                          <p className="font-mono font-medium">{formatCurrency(e.amount)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
