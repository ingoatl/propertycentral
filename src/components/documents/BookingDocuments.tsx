import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, Plus, Eye, Clock, CheckCircle, XCircle, Copy, ExternalLink, Pen, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { CreateAgreementDialog } from "./CreateAgreementDialog";
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
  guest_signing_url: string | null;
  host_signing_url: string | null;
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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [showAuditTrail, setShowAuditTrail] = useState<string | null>(null);
  const [refreshingUrl, setRefreshingUrl] = useState<string | null>(null);

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
        return <Badge variant="outline" className="border-amber-500 text-amber-600"><Pen className="w-3 h-3 mr-1" />Awaiting Guest</Badge>;
      case 'pending_host':
        return <Badge variant="outline" className="border-blue-500 text-blue-600"><Pen className="w-3 h-3 mr-1" />Awaiting Host</Badge>;
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'declined':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Declined</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const copyToClipboard = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`${label} copied to clipboard!`);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const refreshSigningUrl = async (doc: BookingDocument, recipientType: 'guest' | 'host') => {
    // For documents with signwell_document_id, use the SignWell function (backward compatibility)
    // For new native documents, use the direct URL from database
    if (doc.signwell_document_id) {
      setRefreshingUrl(`${doc.id}-${recipientType}`);
      try {
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
          toast.error('Could not get signing URL');
        }
      } catch (err: any) {
        toast.error(`Failed to get signing URL: ${err.message}`);
      } finally {
        setRefreshingUrl(null);
      }
    } else {
      // Native signing - use the stored URL directly
      const url = recipientType === 'guest' ? doc.guest_signing_url : doc.host_signing_url;
      if (url) {
        window.open(url, '_blank');
      } else {
        toast.error('Signing URL not available');
      }
    }
  };

  const property = properties.find(p => p.id === booking.property_id) || null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading documents...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Agreements
        </h4>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setCreateDialogOpen(true)}
          className="gap-1"
        >
          <Plus className="w-3 h-3" />
          Create Agreement
        </Button>
      </div>

      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No agreements yet.</p>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <div 
              key={doc.id} 
              className="border rounded-lg p-3 space-y-3 bg-card"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{doc.template?.name || 'Agreement'}</span>
                </div>
                {getStatusBadge(doc.status)}
              </div>

              {/* Signing Links Section - Pending Guest */}
              {doc.status === 'pending_guest' && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Share this link with the guest to sign:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {doc.guest_signing_url ? (
                      <>
                        <Button 
                          size="sm" 
                          onClick={() => copyToClipboard(doc.guest_signing_url!, 'Guest signing link')}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy Guest Link
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => window.open(doc.guest_signing_url!, '_blank')}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Preview
                        </Button>
                      </>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => refreshSigningUrl(doc, 'guest')}
                        disabled={refreshingUrl === `${doc.id}-guest`}
                      >
                        {refreshingUrl === `${doc.id}-guest` ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <ExternalLink className="h-3 w-3 mr-1" />
                        )}
                        Get Guest Link
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Signing Links Section - Pending Host */}
              {doc.status === 'pending_host' && (
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Guest has signed! Now sign as host:
                  </p>
                  <div className="flex gap-2">
                    {doc.host_signing_url ? (
                      <Button 
                        size="sm"
                        onClick={() => window.open(doc.host_signing_url!, '_blank')}
                      >
                        <Pen className="h-3 w-3 mr-1" />
                        Sign as Host
                      </Button>
                    ) : (
                      <Button 
                        size="sm"
                        onClick={() => refreshSigningUrl(doc, 'host')}
                        disabled={refreshingUrl === `${doc.id}-host`}
                      >
                        {refreshingUrl === `${doc.id}-host` ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Pen className="h-3 w-3 mr-1" />
                        )}
                        Sign as Host
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Completed Status */}
              {doc.status === 'completed' && (
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    ✓ Agreement fully signed on {doc.completed_at ? format(new Date(doc.completed_at), 'MMM d, yyyy') : 'N/A'}
                  </p>
                </div>
              )}

              {/* Timestamps */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {doc.sent_at && (
                  <span>Created: {format(new Date(doc.sent_at), 'MMM d, yyyy')}</span>
                )}
                {doc.guest_signed_at && (
                  <span>Guest signed: {format(new Date(doc.guest_signed_at), 'MMM d, yyyy')}</span>
                )}
                {doc.host_signed_at && (
                  <span>Host signed: {format(new Date(doc.host_signed_at), 'MMM d, yyyy')}</span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
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

      <CreateAgreementDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        booking={booking}
        property={property}
        onSuccess={loadDocuments}
      />
    </div>
  );
}
