import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { 
  Calendar, Clock, MapPin, User, Building, Phone, Mail, 
  FileText, Edit2, Trash2, CheckCircle, XCircle, AlertCircle,
  ExternalLink, Navigation
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  TeamAppointment, 
  APPOINTMENT_TYPES, 
  APPOINTMENT_STATUSES,
  useUpdateAppointment,
  useDeleteAppointment 
} from "@/hooks/useTeamAppointments";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AppointmentDetailModalProps {
  appointment: TeamAppointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AppointmentDetailModal({
  appointment,
  open,
  onOpenChange,
}: AppointmentDetailModalProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(appointment?.notes || "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const updateAppointment = useUpdateAppointment();
  const deleteAppointment = useDeleteAppointment();

  if (!appointment) return null;

  const typeConfig = APPOINTMENT_TYPES.find((t) => t.value === appointment.appointment_type);
  const statusConfig = APPOINTMENT_STATUSES.find((s) => s.value === appointment.status);

  const handleStatusChange = async (newStatus: string) => {
    await updateAppointment.mutateAsync({
      id: appointment.id,
      status: newStatus,
    });
  };

  const handleSaveNotes = async () => {
    await updateAppointment.mutateAsync({
      id: appointment.id,
      notes,
    });
    setEditingNotes(false);
  };

  const handleDelete = async () => {
    await deleteAppointment.mutateAsync(appointment.id);
    setShowDeleteConfirm(false);
    onOpenChange(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "cancelled":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "no_show":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getGoogleMapsUrl = (address: string) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className={cn("w-3 h-3 rounded-full", typeConfig?.color || "bg-gray-500")} />
                  <Badge variant="outline" className="text-xs">
                    {typeConfig?.label || appointment.appointment_type}
                  </Badge>
                </div>
                <DialogTitle className="text-xl">{appointment.title}</DialogTitle>
                <DialogDescription className="flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(appointment.scheduled_at), "EEEE, MMMM d, yyyy")}
                  <span className="mx-1">•</span>
                  <Clock className="h-4 w-4" />
                  {format(new Date(appointment.scheduled_at), "h:mm a")}
                  {appointment.end_time && (
                    <> - {format(new Date(appointment.end_time), "h:mm a")}</>
                  )}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-2">
                {getStatusIcon(appointment.status)}
                <Select value={appointment.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-32 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPOINTMENT_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Assigned To */}
              {appointment.assigned_profile && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Assigned To</p>
                    <p className="font-medium">
                      {appointment.assigned_profile.first_name || appointment.assigned_profile.email}
                    </p>
                  </div>
                </div>
              )}

              {/* Property */}
              {appointment.property && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Building className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Property</p>
                    <p className="font-medium">{appointment.property.name}</p>
                    <p className="text-sm text-muted-foreground">{appointment.property.address}</p>
                  </div>
                </div>
              )}

              {/* Location */}
              {appointment.location_address && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Location</p>
                    <p className="font-medium">{appointment.location_address}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(getGoogleMapsUrl(appointment.location_address!), "_blank")}
                  >
                    <Navigation className="h-4 w-4 mr-1" />
                    Directions
                  </Button>
                </div>
              )}

              {/* Description */}
              {appointment.description && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="text-sm">{appointment.description}</p>
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                {appointment.contact_phone && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`tel:${appointment.contact_phone}`}>
                      <Phone className="h-4 w-4 mr-1" />
                      Call
                    </a>
                  </Button>
                )}
                {appointment.contact_email && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`mailto:${appointment.contact_email}`}>
                      <Mail className="h-4 w-4 mr-1" />
                      Email
                    </a>
                  </Button>
                )}
                {appointment.location_address && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(getGoogleMapsUrl(appointment.location_address!), "_blank")}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open in Maps
                  </Button>
                )}
              </div>
            </TabsContent>

            <TabsContent value="details" className="space-y-4 mt-4">
              {/* Contact Info */}
              {(appointment.contact_name || appointment.contact_phone || appointment.contact_email) && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Contact Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {appointment.contact_name && (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{appointment.contact_name}</span>
                      </div>
                    )}
                    {appointment.contact_phone && (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${appointment.contact_phone}`} className="text-sm text-blue-600 hover:underline">
                          {appointment.contact_phone}
                        </a>
                      </div>
                    )}
                    {appointment.contact_email && (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded col-span-full">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${appointment.contact_email}`} className="text-sm text-blue-600 hover:underline">
                          {appointment.contact_email}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Linked Records */}
              {(appointment.lead || appointment.owner) && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Linked Records</h4>
                  <div className="space-y-2">
                    {appointment.lead && (
                      <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                        <p className="text-xs text-muted-foreground">Lead</p>
                        <p className="font-medium">{appointment.lead.name}</p>
                        {appointment.lead.email && (
                          <p className="text-sm text-muted-foreground">{appointment.lead.email}</p>
                        )}
                      </div>
                    )}
                    {appointment.owner && (
                      <div className="p-2 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-800">
                        <p className="text-xs text-muted-foreground">Property Owner</p>
                        <p className="font-medium">{appointment.owner.name}</p>
                        {appointment.owner.email && (
                          <p className="text-sm text-muted-foreground">{appointment.owner.email}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Appointment Details</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-2 bg-muted/50 rounded">
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p>{appointment.duration_minutes} minutes</p>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p>{format(new Date(appointment.created_at), "MMM d, yyyy")}</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="mt-4">
              <div className="space-y-3">
                {editingNotes ? (
                  <>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add notes about this appointment..."
                      rows={6}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveNotes} disabled={updateAppointment.isPending}>
                        Save Notes
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingNotes(false)}>
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-4 bg-muted/50 rounded-lg min-h-[100px]">
                      {appointment.notes ? (
                        <p className="text-sm whitespace-pre-wrap">{appointment.notes}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No notes yet</p>
                      )}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setEditingNotes(true)}>
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit Notes
                    </Button>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* Footer Actions */}
          <div className="flex justify-between items-center pt-4 border-t mt-4">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{appointment.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
