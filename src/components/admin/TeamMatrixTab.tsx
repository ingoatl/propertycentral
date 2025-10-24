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

interface UserWithRoles {
  id: string;
  email: string;
  first_name: string | null;
  roles: { role_id: string; role_name: string }[];
}

interface PhaseAssignment {
  phase_number: number;
  phase_title: string;
  role_id: string | null;
}

export const TeamMatrixTab = () => {
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [users, setUsers] = useState<UserWithRoles[]>([]);
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

    // Get all user team role assignments
    const { data: teamRolesData } = await supabase
      .from("user_team_roles")
      .select("user_id, role_id, team_roles(role_name)");

    const usersWithRoles = profilesData?.map((profile) => {
      const userRoles = teamRolesData?.filter((tr) => tr.user_id === profile.id) || [];
      return {
        ...profile,
        roles: userRoles.map((tr) => ({
          role_id: tr.role_id,
          role_name: tr.team_roles?.role_name || "",
        })),
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

  const handleAddRoleToUser = async (userId: string, roleId: string) => {
    try {
      const { error } = await supabase
        .from("user_team_roles")
        .insert({
          user_id: userId,
          role_id: roleId,
          is_primary: false,
        });

      if (error) throw error;

      toast.success("Role added");
      loadUsers();
    } catch (error: any) {
      toast.error("Failed to add role: " + error.message);
    }
  };

  const handleRemoveRoleFromUser = async (userId: string, roleId: string) => {
    try {
      const { error } = await supabase
        .from("user_team_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role_id", roleId);

      if (error) throw error;

      toast.success("Role removed");
      loadUsers();
    } catch (error: any) {
      toast.error("Failed to remove role: " + error.message);
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

      // Convert "unassigned" string to null
      const actualRoleId = roleId === "unassigned" ? null : roleId;

      if (!actualRoleId) {
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
            role_id: actualRoleId,
          }, {
            onConflict: "phase_number",
          });

        if (error) throw error;
      }

      toast.success("Phase assignment updated - updating task assignments...");
      await loadPhaseAssignments();
      
      // Auto-assign tasks based on new phase assignments
      await autoAssignTasksForPhase(phaseNumber, actualRoleId);
    } catch (error: any) {
      toast.error("Failed to assign phase: " + error.message);
    }
  };

  const autoAssignTasksForPhase = async (phaseNumber: number, roleId: string | null) => {
    try {
      // Get all unassigned or role-only tasks for this phase
      const { data: tasks, error: tasksError } = await supabase
        .from("onboarding_tasks")
        .select("id, title")
        .eq("phase_number", phaseNumber)
        .neq("status", "completed");

      if (tasksError) throw tasksError;
      if (!tasks || tasks.length === 0) return;

      // Find user with this role
      let assignedToUuid = null;
      if (roleId) {
        const { data: userRole } = await supabase
          .from("user_team_roles")
          .select("user_id")
          .eq("role_id", roleId)
          .eq("is_primary", true)
          .single();

        assignedToUuid = userRole?.user_id || null;
      }

      // Update all tasks in this phase
      const { error: updateError } = await supabase
        .from("onboarding_tasks")
        .update({
          assigned_to_uuid: assignedToUuid,
          assigned_role_id: roleId,
        })
        .eq("phase_number", phaseNumber)
        .neq("status", "completed");

      if (updateError) throw updateError;

      if (assignedToUuid) {
        toast.success(`Assigned ${tasks.length} tasks from this phase to team member`);
      } else if (roleId) {
        toast.info(`Assigned ${tasks.length} tasks to role (no primary user assigned yet)`);
      } else {
        toast.info(`Unassigned ${tasks.length} tasks from this phase`);
      }
    } catch (error: any) {
      console.error("Error auto-assigning tasks:", error);
      toast.error("Failed to auto-assign tasks: " + error.message);
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
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  </div>
                  
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">
                      Assigned Roles
                    </Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {user.roles.length === 0 ? (
                        <span className="text-sm text-muted-foreground">No roles assigned</span>
                      ) : (
                        user.roles.map((role) => (
                          <div
                            key={role.role_id}
                            className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-md text-sm"
                          >
                            <span>{role.role_name}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 p-0 hover:bg-destructive/20"
                              onClick={() => handleRemoveRoleFromUser(user.id, role.role_id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                    <Select
                      value=""
                      onValueChange={(value) => handleAddRoleToUser(user.id, value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Add a role..." />
                      </SelectTrigger>
                      <SelectContent>
                        {roles
                          .filter((role) => !user.roles.some((ur) => ur.role_id === role.id))
                          .map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.role_name}
                            </SelectItem>
                          ))}
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
                    value={assignment.role_id || "unassigned"}
                    onValueChange={(value) =>
                      handleAssignPhaseToRole(assignment.phase_number, value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.role_name}
                        </SelectItem>
                      ))}
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
