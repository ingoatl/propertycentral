import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, Shield } from "lucide-react";

interface Profile {
  id: string;
  email: string;
  status: "pending" | "approved" | "rejected";
  is_admin: boolean;
  created_at: string;
}

const Admin = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminStatus();
    loadProfiles();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      setIsAdmin(!!roles);
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error checking admin status:", error);
      }
    }
  };

  const loadProfiles = async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Get admin roles for all users
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("role", "admin");

      // Merge the data
      const adminUserIds = new Set(rolesData?.map(r => r.user_id) || []);
      const profilesWithRoles = profilesData?.map(profile => ({
        ...profile,
        is_admin: adminUserIds.has(profile.id)
      })) || [];

      setProfiles(profilesWithRoles);
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error loading profiles:", error);
      }
      toast.error("Failed to load profiles");
    } finally {
      setLoading(false);
    }
  };

  const updateUserStatus = async (userId: string, status: "approved" | "rejected") => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status })
        .eq("id", userId);

      if (error) throw error;

      await loadProfiles();
      toast.success(`User ${status === "approved" ? "approved" : "rejected"} successfully`);
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error updating user status:", error);
      }
      toast.error("Failed to update user status");
    }
  };

  const toggleAdminStatus = async (userId: string, currentStatus: boolean) => {
    try {
      if (currentStatus) {
        // Remove admin role
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");

        if (error) throw error;
      } else {
        // Add admin role
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" });

        if (error) throw error;
      }

      await loadProfiles();
      toast.success(`Admin status ${!currentStatus ? "granted" : "revoked"}`);
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error updating admin status:", error);
      }
      toast.error("Failed to update admin status");
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You need admin privileges to access this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const pendingUsers = profiles.filter((p) => p.status === "pending");
  const approvedUsers = profiles.filter((p) => p.status === "approved");
  const rejectedUsers = profiles.filter((p) => p.status === "rejected");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="pb-4 border-b border-border/50">
        <h1 className="text-4xl font-bold bg-gradient-primary bg-clip-text text-transparent">Admin Panel</h1>
        <p className="text-muted-foreground mt-1">Manage user access and permissions</p>
      </div>

      {/* Pending Approvals */}
      <Card className="shadow-card border-border/50">
        <CardHeader className="bg-gradient-subtle rounded-t-lg">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Pending Approvals ({pendingUsers.length})
          </CardTitle>
          <CardDescription>New users waiting for approval</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {pendingUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No pending approvals</p>
          ) : (
            <div className="space-y-3">
              {pendingUsers.map((profile) => (
                <div
                  key={profile.id}
                  className="p-4 border border-border/50 rounded-lg flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-medium">{profile.email}</p>
                    <p className="text-sm text-muted-foreground">
                      Requested: {new Date(profile.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => updateUserStatus(profile.id, "approved")}
                      className="gap-1"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => updateUserStatus(profile.id, "rejected")}
                      className="gap-1"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approved Users */}
      <Card className="shadow-card border-border/50">
        <CardHeader className="bg-gradient-subtle rounded-t-lg">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Approved Users ({approvedUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {approvedUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No approved users</p>
          ) : (
            <div className="space-y-3">
              {approvedUsers.map((profile) => (
                <div
                  key={profile.id}
                  className="p-4 border border-border/50 rounded-lg flex items-center justify-between gap-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{profile.email}</p>
                      {profile.is_admin && (
                        <Badge variant="secondary" className="gap-1">
                          <Shield className="w-3 h-3" />
                          Admin
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Joined: {new Date(profile.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleAdminStatus(profile.id, profile.is_admin)}
                    >
                      {profile.is_admin ? "Remove Admin" : "Make Admin"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => updateUserStatus(profile.id, "rejected")}
                    >
                      Revoke Access
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rejected Users */}
      {rejectedUsers.length > 0 && (
        <Card className="shadow-card border-border/50">
          <CardHeader className="bg-gradient-subtle rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" />
              Rejected Users ({rejectedUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-3">
              {rejectedUsers.map((profile) => (
                <div
                  key={profile.id}
                  className="p-4 border border-border/50 rounded-lg flex items-center justify-between gap-4 opacity-60"
                >
                  <div>
                    <p className="font-medium">{profile.email}</p>
                    <p className="text-sm text-muted-foreground">
                      Rejected: {new Date(profile.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateUserStatus(profile.id, "approved")}
                  >
                    Approve
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Admin;
