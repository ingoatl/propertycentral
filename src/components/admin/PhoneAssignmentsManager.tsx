import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Phone, Plus, Trash2, Loader2, User } from "lucide-react";
import { toast } from "sonner";

interface PhoneAssignment {
  id: string;
  user_id: string;
  phone_number: string;
  phone_type: string;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
  user_email?: string;
}

interface Profile {
  id: string;
  email: string;
  first_name: string | null;
}

export function PhoneAssignmentsManager() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [phoneType, setPhoneType] = useState<"personal" | "company">("personal");
  const [displayName, setDisplayName] = useState("");
  const queryClient = useQueryClient();

  // Fetch all phone assignments
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["phone-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_phone_assignments")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user emails for each assignment
      const assignmentsWithEmails: PhoneAssignment[] = [];
      for (const assignment of data || []) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", assignment.user_id)
          .single();
        
        assignmentsWithEmails.push({
          ...assignment,
          user_email: profile?.email || "Unknown",
        });
      }

      return assignmentsWithEmails;
    },
  });

  // Fetch all users for the dropdown
  const { data: users = [] } = useQuery<Profile[]>({
    queryKey: ["profiles-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, first_name")
        .order("email");

      if (error) throw error;
      return data || [];
    },
  });

  // Add new assignment mutation
  const addMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserId || !newPhoneNumber) {
        throw new Error("Please select a user and enter a phone number");
      }

      // Format phone number
      let formattedPhone = newPhoneNumber.replace(/\D/g, "");
      if (!formattedPhone.startsWith("+")) {
        formattedPhone = formattedPhone.startsWith("1") 
          ? `+${formattedPhone}` 
          : `+1${formattedPhone}`;
      }

      const { error } = await supabase
        .from("user_phone_assignments")
        .insert({
          user_id: selectedUserId,
          phone_number: formattedPhone,
          phone_type: phoneType,
          display_name: displayName || null,
          is_active: true,
        });

      if (error) throw error;

      // Update the user's profile with the assigned phone number
      await supabase
        .from("profiles")
        .update({ assigned_phone_number: formattedPhone })
        .eq("id", selectedUserId);
    },
    onSuccess: () => {
      toast.success("Phone number assigned successfully");
      setShowAddDialog(false);
      setNewPhoneNumber("");
      setSelectedUserId("");
      setPhoneType("personal");
      setDisplayName("");
      queryClient.invalidateQueries({ queryKey: ["phone-assignments"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to assign phone number");
    },
  });

  // Delete assignment mutation
  const deleteMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from("user_phone_assignments")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assignment deleted");
      queryClient.invalidateQueries({ queryKey: ["phone-assignments"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete assignment");
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("user_phone_assignments")
        .update({ is_active: !isActive })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      queryClient.invalidateQueries({ queryKey: ["phone-assignments"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update status");
    },
  });

  const formatPhoneDisplay = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Phone Assignments
          </CardTitle>
          <CardDescription>
            Assign Telnyx phone numbers to team members
          </CardDescription>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Assignment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Phone Number</DialogTitle>
              <DialogDescription>
                Assign a Telnyx phone number to a team member for sending/receiving calls and texts
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Team Member</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {user.first_name || user.email}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  placeholder="+1 (404) 341-5202"
                  value={newPhoneNumber}
                  onChange={(e) => setNewPhoneNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the ported Telnyx phone number
                </p>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={phoneType} onValueChange={(v) => setPhoneType(v as "personal" | "company")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal (DID)</SelectItem>
                    <SelectItem value="company">Company Line</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Display Name (Optional)</Label>
                <Input
                  placeholder="e.g., Alex's Direct Line"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
                {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Assign Number
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Phone className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No phone assignments yet</p>
            <p className="text-sm">Add your first assignment to get started</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Phone Number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{assignment.display_name || assignment.user_email}</p>
                      {assignment.display_name && (
                        <p className="text-xs text-muted-foreground">{assignment.user_email}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatPhoneDisplay(assignment.phone_number)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={assignment.phone_type === "personal" ? "default" : "secondary"}>
                      {assignment.phone_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActiveMutation.mutate({ 
                        id: assignment.id, 
                        isActive: assignment.is_active 
                      })}
                      disabled={toggleActiveMutation.isPending}
                    >
                      <Badge variant={assignment.is_active ? "default" : "outline"}>
                        {assignment.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(assignment.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Quick assignment for ported numbers */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
          <h4 className="font-medium mb-2">Ported Numbers Ready for Assignment</h4>
          <p className="text-sm text-muted-foreground mb-3">
            Once your numbers are ported to Telnyx, assign them here:
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between p-2 bg-background rounded">
              <span className="font-mono">+1 (404) 341-5202</span>
              <span className="text-muted-foreground">→ Alex</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-background rounded">
              <span className="font-mono">+1 (470) 863-8087</span>
              <span className="text-muted-foreground">→ Anja</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-background rounded">
              <span className="font-mono">+1 (678) 498-7376</span>
              <span className="text-muted-foreground">→ Ingo</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
