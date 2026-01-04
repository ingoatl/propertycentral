import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield, AlertTriangle } from "lucide-react";
import { StatementArchiveTab } from "@/components/admin/audit/StatementArchiveTab";
import { RentRollTab } from "@/components/admin/audit/RentRollTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AuditPortal() {
  const { token } = useParams<{ token: string }>();
  const [valid, setValid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) { setValid(false); setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from("audit_access_tokens")
        .select("id, expires_at, is_active")
        .eq("token", token)
        .single();

      if (error || !data || !data.is_active || new Date(data.expires_at) < new Date()) {
        setValid(false);
      } else {
        setValid(true);
        // Log access
        await supabase.from("audit_access_log").insert({ token_id: data.id });
        await supabase.from("audit_access_tokens").update({ accessed_count: 1, last_accessed_at: new Date().toISOString() }).eq("id", data.id);
      }
    } catch { setValid(false); }
    setLoading(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse">Validating access...</div></div>;

  if (!valid) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8">
        <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900">Invalid or Expired Link</h1>
        <p className="text-gray-600 mt-2">This audit access link is no longer valid.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-green-600" />
            <div>
              <h1 className="text-2xl font-bold">GREC Audit Portal</h1>
              <p className="text-gray-600">Read-only compliance records for Georgia Real Estate Commission</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <Tabs defaultValue="statements">
            <TabsList><TabsTrigger value="statements">Statements</TabsTrigger><TabsTrigger value="rentroll">Rent Roll</TabsTrigger></TabsList>
            <TabsContent value="statements" className="mt-4"><StatementArchiveTab /></TabsContent>
            <TabsContent value="rentroll" className="mt-4"><RentRollTab /></TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
