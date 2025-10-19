import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Users, Target, FileText, Plus, Save, Trash2 } from "lucide-react";
import { ONBOARDING_PHASES } from "@/context/onboardingPhases";

interface TeamRole {
  id: string;
  role_name: string;
  description: string | null;
}

interface UserWithRole {
  id: string;
  email: string;
  first_name: string | null;
  role_id: string | null;
  role_name: string | null;
}

interface PhaseAssignment {
  phase_number: number;
  phase_title: string;
  role_id: string | null;
}

export const TeamMatrixTab = () => {
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [phaseAssignments, setPhaseAssignments] = useState<PhaseAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadRoles(), loadUsers(), loadPhaseAssignments()]);
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    const { data, error } = await supabase
      .from("team_roles")
      .select("*")
      .order("role_name");

    if (error) throw error;
    setRoles(data || []);
  };

  const loadUsers = async () => {
    const { data: profilesData, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, first_name")
      .eq("status", "approved")
      .order("email");

    if (profilesError) throw profilesError;

    // Get user team role assignments
    const { data: teamRolesData } = await supabase
      .from("user_team_roles")
      .select("user_id, role_id, team_roles(role_name)");

    const usersWithRoles = profilesData?.map((profile) => {
      const teamRole = teamRolesData?.find((tr) => tr.user_id === profile.id);
      return {
        ...profile,
        role_id: teamRole?.role_id || null,
        role_name: teamRole?.team_roles?.role_name || null,
      };
    }) || [];

    setUsers(usersWithRoles);
  };

  const loadPhaseAssignments = async () => {
    const { data, error } = await supabase
      .from("phase_role_assignments")
      .select("*")
      .order("phase_number");

    if (error && error.code !== 'PGRST116') throw error;

    // Create array for all 9 phases
    const assignments = ONBOARDING_PHASES.map((phase) => {
      const existing = data?.find((a) => a.phase_number === phase.id);
      return {
        phase_number: phase.id,
        phase_title: phase.title,
        role_id: existing?.role_id || null,
      };
    });

    setPhaseAssignments(assignments);
  };

  const handleAddRole = async () => {
    if (!newRoleName.trim()) {
      toast.error("Role name is required");
      return;
    }

    try {
      const { error } = await supabase
        .from("team_roles")
        .insert({
          role_name: newRoleName.trim(),
          description: newRoleDescription.trim() || null,
        });

      if (error) throw error;

      toast.success("Role created successfully");
      setNewRoleName("");
      setNewRoleDescription("");
      loadRoles();
    } catch (error: any) {
      toast.error("Failed to create role: " + error.message);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    try {
      const { error } = await supabase
        .from("team_roles")
        .delete()
        .eq("id", roleId);

      if (error) throw error;

      toast.success("Role deleted");
      loadRoles();
    } catch (error: any) {
      toast.error("Failed to delete role: " + error.message);
    }
  };

  const handleAssignUserToRole = async (userId: string, roleId: string | null) => {
    try {
      if (!roleId) {
        // Remove user from role
        await supabase
          .from("user_team_roles")
          .delete()
          .eq("user_id", userId);
      } else {
        // Upsert user to role
        const { error } = await supabase
          .from("user_team_roles")
          .upsert({
            user_id: userId,
            role_id: roleId,
            is_primary: true,
          }, {
            onConflict: "user_id,role_id",
          });

        if (error) {
          // Try delete first then insert
          await supabase.from("user_team_roles").delete().eq("user_id", userId);
          await supabase.from("user_team_roles").insert({
            user_id: userId,
            role_id: roleId,
            is_primary: true,
          });
        }
      }

      toast.success("User role updated");
      loadUsers();
    } catch (error: any) {
      toast.error("Failed to assign role: " + error.message);
    }
  };

  const handleUpdateFirstName = async (userId: string, firstName: string) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ first_name: firstName })
        .eq("id", userId);

      if (error) throw error;

      toast.success("Name updated");
      loadUsers();
    } catch (error: any) {
      toast.error("Failed to update name: " + error.message);
    }
  };

  const handleAssignPhaseToRole = async (phaseNumber: number, roleId: string | null) => {
    try {
      const phase = ONBOARDING_PHASES.find((p) => p.id === phaseNumber);
      if (!phase) return;

      if (!roleId) {
        // Remove assignment
        await supabase
          .from("phase_role_assignments")
          .delete()
          .eq("phase_number", phaseNumber);
      } else {
        // Upsert assignment
        const { error } = await supabase
          .from("phase_role_assignments")
          .upsert({
            phase_number: phaseNumber,
            phase_title: phase.title,
            role_id: roleId,
          }, {
            onConflict: "phase_number",
          });

        if (error) throw error;
      }

      toast.success("Phase assignment updated");
      loadPhaseAssignments();
    } catch (error: any) {
      toast.error("Failed to assign phase: " + error.message);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading team matrix...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Manage Roles Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Manage Team Roles
          </CardTitle>
          <CardDescription>
            Define the roles that team members can be assigned to
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add New Role */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <h4 className="font-semibold mb-3">Add New Role</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="new-role-name">Role Name *</Label>
                <Input
                  id="new-role-name"
                  placeholder="e.g., Property Manager"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-role-description">Description</Label>
                <Input
                  id="new-role-description"
                  placeholder="Optional description"
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={handleAddRole} className="mt-3 gap-2">
              <Plus className="w-4 h-4" />
              Add Role
            </Button>
          </div>

          {/* Existing Roles */}
          <div className="space-y-2">
            <h4 className="font-semibold">Existing Roles</h4>
            {roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No roles created yet</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {roles.map((role) => (
                  <div
                    key={role.id}
                    className="border rounded-lg p-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">{role.role_name}</p>
                      {role.description && (
                        <p className="text-xs text-muted-foreground">{role.description}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteRole(role.id)}
                      className="h-8 w-8"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Assign Users to Roles Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Assign Team Members to Roles
          </CardTitle>
          <CardDescription>
            Assign each approved user to a team role and edit their display name
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No approved users yet</p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="border rounded-lg p-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-center"
                >
                  <div>
                    <Label htmlFor={`name-${user.id}`} className="text-xs text-muted-foreground">
                      Display Name
                    </Label>
                    <Input
                      id={`name-${user.id}`}
                      value={user.first_name || user.email.split("@")[0]}
                      onBlur={(e) => handleUpdateFirstName(user.id, e.target.value)}
                      onChange={(e) => {
                        setUsers((prev) =>
                          prev.map((u) =>
                            u.id === user.id ? { ...u, first_name: e.target.value } : u
                          )
                        );
                      }}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <p className="text-sm mt-1">{user.email}</p>
                  </div>
                  <div>
                    <Label htmlFor={`role-${user.id}`} className="text-xs text-muted-foreground">
                      Team Role
                    </Label>
                    <Select
                      value={user.role_id || ""}
                      onValueChange={(value) => handleAssignUserToRole(user.id, value || null)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select role..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Unassigned</SelectItem>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.role_name}
                          </SelectItem>
                        ))
                        }
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))
              }
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phase-to-Role Assignment Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Phase Assignment Matrix
          </CardTitle>
          <CardDescription>
            Assign each onboarding phase to a team role. Tasks in each phase will be automatically assigned to the user with that role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {phaseAssignments.map((assignment) => (
              <div
                key={assignment.phase_number}
                className="border rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center"
              >
                <div>
                  <p className="font-medium">
                    Phase {assignment.phase_number}: {assignment.phase_title}
                  </p>
                </div>
                <div>
                  <Select
                    value={assignment.role_id || ""}
                    onValueChange={(value) =>
                      handleAssignPhaseToRole(assignment.phase_number, value || null)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Unassigned</SelectItem>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.role_name}
                        </SelectItem>
                      ))
                      }
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))
            }
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
