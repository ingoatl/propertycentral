import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, Eye, History, FileText, Search, CheckCircle, Clock, AlertCircle, Edit, Download, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { DocumentAuditTrail } from "./DocumentAuditTrail";
import { PDFViewerDialog } from "./PDFViewerDialog";

interface Document {
  id: string;
  document_name: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  status: string | null;
  is_draft: boolean | null;
  created_at: string | null;
  guest_signing_url: string | null;
  host_signing_url: string | null;
  guest_signed_at: string | null;
  host_signed_at: string | null;
  completed_at: string | null;
  property_id: string | null;
  booking_id: string | null;
  template_id: string | null;
  signed_pdf_path: string | null;
  template?: { name: string } | null;
  property?: { name: string; address: string } | null;
}

const DocumentList = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
  const [viewingPdf, setViewingPdf] = useState<{ path: string; title: string; documentName?: string; propertyAddress?: string; recipientName?: string } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("booking_documents")
        .select(`
          *,
          template:document_templates(name),
          property:properties!booking_documents_property_id_fkey(name, address)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error("Error loading documents:", error);
      toast({
        title: "Error",
        description: "Failed to load documents",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (doc: Document) => {
    if (doc.is_draft) {
      return <Badge variant="secondary"><Edit className="h-3 w-3 mr-1" />Draft</Badge>;
    }
    if (doc.completed_at) {
      return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
    }
    if (doc.guest_signed_at && !doc.host_signed_at) {
      return <Badge className="bg-blue-500"><Clock className="h-3 w-3 mr-1" />Awaiting Host</Badge>;
    }
    if (!doc.guest_signed_at) {
      return <Badge className="bg-amber-500"><Clock className="h-3 w-3 mr-1" />Awaiting Guest</Badge>;
    }
    return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />Pending</Badge>;
  };

  const copyToClipboard = async (url: string, type: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Copied!",
        description: `${type} signing link copied to clipboard`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      !searchTerm ||
      doc.document_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.recipient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.recipient_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.property?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "draft" && doc.is_draft) ||
      (statusFilter === "completed" && doc.completed_at) ||
      (statusFilter === "awaiting_guest" && !doc.is_draft && !doc.guest_signed_at) ||
      (statusFilter === "awaiting_host" && doc.guest_signed_at && !doc.host_signed_at);

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-1/3 mb-4" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Input
            placeholder="Search by name, recipient, or property..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="awaiting_guest">Awaiting Guest</SelectItem>
            <SelectItem value="awaiting_host">Awaiting Host</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Documents List */}
      {filteredDocuments.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No documents found</h3>
            <p className="text-muted-foreground">
              {searchTerm || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Create your first document to get started"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredDocuments.map((doc) => (
            <Card key={doc.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      {doc.document_name || doc.template?.name || "Untitled Document"}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {doc.recipient_name && `${doc.recipient_name} • `}
                      {doc.recipient_email}
                    </p>
                  </div>
                  {getStatusBadge(doc)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Meta Info */}
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {doc.property && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {doc.property.address || doc.property.name}
                    </span>
                  )}
                  {doc.created_at && (
                    <span>Created: {format(new Date(doc.created_at), "MMM d, yyyy")}</span>
                  )}
                  {doc.completed_at && (
                    <span className="text-green-600">
                      Completed: {format(new Date(doc.completed_at), "MMM d, yyyy")}
                    </span>
                  )}
                </div>

                {/* Signing Progress */}
                {!doc.is_draft && (
                  <div className="flex gap-4 text-sm">
                    <div className={`flex items-center gap-1 ${doc.guest_signed_at ? "text-green-600" : "text-muted-foreground"}`}>
                      {doc.guest_signed_at ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                      Guest {doc.guest_signed_at ? "Signed" : "Pending"}
                    </div>
                    <div className={`flex items-center gap-1 ${doc.host_signed_at ? "text-green-600" : "text-muted-foreground"}`}>
                      {doc.host_signed_at ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                      Host {doc.host_signed_at ? "Signed" : "Pending"}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {doc.signed_pdf_path && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewingPdf({
                          path: doc.signed_pdf_path!,
                          title: doc.document_name || doc.property?.address || "Document",
                          documentName: doc.template?.name || doc.document_name || undefined,
                          propertyAddress: doc.property?.address || doc.property?.name || undefined,
                          recipientName: doc.recipient_name || undefined
                        })}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            const { data, error } = await supabase.storage
                              .from("signed-documents")
                              .download(doc.signed_pdf_path!);
                            
                            if (error) throw error;
                            
                            // Generate descriptive filename
                            const parts: string[] = [];
                            if (doc.template?.name || doc.document_name) {
                              parts.push((doc.template?.name || doc.document_name || '').replace(/[^a-zA-Z0-9\s-]/g, '').trim());
                            }
                            if (doc.property?.address || doc.property?.name) {
                              parts.push((doc.property?.address || doc.property?.name || '').replace(/[^a-zA-Z0-9\s-]/g, '').trim());
                            }
                            if (doc.recipient_name) {
                              parts.push(doc.recipient_name.replace(/[^a-zA-Z0-9\s-]/g, '').trim());
                            }
                            const filename = parts.length > 0 
                              ? parts.join('_').replace(/\s+/g, '_').replace(/_+/g, '_') + '.pdf'
                              : doc.signed_pdf_path!.split('/').pop() || 'document.pdf';
                            
                            const blobUrl = URL.createObjectURL(data);
                            const link = document.createElement('a');
                            link.href = blobUrl;
                            link.download = filename;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            URL.revokeObjectURL(blobUrl);
                            
                            toast({
                              title: "Success",
                              description: "Document downloaded successfully",
                            });
                          } catch (err) {
                            toast({
                              title: "Error",
                              description: "Failed to download document",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </>
                  )}
                  {doc.guest_signing_url && !doc.guest_signed_at && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(doc.guest_signing_url!, "Guest")}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy Guest Link
                    </Button>
                  )}
                  {doc.host_signing_url && doc.guest_signed_at && !doc.host_signed_at && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(doc.host_signing_url!, "_blank")}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Sign as Host
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpandedAuditId(expandedAuditId === doc.id ? null : doc.id)}
                  >
                    <History className="h-4 w-4 mr-1" />
                    Audit Trail
                  </Button>
                </div>

                {/* Audit Trail */}
                {expandedAuditId === doc.id && (
                  <div className="mt-4 pt-4 border-t">
                    <DocumentAuditTrail documentId={doc.id} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* PDF Viewer Dialog */}
      <PDFViewerDialog
        open={!!viewingPdf}
        onOpenChange={(open) => !open && setViewingPdf(null)}
        filePath={viewingPdf?.path || ""}
        title={viewingPdf?.title || "Document"}
        documentName={viewingPdf?.documentName}
        propertyAddress={viewingPdf?.propertyAddress}
        recipientName={viewingPdf?.recipientName}
      />
    </div>
  );
};

export default DocumentList;
