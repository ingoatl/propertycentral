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
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Shield, Download, AlertTriangle, CheckCircle } from "lucide-react";
import { format, differenceInDays, isBefore } from "date-fns";
import { toast } from "sonner";

interface InsuranceCertificate {
  id: string;
  property_id: string;
  insurance_type: string;
  provider: string;
  policy_number: string | null;
  coverage_amount: number | null;
  effective_date: string;
  expiration_date: string;
  document_path: string | null;
  created_at: string;
  property_name?: string;
}

export function InsuranceTab() {
  const [certificates, setCertificates] = useState<InsuranceCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadCertificates();
  }, []);

  const loadCertificates = async () => {
    setLoading(true);
    try {
      const { data: propData } = await supabase
        .from("properties")
        .select("id, name")
        .is("offboarded_at", null);

      const { data, error } = await supabase
        .from("insurance_certificates")
        .select("*")
        .order("expiration_date", { ascending: true });

      if (error) throw error;

      const enriched = (data || []).map((cert) => ({
        ...cert,
        property_name: propData?.find((p) => p.id === cert.property_id)?.name || "Unknown",
      }));

      setCertificates(enriched);
    } catch (error) {
      console.error("Error loading insurance certificates:", error);
      toast.error("Failed to load insurance records");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getExpirationStatus = (expirationDate: string) => {
    const expDate = new Date(expirationDate);
    const today = new Date();
    const daysUntilExpiration = differenceInDays(expDate, today);

    if (isBefore(expDate, today)) {
      return { status: "expired", label: "Expired", color: "bg-red-100 text-red-800" };
    } else if (daysUntilExpiration <= 30) {
      return { status: "expiring", label: `${daysUntilExpiration}d left`, color: "bg-amber-100 text-amber-800" };
    } else if (daysUntilExpiration <= 90) {
      return { status: "warning", label: `${daysUntilExpiration}d left`, color: "bg-yellow-100 text-yellow-800" };
    }
    return { status: "active", label: "Active", color: "bg-green-100 text-green-800" };
  };

  const downloadDocument = async (docPath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("onboarding-documents")
        .createSignedUrl(docPath, 60);

      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (error) {
      toast.error("Failed to download document");
    }
  };

  const filteredCertificates = certificates.filter((cert) =>
    cert.property_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cert.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cert.policy_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cert.insurance_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: certificates.length,
    active: certificates.filter((c) => getExpirationStatus(c.expiration_date).status === "active").length,
    expiringSoon: certificates.filter((c) => ["warning", "expiring"].includes(getExpirationStatus(c.expiration_date).status)).length,
    expired: certificates.filter((c) => getExpirationStatus(c.expiration_date).status === "expired").length,
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
          <div className="text-sm text-muted-foreground">Total Certificates</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Active</div>
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Expiring Soon</div>
          <div className="text-2xl font-bold text-amber-600">{stats.expiringSoon}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Expired</div>
          <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
        </Card>
      </div>

      {stats.expired > 0 && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-900">Expired Insurance Certificates</h4>
              <p className="text-sm text-red-800 mt-1">
                {stats.expired} certificate(s) have expired. Please obtain updated certificates immediately.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <Input
          placeholder="Search property, provider, policy..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Button variant="outline" onClick={loadCertificates}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {filteredCertificates.length === 0 ? (
        <Card className="p-8 text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Insurance Certificates Found</h3>
          <p className="text-muted-foreground">
            Property insurance certificates will appear here once added.
          </p>
        </Card>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Policy #</TableHead>
                <TableHead className="text-right">Coverage</TableHead>
                <TableHead>Effective</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Document</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCertificates.map((cert) => {
                const expStatus = getExpirationStatus(cert.expiration_date);
                return (
                  <TableRow key={cert.id}>
                    <TableCell className="font-medium max-w-[150px] truncate">
                      {cert.property_name}
                    </TableCell>
                    <TableCell className="capitalize">{cert.insurance_type}</TableCell>
                    <TableCell>{cert.provider}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {cert.policy_number || "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(cert.coverage_amount)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(cert.effective_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {format(new Date(cert.expiration_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge className={expStatus.color}>
                        {expStatus.status === "active" && <CheckCircle className="h-3 w-3 mr-1" />}
                        {expStatus.status === "expired" && <AlertTriangle className="h-3 w-3 mr-1" />}
                        {expStatus.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {cert.document_path ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadDocument(cert.document_path!)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          None
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Card className="p-4 bg-blue-50 border-blue-200">
        <h4 className="font-medium text-blue-900 mb-2">Insurance Requirements</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Liability insurance with minimum $1M coverage recommended</li>
          <li>• Property insurance covering structure and contents</li>
          <li>• Flood insurance required in designated flood zones</li>
          <li>• Certificates should be renewed 30 days before expiration</li>
        </ul>
      </Card>
    </div>
  );
}
