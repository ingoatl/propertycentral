import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { CheckCircle, Eye, Send, FileText, XCircle, Clock } from "lucide-react";

interface AuditLogEntry {
  id: string;
  action: string;
  performed_by: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  metadata: unknown;
}

interface DocumentAuditTrailProps {
  documentId: string;
}

export function DocumentAuditTrail({ documentId }: DocumentAuditTrailProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAuditLogs();
  }, [documentId]);

  const loadAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('document_audit_log')
        .select('*')
        .eq('document_id', documentId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      console.error('Error loading audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created':
        return <FileText className="w-4 h-4 text-muted-foreground" />;
      case 'sent':
        return <Send className="w-4 h-4 text-blue-500" />;
      case 'guest_viewed':
        return <Eye className="w-4 h-4 text-amber-500" />;
      case 'guest_signed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'host_signed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'declined':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'expired':
        return <Clock className="w-4 h-4 text-red-500" />;
      default:
        return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'created':
        return 'Document created';
      case 'sent':
        return 'Sent for signature';
      case 'guest_viewed':
        return 'Guest viewed document';
      case 'guest_signed':
        return 'Guest signed';
      case 'host_signed':
        return 'Host signed';
      case 'completed':
        return 'Document completed';
      case 'declined':
        return 'Document declined';
      case 'expired':
        return 'Document expired';
      default:
        return action;
    }
  };

  if (loading) {
    return <div className="text-xs text-muted-foreground py-2">Loading audit trail...</div>;
  }

  if (logs.length === 0) {
    return <div className="text-xs text-muted-foreground py-2">No activity recorded</div>;
  }

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <h5 className="text-xs font-medium text-muted-foreground mb-2">Audit Trail</h5>
      <div className="space-y-2">
        {logs.map((log) => (
          <div key={log.id} className="flex items-start gap-2 text-xs">
            <div className="mt-0.5">
              {getActionIcon(log.action)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{getActionLabel(log.action)}</span>
                <span className="text-muted-foreground">
                  {format(new Date(log.created_at), "MMM dd, yyyy 'at' h:mm a")}
                </span>
              </div>
              {log.performed_by && (
                <p className="text-muted-foreground truncate">By: {log.performed_by}</p>
              )}
              {log.ip_address && (
                <p className="text-muted-foreground">IP: {log.ip_address}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
