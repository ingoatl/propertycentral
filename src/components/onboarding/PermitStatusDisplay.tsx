import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Shield, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface PermitStatusDisplayProps {
  projectId: string;
  taskId: string;
}

interface PermitData {
  permit_expiration_date: string | null;
  permit_number?: string | null;
  jurisdiction?: string | null;
  reminderScheduled?: boolean;
}

export const PermitStatusDisplay = ({ projectId, taskId }: PermitStatusDisplayProps) => {
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [permitData, setPermitData] = useState<PermitData | null>(null);

  useEffect(() => {
    loadPermitData();
    
    // Subscribe to changes
    const channel = supabase
      .channel(`permit-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'property_documents',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          loadPermitData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, taskId]);

  const loadPermitData = async () => {
    try {
      // Get the project to find property_id
      const { data: project } = await supabase
        .from("onboarding_projects")
        .select("property_id")
        .eq("id", projectId)
        .maybeSingle();

      if (!project?.property_id) {
        setLoading(false);
        return;
      }

      // Check for permit documents with AI-extracted data
      const { data: docs } = await supabase
        .from("property_documents")
        .select("ai_extracted_data, permit_expiration_date")
        .eq("project_id", projectId)
        .eq("document_type", "str_permit")
        .order("created_at", { ascending: false })
        .limit(1);

      if (docs && docs.length > 0) {
        const doc = docs[0];
        const extractedData = doc.ai_extracted_data as Record<string, any> | null;
        
        // Check if reminder is scheduled
        const { data: reminder } = await supabase
          .from("permit_reminders")
          .select("id, status")
          .eq("property_id", project.property_id)
          .maybeSingle();

        setPermitData({
          permit_expiration_date: doc.permit_expiration_date || extractedData?.expiration_date || null,
          permit_number: extractedData?.permit_number || null,
          jurisdiction: extractedData?.jurisdiction || null,
          reminderScheduled: !!reminder,
        });
        setAnalyzing(false);
      } else {
        // Check if there are attachments being uploaded (analyzing state)
        const { data: attachments } = await supabase
          .from("task_attachments")
          .select("id, created_at")
          .eq("task_id", taskId)
          .order("created_at", { ascending: false })
          .limit(1);

        if (attachments && attachments.length > 0) {
          // Check if recently uploaded (within last 30 seconds)
          const lastUpload = new Date(attachments[0].created_at);
          const isRecent = (Date.now() - lastUpload.getTime()) < 30000;
          setAnalyzing(isRecent);
        }
      }
    } catch (error) {
      console.error("Error loading permit data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return null;
  }

  if (analyzing) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Analyzing permit with AI...</span>
      </div>
    );
  }

  if (!permitData || !permitData.permit_expiration_date) {
    return null;
  }

  const expirationDate = parseISO(permitData.permit_expiration_date);
  const daysUntilExpiry = differenceInDays(expirationDate, new Date());

  // Color coding based on days until expiry
  const getExpiryColor = () => {
    if (daysUntilExpiry < 0) return "destructive";
    if (daysUntilExpiry <= 30) return "destructive";
    if (daysUntilExpiry <= 90) return "secondary"; // yellow/warning
    return "default"; // green
  };

  const getExpiryBgClass = () => {
    if (daysUntilExpiry < 0) return "bg-red-50 border-red-200";
    if (daysUntilExpiry <= 30) return "bg-red-50 border-red-200";
    if (daysUntilExpiry <= 90) return "bg-amber-50 border-amber-200";
    return "bg-green-50 border-green-200";
  };

  const getExpiryTextClass = () => {
    if (daysUntilExpiry < 0) return "text-red-700";
    if (daysUntilExpiry <= 30) return "text-red-700";
    if (daysUntilExpiry <= 90) return "text-amber-700";
    return "text-green-700";
  };

  const getExpiryIcon = () => {
    if (daysUntilExpiry < 0 || daysUntilExpiry <= 30) {
      return <AlertTriangle className="w-3.5 h-3.5 text-red-600" />;
    }
    if (daysUntilExpiry <= 90) {
      return <CalendarClock className="w-3.5 h-3.5 text-amber-600" />;
    }
    return <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />;
  };

  return (
    <div className={cn("p-3 rounded-lg border space-y-2", getExpiryBgClass())}>
      <div className="flex items-center gap-2">
        {getExpiryIcon()}
        <span className={cn("text-sm font-medium", getExpiryTextClass())}>
          {daysUntilExpiry < 0 ? (
            <>Expired {format(expirationDate, "MMM d, yyyy")}</>
          ) : (
            <>Expires {format(expirationDate, "MMM d, yyyy")}</>
          )}
        </span>
        {daysUntilExpiry >= 0 && (
          <Badge variant={getExpiryColor()} className="text-xs">
            {daysUntilExpiry === 0 ? "Today" : `${daysUntilExpiry} days`}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {permitData.permit_number && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Shield className="w-3 h-3" />
            <span>#{permitData.permit_number}</span>
          </div>
        )}
        {permitData.jurisdiction && (
          <span className="text-muted-foreground">
            • {permitData.jurisdiction}
          </span>
        )}
      </div>

      {permitData.reminderScheduled && (
        <div className="flex items-center gap-1.5 text-xs text-green-700">
          <CheckCircle2 className="w-3 h-3" />
          <span>Reminder scheduled (30 days before expiry)</span>
        </div>
      )}
    </div>
  );
};
