import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText,
  FileCheck,
  DollarSign,
  Home,
  Users,
  GraduationCap,
  Share2,
  Copy,
  CheckCircle,
  RefreshCw,
  Shield,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";

import { StatementArchiveTab } from "./audit/StatementArchiveTab";
import { ManagementAgreementsTab } from "./audit/ManagementAgreementsTab";
import { SecurityDepositLedger } from "./audit/SecurityDepositLedger";
import { RentRollTab } from "./audit/RentRollTab";
import { FairHousingTab } from "./audit/FairHousingTab";
import { TrainingLogTab } from "./audit/TrainingLogTab";

interface AuditStats {
  totalStatements: number;
  totalAgreements: number;
  totalProperties: number;
  totalApplications: number;
  totalTrainingRecords: number;
}

export function GRECAuditDashboard() {
  const [stats, setStats] = useState<AuditStats>({
    totalStatements: 0,
    totalAgreements: 0,
    totalProperties: 0,
    totalApplications: 0,
    totalTrainingRecords: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [expirationDays, setExpirationDays] = useState(30);
  const { toast } = useToast();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const { count: stmtCount } = await supabase.from("owner_statement_archive").select("*", { count: "exact", head: true });
      const { count: agreementCount } = await supabase.from("management_agreements").select("*", { count: "exact", head: true });
      const { count: propCount } = await supabase.from("properties").select("*", { count: "exact", head: true }).is("offboarded_at", null);
      const { count: appCount } = await supabase.from("tenant_applications").select("*", { count: "exact", head: true });
      const { count: trainCount } = await supabase.from("compliance_training_log").select("*", { count: "exact", head: true });

      setStats({
        totalStatements: stmtCount || 0,
        totalAgreements: agreementCount || 0,
        totalProperties: propCount || 0,
        totalApplications: appCount || 0,
        totalTrainingRecords: trainCount || 0,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateShareLink = async () => {
    setGeneratingLink(true);
    try {
      const expiresAt = addDays(new Date(), expirationDays);
      const { data, error } = await supabase.from("audit_access_tokens").insert({
        expires_at: expiresAt.toISOString(),
        notes: `Generated on ${format(new Date(), "MMM d, yyyy")} for GREC audit`,
      }).select("token").single();

      if (error) throw error;
      const link = `${window.location.origin}/audit/${data.token}`;
      setShareLink(link);
      toast({ title: "Audit Link Generated", description: `Link expires on ${format(expiresAt, "MMM d, yyyy")}` });
    } catch (error) {
      console.error("Error generating link:", error);
      toast({ title: "Error", description: "Failed to generate shareable link", variant: "destructive" });
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
    toast({ title: "Link Copied" });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Shield className="h-6 w-6 text-primary" />GREC Audit Compliance Dashboard</h2>
          <p className="text-muted-foreground mt-1">Georgia Real Estate Commission compliant record keeping</p>
        </div>
        <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
          <DialogTrigger asChild><Button variant="outline"><Share2 className="h-4 w-4 mr-2" />Share with Auditor</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Generate Shareable Audit Link</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">Generate a secure, time-limited link for GREC auditors.</p>
              <div className="space-y-2"><Label>Link Expiration (days)</Label><Input type="number" value={expirationDays} onChange={(e) => setExpirationDays(parseInt(e.target.value) || 30)} min={1} max={90} /></div>
              {!shareLink ? (
                <Button onClick={generateShareLink} className="w-full" disabled={generatingLink}>{generatingLink ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Generating...</> : "Generate Audit Link"}</Button>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2"><Input value={shareLink} readOnly className="text-sm" /><Button onClick={copyLink} variant="outline" size="icon">{linkCopied ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}</Button></div>
                  <p className="text-xs text-muted-foreground">This link will expire in {expirationDays} days.</p>
                  <Button variant="outline" onClick={() => setShareLink("")} className="w-full">Generate New Link</Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border rounded-lg p-4"><FileText className="h-5 w-5 text-primary mb-2" /><div className="text-2xl font-bold">{stats.totalStatements}</div><div className="text-sm text-muted-foreground">Statements</div></div>
        <div className="bg-card border rounded-lg p-4"><FileCheck className="h-5 w-5 text-green-600 mb-2" /><div className="text-2xl font-bold">{stats.totalAgreements}</div><div className="text-sm text-muted-foreground">Agreements</div></div>
        <div className="bg-card border rounded-lg p-4"><Home className="h-5 w-5 text-blue-600 mb-2" /><div className="text-2xl font-bold">{stats.totalProperties}</div><div className="text-sm text-muted-foreground">Properties</div></div>
        <div className="bg-card border rounded-lg p-4"><Users className="h-5 w-5 text-purple-600 mb-2" /><div className="text-2xl font-bold">{stats.totalApplications}</div><div className="text-sm text-muted-foreground">Applications</div></div>
        <div className="bg-card border rounded-lg p-4"><GraduationCap className="h-5 w-5 text-orange-600 mb-2" /><div className="text-2xl font-bold">{stats.totalTrainingRecords}</div><div className="text-sm text-muted-foreground">Training</div></div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3"><Shield className="h-5 w-5 text-green-600 mt-0.5" /><div><h4 className="font-medium text-green-900">GREC Compliance Status</h4><p className="text-sm text-green-800 mt-1">Records retained 3+ years. All financial statements, agreements, and fair housing documentation archived.</p></div></div>
      </div>

      <Tabs defaultValue="statements" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="statements"><FileText className="h-4 w-4 mr-1" />Statements</TabsTrigger>
          <TabsTrigger value="agreements"><FileCheck className="h-4 w-4 mr-1" />Agreements</TabsTrigger>
          <TabsTrigger value="deposits"><DollarSign className="h-4 w-4 mr-1" />Deposits</TabsTrigger>
          <TabsTrigger value="rentroll"><Home className="h-4 w-4 mr-1" />Rent Roll</TabsTrigger>
          <TabsTrigger value="fairhousing"><Users className="h-4 w-4 mr-1" />Fair Housing</TabsTrigger>
          <TabsTrigger value="training"><GraduationCap className="h-4 w-4 mr-1" />Training</TabsTrigger>
        </TabsList>
        <TabsContent value="statements"><StatementArchiveTab /></TabsContent>
        <TabsContent value="agreements"><ManagementAgreementsTab /></TabsContent>
        <TabsContent value="deposits"><SecurityDepositLedger /></TabsContent>
        <TabsContent value="rentroll"><RentRollTab /></TabsContent>
        <TabsContent value="fairhousing"><FairHousingTab /></TabsContent>
        <TabsContent value="training"><TrainingLogTab /></TabsContent>
      </Tabs>
    </div>
  );
}
