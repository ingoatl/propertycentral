import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, FileText, Download, ExternalLink, Folder } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface LeaseDocument {
  id: string;
  property_id: string;
  tenant_name: string;
  document_type: string;
  document_path: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  uploaded_at: string;
  property_name?: string;
}

export function LeaseDocumentsTab() {
  const [documents, setDocuments] = useState<LeaseDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    loadData();
  }, [propertyFilter, typeFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load properties
      const { data: propData } = await supabase
        .from("properties")
        .select("id, name")
        .is("offboarded_at", null)
        .order("name");

      setProperties(propData || []);

      // Load lease documents
      let query = supabase
        .from("lease_documents")
        .select("*")
        .order("uploaded_at", { ascending: false });

      if (propertyFilter !== "all") {
        query = query.eq("property_id", propertyFilter);
      }
      if (typeFilter !== "all") {
        query = query.eq("document_type", typeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const enriched = (data || []).map((doc) => ({
        ...doc,
        property_name: propData?.find((p) => p.id === doc.property_id)?.name || "Unknown",
      }));

      setDocuments(enriched);
    } catch (error) {
      console.error("Error loading documents:", error);
      toast.error("Failed to load lease documents");
    } finally {
      setLoading(false);
    }
  };

  const downloadDocument = async (docPath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("signed-documents")
        .createSignedUrl(docPath, 60);

      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (error) {
      toast.error("Failed to download document");
    }
  };

  const filteredDocuments = documents.filter((doc) =>
    doc.tenant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.property_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.notes?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const documentTypes = ["lease", "addendum", "inspection", "amendment", "move-in", "move-out"];

  const stats = {
    total: documents.length,
    leases: documents.filter((d) => d.document_type === "lease").length,
    inspections: documents.filter((d) => d.document_type === "inspection" || d.document_type === "move-in" || d.document_type === "move-out").length,
    addendums: documents.filter((d) => d.document_type === "addendum" || d.document_type === "amendment").length,
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Documents</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Leases</div>
          <div className="text-2xl font-bold">{stats.leases}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Inspections</div>
          <div className="text-2xl font-bold">{stats.inspections}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Addendums</div>
          <div className="text-2xl font-bold">{stats.addendums}</div>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2 flex-1 flex-wrap">
          <Input
            placeholder="Search tenant, property..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Properties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {properties.map((prop) => (
                <SelectItem key={prop.id} value={prop.id}>
                  {prop.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {documentTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {filteredDocuments.length === 0 ? (
        <Card className="p-8 text-center">
          <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Lease Documents Found</h3>
          <p className="text-muted-foreground">
            Lease agreements and related documents will appear here.
          </p>
        </Card>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Uploaded</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Lease Period</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Document</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocuments.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">
                    {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="max-w-[150px] truncate">
                    {doc.property_name}
                  </TableCell>
                  <TableCell>{doc.tenant_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {doc.document_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {doc.start_date && doc.end_date ? (
                      <span className="text-sm">
                        {format(new Date(doc.start_date), "MMM yyyy")} - {format(new Date(doc.end_date), "MMM yyyy")}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {doc.notes || "-"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadDocument(doc.document_path)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
