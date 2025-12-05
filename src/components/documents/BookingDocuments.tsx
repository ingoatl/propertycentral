import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, Send, Eye, Clock, CheckCircle, XCircle, Copy, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { SendAgreementDialog } from "./SendAgreementDialog";
import { DocumentAuditTrail } from "./DocumentAuditTrail";

interface BookingDocument {
  id: string;
  booking_id: string;
  template_id: string;
  signwell_document_id: string | null;
  status: string;
  guest_signed_at: string | null;
  host_signed_at: string | null;
  created_at: string;
  sent_at: string | null;
  completed_at: string | null;
  template?: {
    name: string;
  };
}

interface Property {
  id: string;
  name: string;
  address: string;
}

interface Booking {
  id: string;
  tenant_name: string;
  tenant_email: string | null;
  property_id: string;
  monthly_rent: number;
  deposit_amount: number;
  start_date: string;
  end_date: string;
}

interface BookingDocumentsProps {
  booking: Booking;
  properties: Property[];
}

export function BookingDocuments({ booking, properties }: BookingDocumentsProps) {
  const [documents, setDocuments] = useState<BookingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<BookingDocument | null>(null);
  const [showAuditTrail, setShowAuditTrail] = useState<string | null>(null);
  const [gettingSigningUrl, setGettingSigningUrl] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [booking.id]);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('booking_documents')
        .select(`
          *,
          template:document_templates(name)
        `)
        .eq('booking_id', booking.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Draft</Badge>;
      case 'pending_guest':
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200"><Clock className="w-3 h-3 mr-1" />Awaiting Guest</Badge>;
      case 'pending_host':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Clock className="w-3 h-3 mr-1" />Awaiting Host</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'declined':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Declined</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleGetSigningUrl = async (doc: BookingDocument, recipientType: 'guest' | 'host') => {
    if (!doc.signwell_document_id) {
      toast.error('Document not sent yet');
      return;
    }

    try {
      setGettingSigningUrl(doc.id);
      const { data, error } = await supabase.functions.invoke('signwell-get-signing-url', {
        body: {
          signwellDocumentId: doc.signwell_document_id,
          recipientType,
        },
      });

      if (error) throw error;

      if (data?.signingUrl) {
        await navigator.clipboard.writeText(data.signingUrl);
        toast.success(`${recipientType === 'guest' ? 'Guest' : 'Host'} signing link copied to clipboard!`);
      } else {
        toast.error('Signing URL not available');
      }
    } catch (error: any) {
      console.error('Error getting signing URL:', error);
      toast.error('Failed to get signing URL');
    } finally {
      setGettingSigningUrl(null);
    }
  };

  const handleOpenSigningUrl = async (doc: BookingDocument, recipientType: 'guest' | 'host') => {
    if (!doc.signwell_document_id) {
      toast.error('Document not sent yet');
      return;
    }

    try {
      setGettingSigningUrl(doc.id);
      const { data, error } = await supabase.functions.invoke('signwell-get-signing-url', {
        body: {
          signwellDocumentId: doc.signwell_document_id,
          recipientType,
        },
      });

      if (error) throw error;

      if (data?.signingUrl) {
        window.open(data.signingUrl, '_blank');
      } else {
        toast.error('Signing URL not available');
      }
    } catch (error: any) {
      console.error('Error getting signing URL:', error);
      toast.error('Failed to get signing URL');
    } finally {
      setGettingSigningUrl(null);
    }
  };

  const property = properties.find(p => p.id === booking.property_id);

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading documents...</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Documents
        </h4>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setSendDialogOpen(true)}
          className="gap-1"
        >
          <Send className="w-3 h-3" />
          Send Agreement
        </Button>
      </div>

      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents yet</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div 
              key={doc.id} 
              className="p-3 bg-muted/50 rounded-lg border border-border/50 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{doc.template?.name || 'Agreement'}</span>
                </div>
                {getStatusBadge(doc.status)}
              </div>
              
              {doc.sent_at && (
                <p className="text-xs text-muted-foreground">
                  Sent: {format(new Date(doc.sent_at), "MMM dd, yyyy 'at' h:mm a")}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {doc.status === 'pending_guest' && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleGetSigningUrl(doc, 'guest')}
                      disabled={gettingSigningUrl === doc.id}
                      className="gap-1 text-xs"
                    >
                      <Copy className="w-3 h-3" />
                      Copy Guest Link
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleOpenSigningUrl(doc, 'guest')}
                      disabled={gettingSigningUrl === doc.id}
                      className="gap-1 text-xs"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open Guest Signing
                    </Button>
                  </>
                )}
                
                {doc.status === 'pending_host' && (
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={() => handleOpenSigningUrl(doc, 'host')}
                    disabled={gettingSigningUrl === doc.id}
                    className="gap-1 text-xs"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Sign as Host
                  </Button>
                )}

                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowAuditTrail(showAuditTrail === doc.id ? null : doc.id)}
                  className="gap-1 text-xs"
                >
                  <Eye className="w-3 h-3" />
                  {showAuditTrail === doc.id ? 'Hide' : 'View'} Audit Trail
                </Button>
              </div>

              {showAuditTrail === doc.id && (
                <DocumentAuditTrail documentId={doc.id} />
              )}
            </div>
          ))}
        </div>
      )}

      <SendAgreementDialog
        open={sendDialogOpen}
        onOpenChange={setSendDialogOpen}
        booking={booking}
        property={property}
        onSuccess={loadDocuments}
      />
    </div>
  );
}
