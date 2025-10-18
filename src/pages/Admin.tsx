import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, Shield, UserPlus, Key } from "lucide-react";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const changePasswordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

interface Profile {
  id: string;
  email: string;
  status: "pending" | "approved" | "rejected";
  is_admin: boolean;
  has_user_role: boolean;
  created_at: string;
}

const Admin = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [autoApprove, setAutoApprove] = useState(true);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

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

      // Get all roles for all users
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role");

      // Merge the data
      const adminUserIds = new Set(rolesData?.filter(r => r.role === 'admin').map(r => r.user_id) || []);
      const userRoleIds = new Set(rolesData?.filter(r => r.role === 'user').map(r => r.user_id) || []);
      const profilesWithRoles = profilesData?.map(profile => ({
        ...profile,
        is_admin: adminUserIds.has(profile.id),
        has_user_role: userRoleIds.has(profile.id)
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = createUserSchema.safeParse({ 
      email: newUserEmail, 
      password: newUserPassword 
    });
    
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setCreatingUser(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email: newUserEmail,
            password: newUserPassword,
            autoApprove,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create user");
      }

      toast.success(`User ${newUserEmail} created successfully!`);
      setNewUserEmail("");
      setNewUserPassword("");
      loadProfiles();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Failed to create user");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleSendWelcomeEmail = async (email: string, password: string, isExistingUser: boolean = false) => {
    try {
      console.log("Sending welcome email to:", email);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-welcome-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email,
            tempPassword: password,
            isExistingUser,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send email");
      }

      toast.success(`Welcome email sent to ${email}`);
    } catch (error: any) {
      console.error("Error sending welcome email:", error);
      toast.error(error.message || "Failed to send welcome email");
    }
  };

  const generateRandomPassword = () => {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  };

  const handleResetPasswordAndEmail = async (userId: string, email: string) => {
    try {
      const newPassword = generateRandomPassword();
      console.log("Resetting password for:", email);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Not authenticated");
        return;
      }

      // Update password using admin API
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/admin/users/${userId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            password: newPassword,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to reset password");
      }

      // Send email with new password
      await handleSendWelcomeEmail(email, newPassword, false);
      
      toast.success(`Password reset and email sent to ${email}`);
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast.error(error.message || "Failed to reset password");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = changePasswordSchema.safeParse({ newPassword });
    
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success("Password changed successfully!");
      setNewPassword("");
    } catch (error: any) {
      console.error("Error changing password:", error);
      toast.error(error.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
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

  const toggleUserRole = async (userId: string, currentStatus: boolean) => {
    try {
      if (currentStatus) {
        // Remove user role
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "user");

        if (error) throw error;
      } else {
        // Add user role
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "user" });

        if (error) throw error;
      }

      await loadProfiles();
      toast.success(`User role ${!currentStatus ? "granted" : "revoked"}`);
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Error updating user role:", error);
      }
      toast.error("Failed to update user role");
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

      {/* Admin Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-card border-border/50">
          <CardHeader className="bg-gradient-subtle rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Create New User
            </CardTitle>
            <CardDescription>
              Add a new user account with email and password
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-email">Email</Label>
                <Input
                  id="new-email"
                  type="email"
                  placeholder="user@example.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  required
                  maxLength={255}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="auto-approve"
                  checked={autoApprove}
                  onChange={(e) => setAutoApprove(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="auto-approve" className="cursor-pointer text-sm">
                  Auto-approve user
                </Label>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={creatingUser} className="flex-1">
                  {creatingUser ? "Creating..." : "Create User"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => handleSendWelcomeEmail(newUserEmail, newUserPassword)}
                  disabled={!newUserEmail || !newUserPassword}
                >
                  Send Welcome Email
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border/50">
          <CardHeader className="bg-gradient-subtle rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Change Your Password
            </CardTitle>
            <CardDescription>
              Update your admin account password
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" disabled={changingPassword} className="w-full">
                {changingPassword ? "Changing..." : "Change Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Separator />

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
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{profile.email}</p>
                      {profile.is_admin && (
                        <Badge variant="secondary" className="gap-1">
                          <Shield className="w-3 h-3" />
                          Admin
                        </Badge>
                      )}
                      {profile.has_user_role && (
                        <Badge variant="outline" className="gap-1">
                          User Access
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Joined: {new Date(profile.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleAdminStatus(profile.id, profile.is_admin)}
                    >
                      {profile.is_admin ? "Remove Admin" : "Make Admin"}
                    </Button>
                    <Button
                      size="sm"
                      variant={profile.has_user_role ? "secondary" : "default"}
                      onClick={() => toggleUserRole(profile.id, profile.has_user_role)}
                    >
                      {profile.has_user_role ? "Remove User Role" : "Grant User Role"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResetPasswordAndEmail(profile.id, profile.email)}
                    >
                      Reset Password & Email
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
