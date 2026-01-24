import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Users,
  Mail,
  ExternalLink,
  RefreshCw,
  Building2,
  TrendingUp,
  Send,
  CheckCircle,
  Clock,
  CreditCard,
  Sparkles,
  Play,
  FileText,
  RotateCw,
  Megaphone,
  Archive,
  ArchiveRestore,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OwnerReportModal } from "./OwnerReportModal";

interface OwnerProperty {
  id: string;
  name: string;
  address: string | null;
}

interface OwnerWithProperties {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  second_owner_name: string | null;
  second_owner_email: string | null;
  properties: OwnerProperty[];
  last_invite_sent: string | null;
  last_portal_access: string | null;
  stripe_customer_id: string | null;
  payment_method: string | null;
  has_payment_method: boolean;
  is_archived: boolean;
}

interface OwnerStats {
  totalOwners: number;
  withProperties: number;
  invitedThisMonth: number;
  activeThisMonth: number;
}

export function OwnerPortalAdmin() {
  const [owners, setOwners] = useState<OwnerWithProperties[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);
  const [sendingRecap, setSendingRecap] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [syncingPayments, setSyncingPayments] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [reportModal, setReportModal] = useState<{
    open: boolean;
    owner: OwnerWithProperties | null;
    property: OwnerProperty | null;
  }>({ open: false, owner: null, property: null });
  const [stats, setStats] = useState<OwnerStats>({
    totalOwners: 0,
    withProperties: 0,
    invitedThisMonth: 0,
    activeThisMonth: 0,
  });

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
          second_owner_email,
          stripe_customer_id,
          payment_method,
          has_payment_method,
          is_archived
        `)
        .order("name");

      if (error) throw error;

      // Load properties to match with owners (including offboarded for archived owners)
      const { data: propertiesData } = await supabase
        .from("properties")
        .select("id, name, address, owner_id, offboarded_at");

      // Load portal sessions to track invites
      const { data: sessionsData } = await supabase
        .from("owner_portal_sessions")
        .select("owner_id, created_at, used_at")
        .order("created_at", { ascending: false });

      // Combine data - support multiple properties per owner
      const ownersWithProperties: OwnerWithProperties[] = (ownersData || []).map((owner) => {
        // For archived owners, include offboarded properties; for active owners, only active properties
        const ownerProperties = propertiesData?.filter((p) => {
          if (p.owner_id !== owner.id) return false;
          if (owner.is_archived) return true; // Show all properties for archived owners
          return !p.offboarded_at; // Only active properties for active owners
        }) || [];
        const sessions = sessionsData?.filter((s) => s.owner_id === owner.id) || [];
        const lastInvite = sessions[0];
        const lastAccess = sessions.find((s) => s.used_at);

        return {
          ...owner,
          properties: ownerProperties.map(p => ({
            id: p.id,
            name: p.name,
            address: p.address,
          })),
          last_invite_sent: lastInvite?.created_at || null,
          last_portal_access: lastAccess?.used_at || null,
          is_archived: owner.is_archived || false,
        };
      });

      setOwners(ownersWithProperties);

      // Calculate stats
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      setStats({
        totalOwners: ownersWithProperties.length,
        withProperties: ownersWithProperties.filter((o) => o.properties.length > 0).length,
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

  const syncPaymentMethods = async () => {
    setSyncingPayments(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-owner-payment-method`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ syncAll: true }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to sync payment methods");
      }

      toast.success(`Synced ${result.synced} owners, ${result.updated} updated`);
      loadOwners();
    } catch (error: unknown) {
      console.error("Error syncing payments:", error);
      toast.error(error instanceof Error ? error.message : "Failed to sync payments");
    } finally {
      setSyncingPayments(false);
    }
  };

  const openReportModal = (owner: OwnerWithProperties, property: OwnerProperty) => {
    setReportModal({ open: true, owner, property });
  };
  const sendInvite = async (owner: OwnerWithProperties, propertyId: string) => {
    if (!propertyId) {
      toast.error("No property selected");
      return;
    }

    setSendingInvite(`${owner.id}-${propertyId}`);
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
            owner_id: owner.id,
            property_id: propertyId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send invite");
      }

      toast.success(`Portal invite sent to ${owner.email}`);
      loadOwners();
    } catch (error: unknown) {
      console.error("Error sending invite:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send invite");
    } finally {
      setSendingInvite(null);
    }
  };

  const openPortalAsOwner = async (owner: OwnerWithProperties, property: OwnerProperty) => {
    if (!property.id) {
      toast.error("No property selected");
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
          expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(), // Never expires (100 years)
          is_admin_preview: true,
          property_id: property.id,
          property_name: property.name,
        });

      if (error) {
        console.error("Error creating session:", error);
        toast.error("Failed to create portal session");
        return;
      }
      
      // Open the owner portal with the token in URL
      window.open(`/owner?token=${token}`, "_blank");
      toast.success(`Opening portal for ${property.name}`);
    } catch (error) {
      console.error("Error opening portal:", error);
      toast.error("Failed to open portal");
    }
  };

  const openDemoPortal = () => {
    // Use the dedicated Sara Thompson demo portal with pre-configured token
    window.open('/owner?token=demo-portal-token-3069-rita-way', '_blank');
    toast.success('Opening Sara Thompson demo portal');
  };

  // Send monthly recap
  const handleSendMonthlyRecap = async (owner: OwnerWithProperties, property: OwnerProperty) => {
    setSendingRecap(`${owner.id}-${property.id}`);
    try {
      const { error } = await supabase.functions.invoke("send-monthly-owner-recap", {
        body: { 
          property_id: property.id,
          force: true
        },
      });
      
      if (error) throw error;
      toast.success(`Monthly recap sent to ${owner.email}!`, {
        description: `Generated for ${property.name}`
      });
    } catch (error: any) {
      toast.error("Failed to send recap: " + (error.message || "Unknown error"));
    } finally {
      setSendingRecap(null);
    }
  };

  // Archive/Restore owner
  const handleToggleArchive = async (owner: OwnerWithProperties) => {
    const newStatus = !owner.is_archived;
    setArchiving(owner.id);
    try {
      const { error } = await supabase
        .from("property_owners")
        .update({ is_archived: newStatus })
        .eq("id", owner.id);
      if (error) throw error;
      toast.success(newStatus ? "Owner archived - records kept for tax purposes" : "Owner restored to active");
      loadOwners();
    } catch (error: any) {
      toast.error("Failed to update owner: " + (error.message || "Unknown error"));
    } finally {
      setArchiving(null);
    }
  };

  // Filter and separate active/archived owners
  const filteredOwners = owners.filter(
    (o) =>
      o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.properties.some(p => p.address?.toLowerCase().includes(searchTerm.toLowerCase()) || p.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const activeOwners = filteredOwners.filter(o => !o.is_archived);
  const archivedOwners = filteredOwners.filter(o => o.is_archived);


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
          <Input
            placeholder="Search owners..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            className="gap-2 bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200 hover:border-blue-300 text-blue-700"
            onClick={syncPaymentMethods}
            disabled={syncingPayments}
          >
            {syncingPayments ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCw className="h-4 w-4" />
            )}
            Sync Payments
          </Button>
          <Button 
            variant="outline" 
            className="gap-2 bg-gradient-to-r from-amber-100 to-orange-100 border-amber-400 hover:border-amber-500 text-amber-700 font-semibold"
            onClick={openDemoPortal}
          >
            <Sparkles className="h-4 w-4" />
            <Play className="h-3 w-3" />
            DEMO PORTAL (Sara Thompson)
          </Button>
          <Button variant="outline" onClick={loadOwners}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Owners Table */}
      <Card>
        <CardHeader>
          <CardTitle>Owner Portal Management</CardTitle>
          <CardDescription>
            Send portal invites, monthly recaps, and preview owner dashboards
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Owner</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Last Invite</TableHead>
                <TableHead>Last Access</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeOwners.map((owner) => (
                owner.properties.length > 0 ? (
                  owner.properties.map((property, idx) => (
                    <TableRow key={`${owner.id}-${property.id}`}>
                      <TableCell>
                        {idx === 0 && (
                          <div>
                            <p className="font-medium">{owner.name}</p>
                            <p className="text-sm text-muted-foreground">{owner.email}</p>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px]">
                          <p className="font-medium truncate" title={property.name}>{property.name}</p>
                          <p className="text-xs text-muted-foreground truncate" title={property.address || ''}>{property.address}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {idx === 0 && (
                          owner.has_payment_method ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              <CreditCard className="h-3 w-3 mr-1" />
                              {owner.payment_method === 'ach' ? 'ACH' : 'Card'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200">
                              No Payment
                            </Badge>
                          )
                        )}
                      </TableCell>
                      <TableCell>
                        {idx === 0 && owner.last_invite_sent ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3" />
                            {format(new Date(owner.last_invite_sent), "MMM d, yyyy")}
                          </div>
                        ) : idx === 0 ? (
                          <span className="text-muted-foreground text-sm">Never</span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {idx === 0 && owner.last_portal_access ? (
                          <div className="flex items-center gap-1 text-sm text-emerald-600">
                            <CheckCircle className="h-3 w-3" />
                            {format(new Date(owner.last_portal_access), "MMM d, yyyy")}
                          </div>
                        ) : idx === 0 ? (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Not accessed
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openReportModal(owner, property)}
                            title="Generate PDF Report"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSendMonthlyRecap(owner, property)}
                            disabled={sendingRecap === `${owner.id}-${property.id}`}
                            title="Send Monthly Recap (Voice + SMS)"
                          >
                            {sendingRecap === `${owner.id}-${property.id}` ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <Megaphone className="h-4 w-4 text-blue-600" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPortalAsOwner(owner, property)}
                            title={`Open portal for ${property.name}`}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Open
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => sendInvite(owner, property.id)}
                            disabled={sendingInvite === `${owner.id}-${property.id}`}
                          >
                            {sendingInvite === `${owner.id}-${property.id}` ? (
                              <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4 mr-1" />
                            )}
                            Send
                          </Button>
                          {idx === 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem 
                                  onClick={() => handleToggleArchive(owner)}
                                  disabled={archiving === owner.id}
                                >
                                  <Archive className="h-4 w-4 mr-2" />
                                  Archive Owner
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow key={owner.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{owner.name}</p>
                        <p className="text-sm text-muted-foreground">{owner.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-amber-600">
                        No Property
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {owner.has_payment_method ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <CreditCard className="h-3 w-3 mr-1" />
                          {owner.payment_method === 'ach' ? 'ACH' : 'Card'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200">
                          No Payment
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground text-sm">-</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground text-sm">-</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => handleToggleArchive(owner)}
                            disabled={archiving === owner.id}
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            Archive Owner
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Archived Owners Section */}
      {archivedOwners.length > 0 && (
        <Card className="opacity-75">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Archived Owners</CardTitle>
                <Badge variant="outline" className="bg-muted">
                  {archivedOwners.length}
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
              >
                {showArchived ? 'Hide' : 'Show'}
              </Button>
            </div>
            <CardDescription className="text-xs">
              Former clients - tax records preserved
            </CardDescription>
          </CardHeader>
          {showArchived && (
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Owner</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archivedOwners.map((owner) => (
                    <TableRow key={owner.id} className="opacity-60">
                      <TableCell>
                        <div>
                          <p className="font-medium">{owner.name}</p>
                          <p className="text-sm text-muted-foreground">{owner.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {owner.properties.length > 0 ? (
                          <div className="max-w-[200px]">
                            <p className="font-medium truncate">{owner.properties[0].name}</p>
                            <p className="text-xs text-muted-foreground">
                              {owner.properties.length > 1 ? `+${owner.properties.length - 1} more` : ''}
                            </p>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            No Property
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-muted">
                          Former Client
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleArchive(owner)}
                          disabled={archiving === owner.id}
                        >
                          {archiving === owner.id ? (
                            <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <ArchiveRestore className="h-4 w-4 mr-1" />
                          )}
                          Restore
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          )}
        </Card>
      )}

      {/* Report Modal */}
      {reportModal.owner && reportModal.property && (
        <OwnerReportModal
          open={reportModal.open}
          onOpenChange={(open) => setReportModal({ ...reportModal, open })}
          ownerId={reportModal.owner.id}
          ownerName={reportModal.owner.name}
          ownerEmail={reportModal.owner.email}
          propertyId={reportModal.property.id}
          propertyName={reportModal.property.name}
        />
      )}

    </div>
  );
}
