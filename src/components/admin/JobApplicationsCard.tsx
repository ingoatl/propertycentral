import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { User, Mail, Phone, Clock, Wrench, Eye, RefreshCw } from "lucide-react";

interface JobApplication {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  availability: string[];
  has_technical_skills: boolean;
  detail_oriented_example: string | null;
  status: string;
  created_at: string;
}

export function JobApplicationsCard() {
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("job_applications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (error: any) {
      console.error("Error loading applications:", error);
      toast.error("Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadApplications();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from("job_applications")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
      toast.success(`Status updated to ${status}`);
      loadApplications();
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "reviewing":
        return <Badge className="bg-blue-500">Reviewing</Badge>;
      case "interviewed":
        return <Badge className="bg-purple-500">Interviewed</Badge>;
      case "hired":
        return <Badge className="bg-green-500">Hired</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Job Applications</h2>
          <p className="text-muted-foreground">
            {applications.length} application{applications.length !== 1 ? "s" : ""} received
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadApplications} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading applications...</div>
      ) : applications.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No applications yet. Share the job posting link to start receiving applications.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <Card key={app.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{app.full_name}</CardTitle>
                      <CardDescription className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {app.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {app.phone}
                        </span>
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(app.status)}
                    <Select value={app.status} onValueChange={(val) => updateStatus(app.id, val)}>
                      <SelectTrigger className="w-[130px] h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="reviewing">Reviewing</SelectItem>
                        <SelectItem value="interviewed">Interviewed</SelectItem>
                        <SelectItem value="hired">Hired</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {app.availability.length > 0 ? (
                    app.availability.map((a) => (
                      <Badge key={a} variant="outline" className="capitalize">
                        <Clock className="w-3 h-3 mr-1" />
                        {a}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No availability specified</span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <span className={`flex items-center gap-1.5 ${app.has_technical_skills ? "text-green-600" : "text-muted-foreground"}`}>
                    <Wrench className="w-4 h-4" />
                    Technical Skills: {app.has_technical_skills ? "Yes" : "No"}
                  </span>
                </div>

                {app.detail_oriented_example && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                      <Eye className="w-3 h-3" />
                      Detail-Oriented Example
                    </div>
                    <p className="text-sm">{app.detail_oriented_example}</p>
                  </div>
                )}

                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Applied {format(new Date(app.created_at), "MMM d, yyyy 'at' h:mm a")}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
