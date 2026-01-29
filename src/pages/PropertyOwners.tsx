import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, CreditCard, DollarSign, ExternalLink, Plus, Trash2, Wallet, Edit, Phone, Mail, Send, Loader2, MoreVertical, MessageSquare, Eye, FileText, CheckCircle, Users, Calendar } from "lucide-react";
import { ServiceTypeToggle } from "@/components/owners/ServiceTypeToggle";
import { z } from "zod";
import { AddPaymentMethod } from "@/components/AddPaymentMethod";
import { SendOwnerPaymentRequestButton } from "@/components/owners/SendOwnerPaymentRequestButton";
import { OwnerMagicLinkButton } from "@/components/owners/OwnerMagicLinkButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OwnerCommunicationDetail } from "@/components/communications/OwnerCommunicationDetail";

const ownerSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  email: z.string().email("Invalid email address").max(255),
  phone: z.string().optional(),
  payment_method: z.enum(["card", "ach"]),
});

interface PropertyOwner {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  second_owner_name: string | null;
  second_owner_email: string | null;
  stripe_customer_id: string | null;
  payment_method: "card" | "ach";
  has_payment_method: boolean;
  service_type: "full_service" | "cohosting" | null;
  w9_sent_at: string | null;
  w9_uploaded_at: string | null;
  our_w9_sent_at: string | null;
  owner_w9_requested_at: string | null;
  owner_w9_uploaded_at: string | null;
  owner_w9_file_path: string | null;
  is_archived: boolean | null;
  created_at: string;
  updated_at: string;
}

interface Property {
  id: string;
  name: string;
  address: string;
  owner_id: string | null;
}

interface PaymentMethodInfo {
  id: string;
  type: string;
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  } | null;
  us_bank_account: {
    bank_name: string;
    last4: string;
    account_type: string;
  } | null;
}

