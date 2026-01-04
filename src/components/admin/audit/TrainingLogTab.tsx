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
import { Plus, GraduationCap, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, addYears, isBefore } from "date-fns";

interface TrainingRecord {
  id: string;
  user_id: string;
  user_name: string;
  training_type: string;
  training_name: string;
  training_date: string;
  training_provider: string;
  certificate_path: string | null;
  expiration_date: string | null;
  hours_completed: number;
  passed: boolean;
}

export function TrainingLogTab() {
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newRecord, setNewRecord] = useState({
    user_name: "",
    training_type: "fair_housing",
    training_name: "",
    training_date: "",
    training_provider: "",
    hours_completed: 0,
    expiration_date: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("compliance_training_log")
        .select("*")
        .order("training_date", { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error("Error loading training records:", error);
      toast({
        title: "Error",
        description: "Failed to load training records",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddRecord = async () => {
    try {
      const { error } = await supabase.from("compliance_training_log").insert({
        ...newRecord,
        passed: true,
      });

      if (error) throw error;

      toast({ title: "Success", description: "Training record added" });
      setIsAddDialogOpen(false);
      setNewRecord({
        user_name: "",
        training_type: "fair_housing",
        training_name: "",
        training_date: "",
        training_provider: "",
        hours_completed: 0,
        expiration_date: "",
      });
      loadData();
    } catch (error) {
      console.error("Error adding record:", error);
      toast({ title: "Error", description: "Failed to add record", variant: "destructive" });
    }
  };

  const getTrainingTypeBadge = (type: string) => {
    const labels: Record<string, { label: string; color: string }> = {
      fair_housing: { label: "Fair Housing", color: "bg-blue-100 text-blue-800" },
      grec_law: { label: "GREC Law", color: "bg-purple-100 text-purple-800" },
      safety: { label: "Safety", color: "bg-orange-100 text-orange-800" },
      sexual_harassment: { label: "Sexual Harassment", color: "bg-pink-100 text-pink-800" },
      ada_compliance: { label: "ADA Compliance", color: "bg-green-100 text-green-800" },
      other: { label: "Other", color: "bg-gray-100 text-gray-800" },
    };
    const config = labels[type] || labels.other;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const isExpiringSoon = (expirationDate: string | null) => {
    if (!expirationDate) return false;
    const thirtyDaysFromNow = addYears(new Date(), 0);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return isBefore(new Date(expirationDate), thirtyDaysFromNow);
  };

  const isExpired = (expirationDate: string | null) => {
    if (!expirationDate) return false;
    return isBefore(new Date(expirationDate), new Date());
  };

  const stats = {
    total: records.length,
    fairHousing: records.filter(r => r.training_type === "fair_housing").length,
    grec: records.filter(r => r.training_type === "grec_law").length,
    expiringSoon: records.filter(r => isExpiringSoon(r.expiration_date) && !isExpired(r.expiration_date)).length,
    expired: records.filter(r => isExpired(r.expiration_date)).length,
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Total Records</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.fairHousing}</div>
          <div className="text-sm text-muted-foreground">Fair Housing</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-600">{stats.grec}</div>
          <div className="text-sm text-muted-foreground">GREC Law</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-600">{stats.expiringSoon}</div>
          <div className="text-sm text-muted-foreground">Expiring Soon</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-2xl font-bold text-red-600">{stats.expired}</div>
          <div className="text-sm text-muted-foreground">Expired</div>
        </div>
      </div>

      {/* Expiration Warning */}
      {stats.expired > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-900">Expired Training Certifications</h4>
              <p className="text-sm text-red-800 mt-1">
                {stats.expired} training certification(s) have expired. Please schedule renewal training immediately.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Compliance Training Log</h3>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Training Record
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Training Completion</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Staff Member Name</Label>
                <Input
                  value={newRecord.user_name}
                  onChange={(e) => setNewRecord({ ...newRecord, user_name: e.target.value })}
                  placeholder="Full name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Training Type</Label>
                  <Select 
                    value={newRecord.training_type} 
                    onValueChange={(v) => setNewRecord({ ...newRecord, training_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fair_housing">Fair Housing</SelectItem>
                      <SelectItem value="grec_law">GREC Law</SelectItem>
                      <SelectItem value="safety">Safety</SelectItem>
                      <SelectItem value="sexual_harassment">Sexual Harassment</SelectItem>
                      <SelectItem value="ada_compliance">ADA Compliance</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Training Date</Label>
                  <Input
                    type="date"
                    value={newRecord.training_date}
                    onChange={(e) => setNewRecord({ ...newRecord, training_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Training Name/Course</Label>
                <Input
                  value={newRecord.training_name}
                  onChange={(e) => setNewRecord({ ...newRecord, training_name: e.target.value })}
                  placeholder="e.g., Annual Fair Housing Certification"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Training Provider</Label>
                  <Input
                    value={newRecord.training_provider}
                    onChange={(e) => setNewRecord({ ...newRecord, training_provider: e.target.value })}
                    placeholder="e.g., NAR, GREC"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hours Completed</Label>
                  <Input
                    type="number"
                    value={newRecord.hours_completed}
                    onChange={(e) => setNewRecord({ ...newRecord, hours_completed: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Expiration Date (if applicable)</Label>
                <Input
                  type="date"
                  value={newRecord.expiration_date}
                  onChange={(e) => setNewRecord({ ...newRecord, expiration_date: e.target.value })}
                />
              </div>
              <Button onClick={handleAddRecord} className="w-full">
                Save Training Record
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      {records.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No Training Records</h3>
          <p className="text-muted-foreground">Add training completion records for compliance tracking</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Training Name</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead>Expiration</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">{record.user_name}</TableCell>
                  <TableCell>{getTrainingTypeBadge(record.training_type)}</TableCell>
                  <TableCell>{record.training_name}</TableCell>
                  <TableCell>{record.training_provider || "-"}</TableCell>
                  <TableCell>
                    {record.training_date
                      ? format(new Date(record.training_date), "MMM d, yyyy")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">{record.hours_completed || 0}</TableCell>
                  <TableCell>
                    {record.expiration_date ? (
                      <span className={
                        isExpired(record.expiration_date)
                          ? "text-red-600 font-medium"
                          : isExpiringSoon(record.expiration_date)
                          ? "text-yellow-600 font-medium"
                          : ""
                      }>
                        {format(new Date(record.expiration_date), "MMM d, yyyy")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {isExpired(record.expiration_date) ? (
                      <AlertTriangle className="h-5 w-5 text-red-600 mx-auto" />
                    ) : isExpiringSoon(record.expiration_date) ? (
                      <AlertTriangle className="h-5 w-5 text-yellow-600 mx-auto" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
                    )}
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
