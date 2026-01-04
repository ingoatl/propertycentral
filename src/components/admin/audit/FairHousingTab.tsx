import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Users, Heart, RefreshCw, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface TenantApplication {
  id: string;
  property_id: string;
  property_name?: string;
  applicant_name: string;
  applicant_email: string;
  application_date: string;
  status: string;
  decision_date: string | null;
  decision_reason: string | null;
  income_verified: boolean;
  credit_check_passed: boolean;
  background_check_passed: boolean;
}

interface AccommodationRequest {
  id: string;
  property_id: string;
  property_name?: string;
  tenant_name: string;
  request_date: string;
  request_type: string;
  request_description: string;
  status: string;
  decision_date: string | null;
  decision_reason: string | null;
}

export function FairHousingTab() {
  const [applications, setApplications] = useState<TenantApplication[]>([]);
  const [accommodations, setAccommodations] = useState<AccommodationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [isAddAppDialogOpen, setIsAddAppDialogOpen] = useState(false);
  const [isAddAccomDialogOpen, setIsAddAccomDialogOpen] = useState(false);
  const [newApplication, setNewApplication] = useState({
    property_id: "",
    applicant_name: "",
    applicant_email: "",
    application_date: "",
    status: "pending",
    decision_reason: "",
  });
  const [newAccommodation, setNewAccommodation] = useState({
    property_id: "",
    tenant_name: "",
    request_date: "",
    request_type: "service_animal",
    request_description: "",
    status: "pending",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load properties
      const { data: propsData } = await supabase
        .from("properties")
        .select("id, name")
        .order("name");
      
      if (propsData) setProperties(propsData);

      // Load applications
      const { data: appsData, error: appsError } = await supabase
        .from("tenant_applications")
        .select("*")
        .order("application_date", { ascending: false });

      if (appsError) throw appsError;

      const enrichedApps = (appsData || []).map(app => ({
        ...app,
        property_name: propsData?.find(p => p.id === app.property_id)?.name || "Unknown",
      }));
      setApplications(enrichedApps);

      // Load accommodation requests
      const { data: accomData, error: accomError } = await supabase
        .from("accommodation_requests")
        .select("*")
        .order("request_date", { ascending: false });

      if (accomError) throw accomError;

      const enrichedAccom = (accomData || []).map(acc => ({
        ...acc,
        property_name: propsData?.find(p => p.id === acc.property_id)?.name || "Unknown",
      }));
      setAccommodations(enrichedAccom);
    } catch (error) {
      console.error("Error loading fair housing data:", error);
      toast({
        title: "Error",
        description: "Failed to load fair housing records",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddApplication = async () => {
    try {
      const { error } = await supabase.from("tenant_applications").insert(newApplication);
      if (error) throw error;

      toast({ title: "Success", description: "Application record added" });
      setIsAddAppDialogOpen(false);
      setNewApplication({
        property_id: "",
        applicant_name: "",
        applicant_email: "",
        application_date: "",
        status: "pending",
        decision_reason: "",
      });
      loadData();
    } catch (error) {
      console.error("Error adding application:", error);
      toast({ title: "Error", description: "Failed to add application", variant: "destructive" });
    }
  };

  const handleAddAccommodation = async () => {
    try {
      const { error } = await supabase.from("accommodation_requests").insert(newAccommodation);
      if (error) throw error;

      toast({ title: "Success", description: "Accommodation request recorded" });
      setIsAddAccomDialogOpen(false);
      setNewAccommodation({
        property_id: "",
        tenant_name: "",
        request_date: "",
        request_type: "service_animal",
        request_description: "",
        status: "pending",
      });
      loadData();
    } catch (error) {
      console.error("Error adding accommodation:", error);
      toast({ title: "Error", description: "Failed to add request", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-green-100 text-green-800",
      denied: "bg-red-100 text-red-800",
      withdrawn: "bg-gray-100 text-gray-800",
      more_info_needed: "bg-blue-100 text-blue-800",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || colors.pending}`}>
        {status.replace("_", " ").split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
      </span>
    );
  };

  const getRequestTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      service_animal: "Service Animal",
      emotional_support_animal: "ESA",
      physical_modification: "Physical Modification",
      policy_exception: "Policy Exception",
      other: "Other",
    };
    return labels[type] || type;
  };

  const appStats = {
    total: applications.length,
    approved: applications.filter(a => a.status === "approved").length,
    denied: applications.filter(a => a.status === "denied").length,
    pending: applications.filter(a => a.status === "pending").length,
  };

  const accomStats = {
    total: accommodations.length,
    approved: accommodations.filter(a => a.status === "approved").length,
    denied: accommodations.filter(a => a.status === "denied").length,
    pending: accommodations.filter(a => a.status === "pending").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fair Housing Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">Fair Housing Compliance</h4>
            <p className="text-sm text-blue-800 mt-1">
              All tenant decisions must comply with the Fair Housing Act. Document consistent screening criteria 
              and maintain records of all applications and reasonable accommodation requests for at least 3 years.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="applications" className="space-y-4">
        <TabsList>
          <TabsTrigger value="applications">
            <Users className="h-4 w-4 mr-2" />
            Tenant Applications ({applications.length})
          </TabsTrigger>
          <TabsTrigger value="accommodations">
            <Heart className="h-4 w-4 mr-2" />
            Accommodation Requests ({accommodations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="space-y-4">
          {/* Application Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border rounded-lg p-4">
              <div className="text-2xl font-bold">{appStats.total}</div>
              <div className="text-sm text-muted-foreground">Total Applications</div>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{appStats.approved}</div>
              <div className="text-sm text-muted-foreground">Approved</div>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600">{appStats.denied}</div>
              <div className="text-sm text-muted-foreground">Denied</div>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-600">{appStats.pending}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
          </div>

          {/* Add Application Button */}
          <div className="flex justify-end">
            <Dialog open={isAddAppDialogOpen} onOpenChange={setIsAddAppDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Application Record
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Tenant Application</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Property</Label>
                    <Select 
                      value={newApplication.property_id} 
                      onValueChange={(v) => setNewApplication({ ...newApplication, property_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select property" />
                      </SelectTrigger>
                      <SelectContent>
                        {properties.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Applicant Name</Label>
                      <Input
                        value={newApplication.applicant_name}
                        onChange={(e) => setNewApplication({ ...newApplication, applicant_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={newApplication.applicant_email}
                        onChange={(e) => setNewApplication({ ...newApplication, applicant_email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Application Date</Label>
                      <Input
                        type="date"
                        value={newApplication.application_date}
                        onChange={(e) => setNewApplication({ ...newApplication, application_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select 
                        value={newApplication.status} 
                        onValueChange={(v) => setNewApplication({ ...newApplication, status: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="denied">Denied</SelectItem>
                          <SelectItem value="withdrawn">Withdrawn</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {newApplication.status === "denied" && (
                    <div className="space-y-2">
                      <Label>Denial Reason (Required for Compliance)</Label>
                      <Textarea
                        value={newApplication.decision_reason}
                        onChange={(e) => setNewApplication({ ...newApplication, decision_reason: e.target.value })}
                        placeholder="Document the specific, objective criteria that led to denial..."
                      />
                    </div>
                  )}
                  <Button onClick={handleAddApplication} className="w-full">
                    Save Application Record
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Applications Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-center">Income</TableHead>
                  <TableHead className="text-center">Credit</TableHead>
                  <TableHead className="text-center">Background</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Decision Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No application records found
                    </TableCell>
                  </TableRow>
                ) : (
                  applications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{app.applicant_name}</div>
                          <div className="text-sm text-muted-foreground">{app.applicant_email}</div>
                        </div>
                      </TableCell>
                      <TableCell>{app.property_name}</TableCell>
                      <TableCell>
                        {app.application_date
                          ? format(new Date(app.application_date), "MMM d, yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {app.income_verified ? (
                          <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {app.credit_check_passed ? (
                          <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {app.background_check_passed ? (
                          <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-300 mx-auto" />
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(app.status)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {app.decision_reason || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="accommodations" className="space-y-4">
          {/* Accommodation Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card border rounded-lg p-4">
              <div className="text-2xl font-bold">{accomStats.total}</div>
              <div className="text-sm text-muted-foreground">Total Requests</div>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{accomStats.approved}</div>
              <div className="text-sm text-muted-foreground">Approved</div>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600">{accomStats.denied}</div>
              <div className="text-sm text-muted-foreground">Denied</div>
            </div>
            <div className="bg-card border rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-600">{accomStats.pending}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
          </div>

          {/* Add Accommodation Button */}
          <div className="flex justify-end">
            <Dialog open={isAddAccomDialogOpen} onOpenChange={setIsAddAccomDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Accommodation Request
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Accommodation Request</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tenant Name</Label>
                      <Input
                        value={newAccommodation.tenant_name}
                        onChange={(e) => setNewAccommodation({ ...newAccommodation, tenant_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Property</Label>
                      <Select 
                        value={newAccommodation.property_id} 
                        onValueChange={(v) => setNewAccommodation({ ...newAccommodation, property_id: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select property" />
                        </SelectTrigger>
                        <SelectContent>
                          {properties.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Request Date</Label>
                      <Input
                        type="date"
                        value={newAccommodation.request_date}
                        onChange={(e) => setNewAccommodation({ ...newAccommodation, request_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Request Type</Label>
                      <Select 
                        value={newAccommodation.request_type} 
                        onValueChange={(v) => setNewAccommodation({ ...newAccommodation, request_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="service_animal">Service Animal</SelectItem>
                          <SelectItem value="emotional_support_animal">Emotional Support Animal</SelectItem>
                          <SelectItem value="physical_modification">Physical Modification</SelectItem>
                          <SelectItem value="policy_exception">Policy Exception</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Request Description</Label>
                    <Textarea
                      value={newAccommodation.request_description}
                      onChange={(e) => setNewAccommodation({ ...newAccommodation, request_description: e.target.value })}
                      placeholder="Describe the accommodation being requested..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select 
                      value={newAccommodation.status} 
                      onValueChange={(v) => setNewAccommodation({ ...newAccommodation, status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="denied">Denied</SelectItem>
                        <SelectItem value="more_info_needed">More Info Needed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddAccommodation} className="w-full">
                    Save Request
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Accommodations Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Request Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accommodations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No accommodation requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  accommodations.map((acc) => (
                    <TableRow key={acc.id}>
                      <TableCell className="font-medium">{acc.tenant_name}</TableCell>
                      <TableCell>{acc.property_name}</TableCell>
                      <TableCell>{getRequestTypeBadge(acc.request_type)}</TableCell>
                      <TableCell>
                        {acc.request_date
                          ? format(new Date(acc.request_date), "MMM d, yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {acc.request_description || "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(acc.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