const PropertyOwners = () => {
  const [owners, setOwners] = useState<PropertyOwner[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newOwner, setNewOwner] = useState({
    name: "",
    email: "",
    phone: "",
    payment_method: "card" as "card" | "ach",
  });
  const [creating, setCreating] = useState(false);
  const [addingPaymentFor, setAddingPaymentFor] = useState<PropertyOwner | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<Record<string, PaymentMethodInfo[]>>({});
  const [editingOwner, setEditingOwner] = useState<PropertyOwner | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    second_owner_name: "",
    second_owner_email: "",
  });
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);
  const [selectedOwnerForComms, setSelectedOwnerForComms] = useState<PropertyOwner | null>(null);
  const [sendingW9, setSendingW9] = useState<string | null>(null);
  const [requestingW9, setRequestingW9] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState<string | null>(null);

  // Open portal with proper session token
  const handleOpenPortal = async (owner: PropertyOwner) => {
    // Get owner's first property
    const ownerProperties = getOwnerProperties(owner.id);
    const property = ownerProperties[0];
    
    if (!property) {
      toast.error("No property assigned to this owner");
      return;
    }

    setOpeningPortal(owner.id);
    try {
      // Create a real session token in the database
      const token = crypto.randomUUID();
      const { error } = await supabase
        .from("owner_portal_sessions")
        .insert({
          owner_id: owner.id,
          email: owner.email,
          token: token,
          expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
          is_admin_preview: true,
          property_id: property.id,
          property_name: property.name,
        });

      if (error) {
        console.error("Error creating session:", error);
        toast.error("Failed to create portal session");
        return;
      }
      
      const portalUrl = `/owner?token=${token}`;
      
      // Check if mobile device
      const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      if (isMobileDevice) {
        // For mobile: use anchor click simulation (most reliable method)
        // Clear loading state before navigation
        setOpeningPortal(null);
        
        // Create and click a temporary anchor element
        const link = document.createElement('a');
        link.href = portalUrl;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return; // Exit immediately - no toast needed, page will navigate
      } else {
        // Desktop: open in new tab
        window.open(portalUrl, "_blank");
        toast.success(`Opening portal for ${property.name}`);
      }
    } catch (error) {
      console.error("Error opening portal:", error);
      toast.error("Failed to open portal");
    } finally {
      setOpeningPortal(null);
    }
  };
  

  // Format date helper
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // View owner's uploaded W-9
  const handleViewOwnerW9 = async (owner: PropertyOwner) => {
    if (!owner.owner_w9_file_path) {
      toast.error("No W-9 file found for this owner");
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from("onboarding-documents")
        .createSignedUrl(owner.owner_w9_file_path, 3600); // 1 hour expiry

      if (error) throw error;

      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (error: any) {
      console.error("Error getting W-9 URL:", error);
      toast.error("Failed to open W-9: " + (error.message || "Unknown error"));
    }
  };

  // Send OUR W-9 to co-hosting clients (they issue 1099 to us)
  const handleSendOurW9 = async (owner: PropertyOwner) => {
    setSendingW9(owner.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-w9-email", {
        body: { ownerId: owner.id, isManualSend: true },
      });

      if (error) throw error;

      toast.success(`Our W-9 sent to ${owner.email}!`, {
        description: "They'll use this to issue us a 1099 at year-end.",
      });
      loadData();
    } catch (error: any) {
      console.error("Error sending W9:", error);
      toast.error("Failed to send W-9: " + (error.message || "Unknown error"));
    } finally {
      setSendingW9(null);
    }
  };

  // Request W-9 FROM full-service clients (we issue 1099 to them)
  const handleRequestOwnerW9 = async (owner: PropertyOwner) => {
    setRequestingW9(owner.id);
    try {
      const { data, error } = await supabase.functions.invoke("request-owner-w9", {
        body: { ownerId: owner.id },
      });

      if (error) throw error;

      if (data.skipped) {
        toast.info(data.message);
      } else {
        toast.success(`W-9 request sent to ${owner.email}!`, {
          description: "They'll receive a link to upload their W-9.",
        });
        loadData();
      }
    } catch (error: any) {
      console.error("Error requesting W9:", error);
      toast.error("Failed to request W-9: " + (error.message || "Unknown error"));
    } finally {
      setRequestingW9(null);
    }
  };

  const handleSendPortalInvite = async (owner: PropertyOwner) => {
    setSendingInvite(owner.id);
    try {
      const { data, error } = await supabase.functions.invoke("owner-magic-link", {
        body: { owner_id: owner.id, send_email: true },
      });

      if (error) throw error;

      toast.success(`Portal invite sent to ${owner.email}!`, {
        description: "They'll receive a magic link to access their dashboard.",
      });
    } catch (error: any) {
      console.error("Error sending portal invite:", error);
      toast.error("Failed to send portal invite: " + (error.message || "Unknown error"));
    } finally {
      setSendingInvite(null);
    }
  };

  useEffect(() => {
    checkAdminStatus();
    loadData();
  }, []);

  useEffect(() => {
    if (owners.length > 0) {
      loadPaymentMethods();
    }
  }, [owners]);

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

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [ownersResult, propertiesResult] = await Promise.all([
        supabase.from("property_owners").select("*").order("name", { ascending: true }),
        supabase.from("properties").select("id, name, address, owner_id").order("name", { ascending: true }),
      ]);

      if (ownersResult.error) throw ownersResult.error;
      if (propertiesResult.error) throw propertiesResult.error;

      setOwners((ownersResult.data || []) as PropertyOwner[]);
      setProperties(propertiesResult.data || []);
      
      console.log("Loaded properties:", propertiesResult.data);
      console.log("Loaded owners:", ownersResult.data);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error("Failed to load property owners");
    } finally {
      setLoading(false);
    }
  };

  const handleAddOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = ownerSchema.safeParse(newOwner);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase
        .from("property_owners")
        .insert([newOwner]);

      if (error) throw error;

      toast.success("Property owner added successfully");
      setAddDialogOpen(false);
      setNewOwner({ name: "", email: "", phone: "", payment_method: "card" });
      loadData();
    } catch (error: any) {
      console.error("Error adding owner:", error);
      toast.error(error.message || "Failed to add property owner");
    } finally {
      setCreating(false);
    }
  };

  const handleAssignProperty = async (propertyId: string, ownerId: string) => {
    try {
      console.log("Assigning property - START:", { propertyId, ownerId });
      
      // Get current user for authentication
      const { data: { user } } = await supabase.auth.getUser();
      console.log("Current user:", user?.id);

      const { data, error } = await supabase
        .from("properties")
        .update({ owner_id: ownerId })
        .eq("id", propertyId)
        .select();

      if (error) {
        console.error("Assignment error details:", error);
        throw error;
      }

      console.log("Assignment successful - data returned:", data);
      toast.success("Property assigned to owner successfully!");
      
      // Reload data to refresh the UI
      await loadData();
    } catch (error: any) {
      console.error("Error in handleAssignProperty:", error);
      toast.error("Failed to assign property: " + (error.message || "Unknown error"));
    }
  };

  const handleDeleteOwner = async (ownerId: string) => {
    if (!confirm("Are you sure you want to delete this owner? This will unassign all their properties.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("property_owners")
        .delete()
        .eq("id", ownerId);

      if (error) throw error;

      toast.success("Property owner deleted");
      loadData();
    } catch (error: any) {
      console.error("Error deleting owner:", error);
      toast.error("Failed to delete property owner");
    }
  };

  const getOwnerProperties = (ownerId: string) => {
    return properties.filter(p => p.owner_id === ownerId);
  };

  const loadPaymentMethods = async () => {
    const methodsMap: Record<string, PaymentMethodInfo[]> = {};
    
    for (const owner of owners) {
      if (!owner.stripe_customer_id) continue;
      
      try {
        const { data, error } = await supabase.functions.invoke("get-payment-methods", {
          body: { ownerId: owner.id },
        });

        if (error) throw error;
        methodsMap[owner.id] = data.paymentMethods || [];
      } catch (error) {
        console.error(`Error loading payment methods for ${owner.name}:`, error);
      }
    }
    
    setPaymentMethods(methodsMap);
  };

  const handlePaymentMethodAdded = async () => {
    setAddingPaymentFor(null);
    // Reload owner data first to get updated stripe_customer_id, then load payment methods
    await loadData();
    await loadPaymentMethods();
    toast.success("Payment method added successfully");
  };

  const handleToggleArchive = async (owner: PropertyOwner) => {
    const newStatus = !owner.is_archived;
    try {
      const { error } = await supabase
        .from("property_owners")
        .update({ is_archived: newStatus })
        .eq("id", owner.id);
      if (error) throw error;
      toast.success(newStatus ? "Owner archived - records kept for tax purposes" : "Owner restored to active");
      loadData();
    } catch (error: any) {
      toast.error("Failed to update owner: " + error.message);
    }
  };

  // Sort owners: active first, then archived at the bottom
  const sortedOwners = [...owners].sort((a, b) => {
    // Archived owners go to the bottom
    if (a.is_archived && !b.is_archived) return 1;
    if (!a.is_archived && b.is_archived) return -1;
    // Within same archive status, sort by name
    return a.name.localeCompare(b.name);
  });
  const activeOwners = owners.filter(o => !o.is_archived);
  const archivedOwners = owners.filter(o => o.is_archived);
  const archivedCount = archivedOwners.length;

  const handleEditOwner = (owner: PropertyOwner) => {
    setEditingOwner(owner);
    setEditForm({
      name: owner.name,
      email: owner.email,
      phone: owner.phone || "",
      second_owner_name: owner.second_owner_name || "",
      second_owner_email: owner.second_owner_email || "",
    });
    setEditDialogOpen(true);
  };

  const handleUpdateOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingOwner) return;

    const validation = z.object({
      name: z.string().min(1, "Name is required").max(255),
      email: z.string().email("Invalid email address").max(255),
      phone: z.string().optional(),
      second_owner_name: z.string().optional(),
      second_owner_email: z.string().email("Invalid email address").optional().or(z.literal("")),
    }).safeParse(editForm);

    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase
        .from("property_owners")
        .update({
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone || null,
          second_owner_name: editForm.second_owner_name || null,
          second_owner_email: editForm.second_owner_email || null,
        })
        .eq("id", editingOwner.id);

      if (error) throw error;

      toast.success("Property owner updated successfully");
      setEditDialogOpen(false);
      setEditingOwner(null);
      loadData();
    } catch (error: any) {
      console.error("Error updating owner:", error);
      toast.error(error.message || "Failed to update property owner");
    } finally {
      setCreating(false);
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

  if (addingPaymentFor) {
    return (
      <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
        <AddPaymentMethod
          ownerId={addingPaymentFor.id}
          ownerName={addingPaymentFor.name}
          paymentMethod={addingPaymentFor.payment_method}
          onSuccess={handlePaymentMethodAdded}
          onCancel={() => setAddingPaymentFor(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="pb-4 border-b border-border/50 flex flex-col gap-3">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Property Owners
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Manage owners and their payment methods</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Owner</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Property Owner</DialogTitle>
              <DialogDescription>
                Add a new property owner. You'll need to set up their payment method in Stripe separately.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddOwner} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Owner Name</Label>
                <Input
                  id="name"
                  value={newOwner.name}
                  onChange={(e) => setNewOwner({ ...newOwner, name: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newOwner.email}
                  onChange={(e) => setNewOwner({ ...newOwner, email: e.target.value })}
                  placeholder="owner@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (Optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={newOwner.phone}
                  onChange={(e) => setNewOwner({ ...newOwner, phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-method">Payment Method Type</Label>
                <Select
                  value={newOwner.payment_method}
                  onValueChange={(value: "card" | "ach") =>
                    setNewOwner({ ...newOwner, payment_method: value })
                  }
                >
                  <SelectTrigger id="payment-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card">Credit Card</SelectItem>
                    <SelectItem value="ach">ACH (Bank Account)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={creating}>
                  {creating ? "Adding..." : "Add Owner"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Edit Owner Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Property Owner</DialogTitle>
            <DialogDescription>
              Update owner contact information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateOwner} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Primary Owner Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="John Doe"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Primary Owner Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="owner@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-second-name">Second Owner Name (Optional)</Label>
              <Input
                id="edit-second-name"
                value={editForm.second_owner_name}
                onChange={(e) => setEditForm({ ...editForm, second_owner_name: e.target.value })}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-second-email">Second Owner Email (Optional)</Label>
              <Input
                id="edit-second-email"
                type="email"
                value={editForm.second_owner_email}
                onChange={(e) => setEditForm({ ...editForm, second_owner_email: e.target.value })}
                placeholder="owner2@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone (Shared)</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6">
        {owners.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center py-8">
                No property owners yet. Add one to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Active Owners */}
            {activeOwners.map((owner) => {
              const ownerProperties = getOwnerProperties(owner.id);
              return (
                <Card key={owner.id} className="shadow-card border-border/50">
                  <CardHeader className="bg-gradient-subtle rounded-t-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="w-5 h-5" />
                          {owner.name}
                        </CardTitle>
                        <CardDescription className="mt-2 space-y-1">
                          <div className="flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5" />
                            {owner.email}
                          </div>
                          {owner.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5" />
                            {owner.phone}
                          </div>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2 items-center">
                      {/* Desktop: Use simplified actions dropdown */}
                      <div className="hidden md:flex gap-2 items-center">
                        {/* Service Type Toggle */}
                        <ServiceTypeToggle
                          ownerId={owner.id}
                          ownerName={owner.name}
                          currentType={owner.service_type || 'cohosting'}
                          onSuccess={loadData}
                        />
                        
                        {/* W-9 Status indicator */}
                        {owner.owner_w9_uploaded_at ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewOwnerW9(owner)}
                            className="text-green-600 gap-1"
                          >
                            <CheckCircle className="w-4 h-4" />
                            W-9 Received
                          </Button>
                        ) : owner.owner_w9_requested_at ? (
                          <Badge variant="outline" className="border-amber-500 text-amber-600">
                            <FileText className="w-3 h-3 mr-1" />
                            W-9 Pending
                          </Badge>
                        ) : null}

                        {/* Portal Invite - Primary CTA */}
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleSendPortalInvite(owner)}
                          disabled={sendingInvite === owner.id}
                          className="gap-2"
                        >
                          {sendingInvite === owner.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                          Invite to Portal
                        </Button>

                        {/* Magic Link for Scheduling */}
                        <OwnerMagicLinkButton
                          ownerName={owner.name}
                          ownerEmail={owner.email}
                          ownerPhone={owner.phone}
                        />

                        {/* Actions Dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 bg-popover">
                            <DropdownMenuItem 
                              onClick={() => handleOpenPortal(owner)}
                              disabled={openingPortal === owner.id}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              {openingPortal === owner.id ? "Opening..." : "View Portal"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSelectedOwnerForComms(owner)}>
                              <MessageSquare className="w-4 h-4 mr-2" />
                              View Messages
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditOwner(owner)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Details
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />
                            
                            {/* W-9 Actions */}
                            {owner.service_type === 'cohosting' ? (
                              <>
                                <DropdownMenuItem 
                                  onClick={() => handleSendOurW9(owner)}
                                  disabled={sendingW9 === owner.id}
                                >
                                  <FileText className="w-4 h-4 mr-2" />
                                  {owner.our_w9_sent_at ? 'Resend Our W-9' : 'Send Our W-9'}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={async () => {
                                    setRequestingW9(owner.id);
                                    try {
                                      const { error } = await supabase.functions.invoke("request-owner-w9", {
                                        body: { ownerId: owner.id, specialReason: "temporary_housing_payments" },
                                      });
                                      if (error) throw error;
                                      toast.success(`Special W-9 request sent to ${owner.email}!`, {
                                        description: "Email explains temporary housing payments."
                                      });
                                      loadData();
                                    } catch (error: any) {
                                      toast.error("Failed: " + (error.message || "Unknown error"));
                                    } finally {
                                      setRequestingW9(null);
                                    }
                                  }}
                                  disabled={requestingW9 === owner.id}
                                >
                                  <FileText className="w-4 h-4 mr-2 text-amber-600" />
                                  Request W-9 (Special)
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem 
                                onClick={() => handleRequestOwnerW9(owner)}
                                disabled={requestingW9 === owner.id}
                              >
                                <FileText className="w-4 h-4 mr-2" />
                                {owner.owner_w9_uploaded_at ? 'View W-9' : owner.owner_w9_requested_at ? 'Resend W-9 Request' : 'Request W-9'}
                              </DropdownMenuItem>
                            )}
                            
                            {owner.owner_w9_uploaded_at && (
                              <DropdownMenuItem onClick={() => handleViewOwnerW9(owner)}>
                                <Eye className="w-4 h-4 mr-2 text-green-600" />
                                View Uploaded W-9
                              </DropdownMenuItem>
                            )}
                            
                            <DropdownMenuSeparator />
                            
                            <DropdownMenuItem onClick={() => setAddingPaymentFor(owner)}>
                              <Wallet className="w-4 h-4 mr-2" />
                              Add Payment Method
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />
                            
                            <DropdownMenuItem onClick={() => handleToggleArchive(owner)}>
                              {owner.is_archived ? (
                                <>
                                  <Users className="w-4 h-4 mr-2" />
                                  Restore to Active
                                </>
                              ) : (
                                <>
                                  <FileText className="w-4 h-4 mr-2" />
                                  Archive (Keep Tax Records)
                                </>
                              )}
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem 
                              onClick={() => handleDeleteOwner(owner.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Permanently
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        
                        <Badge variant={owner.payment_method === "ach" ? "default" : "secondary"}>
                          <CreditCard className="w-3 h-3 mr-1" />
                          {owner.payment_method === "ach" ? "ACH" : "Card"}
                        </Badge>
                      </div>
                      
                      {/* Mobile dropdown menu */}
                      <div className="md:hidden">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-5 h-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {/* W-9 for mobile - dual direction */}
                            {owner.service_type === 'cohosting' ? (
                              <DropdownMenuItem 
                                onClick={() => handleSendOurW9(owner)}
                                disabled={sendingW9 === owner.id}
                              >
                                <FileText className="w-4 h-4 mr-2" />
                                {owner.our_w9_sent_at ? 'Resend Our W-9' : 'Send Our W-9'}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem 
                                onClick={() => handleRequestOwnerW9(owner)}
                                disabled={requestingW9 === owner.id}
                              >
                                <FileText className="w-4 h-4 mr-2" />
                                {owner.owner_w9_uploaded_at ? 'W-9 Received' : owner.owner_w9_requested_at ? 'Resend W-9 Request' : 'Request W-9'}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              onClick={() => handleSendPortalInvite(owner)}
                              disabled={sendingInvite === owner.id}
                            >
                              <Send className="w-4 h-4 mr-2" />
                              Send Portal Invite
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleOpenPortal(owner)}
                              disabled={openingPortal === owner.id}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              {openingPortal === owner.id ? "Opening..." : "View Portal"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSelectedOwnerForComms(owner)}>
                              <MessageSquare className="w-4 h-4 mr-2" />
                              View Messages
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditOwner(owner)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Owner
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setAddingPaymentFor(owner)}>
                              <Wallet className="w-4 h-4 mr-2" />
                              Add Payment Method
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleToggleArchive(owner)}>
                              {owner.is_archived ? (
                                <>
                                  <Users className="w-4 h-4 mr-2" />
                                  Restore
                                </>
                              ) : (
                                <>
                                  <FileText className="w-4 h-4 mr-2" />
                                  Archive
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteOwner(owner.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Payment Methods on File</Label>
                      <div className="flex gap-2">
                        {/* 📧 SEND PAYMENT SETUP EMAIL - Main action for requesting Stripe setup */}
                        <SendOwnerPaymentRequestButton
                          ownerId={owner.id}
                          email={owner.email}
                          name={owner.name}
                          stripeCustomerId={owner.stripe_customer_id}
                          hasPaymentMethod={owner.has_payment_method}
                          variant="default"
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAddingPaymentFor(owner)}
                        >
                          <Wallet className="w-4 h-4 mr-2" />
                          Add Manually
                        </Button>
                      </div>
                    </div>
                    
                    {/* Payment setup status indicator */}
                    {!owner.stripe_customer_id && (
                      <div className="p-3 border-2 border-dashed border-amber-300 rounded-lg bg-amber-50 text-amber-800">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          <span className="text-sm font-medium">Payment Setup Required</span>
                        </div>
                        <p className="text-xs mt-1">
                          Click "📧 Payment Request" to email {owner.name.split(' ')[0]} a secure Stripe setup link.
                          <br />
                          <span className="font-medium">Reminders will auto-send for 6 days until completed.</span>
                        </p>
                      </div>
                    )}
                    
                    {paymentMethods[owner.id]?.length > 0 ? (
                      <div className="space-y-2">
                        {paymentMethods[owner.id].map((pm) => (
                          <div key={pm.id} className="p-3 border rounded-lg flex items-center gap-3 bg-green-50 border-green-200">
                            <CreditCard className="w-4 h-4 text-green-600" />
                            <div className="flex-1">
                              {pm.card && (
                                <p className="text-sm">
                                  {pm.card.brand.toUpperCase()} •••• {pm.card.last4} (exp {pm.card.exp_month}/{pm.card.exp_year})
                                </p>
                              )}
                              {pm.us_bank_account && (
                                <div>
                                  <p className="text-sm font-medium">
                                    {pm.us_bank_account.bank_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {pm.us_bank_account.account_type} •••• {pm.us_bank_account.last4}
                                  </p>
                                </div>
                              )}
                            </div>
                            <Badge className="bg-green-600">✓ On File</Badge>
                          </div>
                        ))}
                      </div>
                    ) : owner.stripe_customer_id ? (
                      <div className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">
                        Stripe customer created - waiting for payment method setup.
                      </div>
                    ) : null}
                  </div>

                  {/* Tax Documents Section */}
                  <div className="space-y-3 pt-4 border-t">
                    <Label className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Tax Documents
                    </Label>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Our W-9 (Send TO owner) */}
                      <div className="p-3 border rounded-lg bg-muted/20">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">Our W-9</p>
                            <p className="text-xs text-muted-foreground">
                              {owner.our_w9_sent_at 
                                ? `Sent ${formatDate(owner.our_w9_sent_at)}` 
                                : "Not sent yet"}
                            </p>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleSendOurW9(owner)}
                            disabled={sendingW9 === owner.id}
                          >
                            {sendingW9 === owner.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : owner.our_w9_sent_at ? (
                              "Resend"
                            ) : (
                              "Send"
                            )}
                          </Button>
                        </div>
                      </div>
                      
                      {/* Their W-9 (Request FROM owner) */}
                      <div className="p-3 border rounded-lg bg-muted/20">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">Their W-9</p>
                            <p className="text-xs text-muted-foreground">
                              {owner.owner_w9_uploaded_at 
                                ? `Received ${formatDate(owner.owner_w9_uploaded_at)}`
                                : owner.owner_w9_requested_at 
                                  ? `Requested ${formatDate(owner.owner_w9_requested_at)}`
                                  : "Not requested"}
                            </p>
                          </div>
                          <Button 
                            size="sm" 
                            variant={owner.owner_w9_uploaded_at ? "ghost" : "outline"}
                            onClick={() => owner.owner_w9_uploaded_at ? handleViewOwnerW9(owner) : handleRequestOwnerW9(owner)}
                            disabled={requestingW9 === owner.id}
                          >
                            {requestingW9 === owner.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : owner.owner_w9_uploaded_at ? (
                              <>
                                <Eye className="w-4 h-4 mr-1" />
                                View
                              </>
                            ) : owner.owner_w9_requested_at ? (
                              "Resend"
                            ) : (
                              "Request"
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Contextual help */}
                    <p className="text-xs text-muted-foreground">
                      {owner.service_type === "cohosting" 
                        ? "💡 Co-hosting: They issue 1099 to you. Send Our W-9 is the primary action."
                        : "💡 Full-service: You issue 1099 to them. Request Their W-9 is the primary action."}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Assigned Properties ({ownerProperties.length})</Label>
                    <div className="space-y-2">
                      {ownerProperties.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No properties assigned</p>
                      ) : (
                        ownerProperties.map((property) => (
                          <div
                            key={property.id}
                            className="flex items-center justify-between p-2 border rounded-lg"
                          >
                            <div>
                              <p className="font-medium text-sm">{property.name}</p>
                              <p className="text-xs text-muted-foreground">{property.address}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const { error } = await supabase
                                    .from("properties")
                                    .update({ owner_id: null })
                                    .eq("id", property.id);
                                  
                                  if (error) throw error;
                                  toast.success("Property unassigned");
                                  loadData();
                                } catch (error: any) {
                                  console.error("Error unassigning:", error);
                                  toast.error("Failed to unassign property");
                                }
                              }}
                            >
                              Unassign
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Assign Property to {owner.name}</Label>
                    <Select onValueChange={(propertyId) => handleAssignProperty(propertyId, owner.id)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a property to assign..." />
                      </SelectTrigger>
                      <SelectContent>
                        {properties
                          .filter((p) => !p.owner_id)
                          .map((property) => (
                            <SelectItem key={property.id} value={property.id}>
                              {property.name} - {property.address}
                            </SelectItem>
                          ))}
                        {properties.filter((p) => !p.owner_id).length === 0 && (
                          <div className="p-2 text-sm text-muted-foreground text-center">
                            No unassigned properties available
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            );
          })}
            
            {/* Archived Owners Section */}
            {archivedOwners.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                  <Badge variant="outline" className="bg-muted">
                    Archived ({archivedOwners.length})
                  </Badge>
                  <span className="text-sm text-muted-foreground">Former clients - tax records preserved</span>
                </div>
                {archivedOwners.map((owner) => {
                  const ownerProperties = getOwnerProperties(owner.id);
                  return (
                    <Card key={owner.id} className="shadow-card border-border/50 opacity-60 mb-6">
                      <CardHeader className="bg-muted/50 rounded-t-lg">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <CardTitle className="flex items-center gap-2">
                              <Building2 className="w-5 h-5" />
                              {owner.name}
                              <Badge variant="secondary" className="ml-2">Archived</Badge>
                            </CardTitle>
                            <CardDescription className="mt-2 space-y-1">
                              <div className="flex items-center gap-2">
                                <Mail className="w-3.5 h-3.5" />
                                {owner.email}
                              </div>
                              {owner.phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="w-3.5 h-3.5" />
                                  {owner.phone}
                                </div>
                              )}
                            </CardDescription>
                          </div>
                          <div className="flex gap-2 items-center">
                            <Badge 
                              variant={owner.service_type === 'cohosting' ? 'outline' : 'default'}
                              className={owner.service_type === 'cohosting' ? 'border-orange-500 text-orange-600' : ''}
                            >
                              <Users className="w-3 h-3 mr-1" />
                              {owner.service_type === 'cohosting' ? 'Co-Hosting' : 'Full Service'}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleArchive(owner)}
                            >
                              Restore to Active
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4 space-y-4">
                        {/* W-9 Tax Info */}
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <Label className="text-xs font-medium mb-2 block">Tax Records</Label>
                          <div className="flex flex-wrap gap-4 text-sm">
                            {owner.owner_w9_uploaded_at && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewOwnerW9(owner)}
                                className="text-green-600 gap-1"
                              >
                                <CheckCircle className="w-4 h-4" />
                                View Their W-9
                              </Button>
                            )}
                            {owner.our_w9_sent_at && (
                              <span className="text-muted-foreground">
                                Our W-9 Sent: {formatDate(owner.our_w9_sent_at)}
                              </span>
                            )}
                            {!owner.owner_w9_uploaded_at && !owner.our_w9_sent_at && (
                              <span className="text-muted-foreground italic">No W-9 records</span>
                            )}
                          </div>
                        </div>

                        {/* Properties were assigned */}
                        {ownerProperties.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-xs">Previously Managed Properties ({ownerProperties.length})</Label>
                            <div className="space-y-1">
                              {ownerProperties.map((property) => (
                                <div key={property.id} className="text-sm text-muted-foreground">
                                  {property.name} - {property.address}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <Card className="bg-gradient-subtle border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="font-medium">Adding payment methods:</p>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>Click "Add Bank Account" or "Add Credit Card" for an owner</li>
            <li>Enter the payment details securely through Stripe</li>
            <li>The payment method will be saved on file for future charges</li>
            <li>When you charge monthly fees, the saved payment method will be automatically charged</li>
          </ol>
          <p className="text-xs mt-4 p-2 bg-primary/10 rounded">
            <strong>Note:</strong> All payment information is securely processed and stored by Stripe. 
            Your app never sees or stores raw payment details.
          </p>
        </CardContent>
      </Card>
      
      {/* Owner Communication Detail Modal */}
      {selectedOwnerForComms && (
        <OwnerCommunicationDetail
          ownerId={selectedOwnerForComms.id}
          ownerName={selectedOwnerForComms.name}
          ownerEmail={selectedOwnerForComms.email}
          ownerPhone={selectedOwnerForComms.phone}
          isOpen={!!selectedOwnerForComms}
          onClose={() => setSelectedOwnerForComms(null)}
        />
      )}
    </div>
  );
};

export default PropertyOwners;
