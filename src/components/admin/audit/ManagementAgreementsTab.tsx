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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, FileText, CheckCircle, XCircle, RefreshCw, Download, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { PDFViewerDialog } from "@/components/documents/PDFViewerDialog";

interface ManagementAgreement {
  id: string;
  property_id: string;
  owner_id: string;
  agreement_date: string;
  effective_date: string;
  termination_date: string | null;
  management_fee_percentage: number;
  order_minimum_fee: number;
  document_path: string | null;
  signed_by_owner: boolean;
  signed_by_company: boolean;
  status: string;
  property_name?: string;
  owner_name?: string;
}

export function ManagementAgreementsTab() {
  const [agreements, setAgreements] = useState<ManagementAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<{ id: string; name: string; address: string; owner_id: string }[]>([]);
  const [owners, setOwners] = useState<{ id: string; name: string }[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [viewingPdf, setViewingPdf] = useState<{ path: string; title: string } | null>(null);
  const [newAgreement, setNewAgreement] = useState({
    property_id: "",
    owner_id: "",
    agreement_date: "",
    effective_date: "",
    management_fee_percentage: 25,
    order_minimum_fee: 150,
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load properties with address
      const { data: propsData } = await supabase
        .from("properties")
        .select("id, name, address, owner_id")
        .order("address");
      
      if (propsData) setProperties(propsData);

      // Load owners
      const { data: ownersData } = await supabase
        .from("property_owners")
        .select("id, name")
        .order("name");
      
      if (ownersData) setOwners(ownersData);

      // Load agreements
      const { data: agreementsData, error } = await supabase
        .from("management_agreements")
        .select("*")
        .order("agreement_date", { ascending: false });

      if (error) throw error;

      // Enrich with names - use address as primary, fallback to name
      const enriched = (agreementsData || []).map((a) => {
        const prop = propsData?.find(p => p.id === a.property_id);
        const owner = ownersData?.find(o => o.id === a.owner_id);
        return {
          ...a,
          property_name: prop?.address || prop?.name || "Unknown",
          owner_name: owner?.name || "Unknown",
        };
      });

      setAgreements(enriched);
    } catch (error) {
      console.error("Error loading agreements:", error);
      toast({
        title: "Error",
        description: "Failed to load management agreements",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddAgreement = async () => {
    try {
      const { error } = await supabase.from("management_agreements").insert({
        ...newAgreement,
        status: "active",
      });

      if (error) throw error;

      toast({ title: "Success", description: "Agreement added successfully" });
      setIsAddDialogOpen(false);
      setNewAgreement({
        property_id: "",
        owner_id: "",
        agreement_date: "",
        effective_date: "",
        management_fee_percentage: 25,
        order_minimum_fee: 150,
      });
      loadData();
    } catch (error) {
      console.error("Error adding agreement:", error);
      toast({
        title: "Error",
        description: "Failed to add agreement",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (filePath: string, propertyName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("signed-documents")
        .createSignedUrl(filePath, 60);

      if (error) throw error;
      
      window.open(data.signedUrl, "_blank");
    } catch (error) {
      console.error("Error downloading document:", error);
      toast({
        title: "Error",
        description: "Failed to download document",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-green-100 text-green-800",
      draft: "bg-yellow-100 text-yellow-800",
      terminated: "bg-red-100 text-red-800",
      expired: "bg-gray-100 text-gray-800",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || colors.draft}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const stats = {
    total: agreements.length,
    active: agreements.filter(a => a.status === "active").length,
    signedBoth: agreements.filter(a => a.signed_by_owner && a.signed_by_company).length,
    pendingSignature: agreements.filter(a => !a.signed_by_owner || !a.signed_by_company).length,
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
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Total Agreements</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          <div className="text-sm text-muted-foreground">Active</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.signedBoth}</div>
          <div className="text-sm text-muted-foreground">Fully Signed</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-600">{stats.pendingSignature}</div>
          <div className="text-sm text-muted-foreground">Pending Signature</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Management Agreements</h3>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Agreement
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Management Agreement</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Property</Label>
                <Select 
                  value={newAgreement.property_id} 
                  onValueChange={(v) => {
                    const prop = properties.find(p => p.id === v);
                    setNewAgreement({ 
                      ...newAgreement, 
                      property_id: v,
                      owner_id: prop?.owner_id || ""
                    });
                  }}
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
              <div className="space-y-2">
                <Label>Owner</Label>
                <Select 
                  value={newAgreement.owner_id} 
                  onValueChange={(v) => setNewAgreement({ ...newAgreement, owner_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {owners.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Agreement Date</Label>
                  <Input
                    type="date"
                    value={newAgreement.agreement_date}
                    onChange={(e) => setNewAgreement({ ...newAgreement, agreement_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Effective Date</Label>
                  <Input
                    type="date"
                    value={newAgreement.effective_date}
                    onChange={(e) => setNewAgreement({ ...newAgreement, effective_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Management Fee %</Label>
                  <Input
                    type="number"
                    value={newAgreement.management_fee_percentage}
                    onChange={(e) => setNewAgreement({ ...newAgreement, management_fee_percentage: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Order Minimum Fee</Label>
                  <Input
                    type="number"
                    value={newAgreement.order_minimum_fee}
                    onChange={(e) => setNewAgreement({ ...newAgreement, order_minimum_fee: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <Button onClick={handleAddAgreement} className="w-full">
                Add Agreement
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      {agreements.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No Agreements Found</h3>
          <p className="text-muted-foreground">Add your first management agreement</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Agreement Date</TableHead>
                <TableHead>Fee %</TableHead>
                <TableHead className="text-center">Owner Signed</TableHead>
                <TableHead className="text-center">Company Signed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Document</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agreements.map((agreement) => (
                <TableRow key={agreement.id}>
                  <TableCell className="font-medium">{agreement.property_name}</TableCell>
                  <TableCell>{agreement.owner_name}</TableCell>
                  <TableCell>
                    {agreement.agreement_date
                      ? format(new Date(agreement.agreement_date), "MMM d, yyyy")
                      : "-"}
                  </TableCell>
                  <TableCell>{agreement.management_fee_percentage}%</TableCell>
                  <TableCell className="text-center">
                    {agreement.signed_by_owner ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-400 mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {agreement.signed_by_company ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-400 mx-auto" />
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(agreement.status)}</TableCell>
                  <TableCell className="text-center">
                    {agreement.document_path ? (
                      <div className="flex items-center justify-center gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setViewingPdf({
                            path: agreement.document_path!,
                            title: `Agreement - ${agreement.property_name}`
                          })}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleDownload(agreement.document_path!, agreement.property_name || "Agreement")}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* PDF Viewer Dialog */}
      <PDFViewerDialog
        open={!!viewingPdf}
        onOpenChange={(open) => !open && setViewingPdf(null)}
        filePath={viewingPdf?.path || ""}
        title={viewingPdf?.title || "Document"}
      />
    </div>
  );
}
