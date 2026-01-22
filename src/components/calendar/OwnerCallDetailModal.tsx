import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PropertyPhotos } from "@/components/ui/property-photos";
import { CallDialog } from "@/components/communications/CallDialog";
import { toast } from "sonner";
import { formatInESTWithLabel } from "@/lib/timezone-utils";
import { cn } from "@/lib/utils";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Video,
  Tag,
  Trash2,
  Loader2,
  MapPin,
  DollarSign,
  Wrench,
  Users,
  TrendingUp,
  AlertCircle,
  Clock,
  ExternalLink,
  Home,
  BedDouble,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface OwnerCall {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  meeting_type: string | null;
  topic: string;
  topic_details?: string | null;
  meeting_notes?: string | null;
  google_meet_link: string | null;
  google_calendar_event_id: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  owner_id?: string | null;
  property_owners: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
}

interface OwnerCallDetailModalProps {
  ownerCall: OwnerCall | null;
  onClose: () => void;
  onOptimisticDelete: (callId: string) => void;
  onRevertDelete: (callId: string) => void;
  onDeleted: () => void;
}

interface OwnerContext {
  properties: Array<{
    id: string;
    name: string;
    address: string;
    image_path?: string;
  }>;
  recentRevenue: {
    thisMonth: number;
    lastMonth: number;
    ytd: number;
  };
  upcomingBookings: Array<{
    id: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
    propertyName: string;
    amount: number;
  }>;
  pendingMaintenance: Array<{
    id: string;
    title: string;
    status: string;
    propertyName: string;
    createdAt: string;
  }>;
  recentGuests: Array<{
    name: string;
    checkIn: string;
    checkOut: string;
    propertyName: string;
  }>;
}

const TOPIC_LABELS: Record<string, string> = {
  monthly_statement: "Monthly Statement",
  maintenance: "Maintenance & Repairs",
  guest_concerns: "Guest Concerns",
  pricing: "Pricing Discussion",
  general_checkin: "General Check-in",
  property_update: "Property Update",
  other: "Other",
};

const TOPIC_ICONS: Record<string, typeof DollarSign> = {
  monthly_statement: DollarSign,
  maintenance: Wrench,
  guest_concerns: Users,
  pricing: TrendingUp,
  general_checkin: Phone,
  property_update: Home,
  other: Tag,
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function OwnerCallDetailModal({
  ownerCall,
  onClose,
  onOptimisticDelete,
  onRevertDelete,
  onDeleted,
}: OwnerCallDetailModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCallDialog, setShowCallDialog] = useState(false);
  const [showCallConfirm, setShowCallConfirm] = useState(false);

  const ownerId = ownerCall?.owner_id || ownerCall?.property_owners?.id;
  const ownerName = ownerCall?.property_owners?.name || ownerCall?.contact_name || "Unknown Owner";
  const ownerEmail = ownerCall?.property_owners?.email || ownerCall?.contact_email;
  const ownerPhone = ownerCall?.property_owners?.phone || ownerCall?.contact_phone;

  // Fetch owner context data
  const { data: context, isLoading: isLoadingContext } = useQuery({
    queryKey: ["owner-call-context", ownerId],
    queryFn: async (): Promise<OwnerContext> => {
      if (!ownerId) {
        return {
          properties: [],
          recentRevenue: { thisMonth: 0, lastMonth: 0, ytd: 0 },
          upcomingBookings: [],
          pendingMaintenance: [],
          recentGuests: [],
        };
      }

      // Fetch properties
      const { data: properties } = await supabase
        .from("properties")
        .select("id, name, address, image_path")
        .eq("owner_id", ownerId);

      const propertyIds = properties?.map((p) => p.id) || [];

      // Fetch revenue data from bookings
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const yearStart = new Date(now.getFullYear(), 0, 1);

      let thisMonthRevenue = 0;
      let lastMonthRevenue = 0;
      let ytdRevenue = 0;

      if (propertyIds.length > 0) {
        // Fetch OwnerRez bookings
        const { data: ownerrezBookings } = await supabase
          .from("ownerrez_bookings")
          .select("total_amount, check_in, property_id")
          .in("property_id", propertyIds)
          .gte("check_in", yearStart.toISOString());

        ownerrezBookings?.forEach((b) => {
          const checkIn = new Date(b.check_in);
          ytdRevenue += b.total_amount || 0;
          if (checkIn >= thisMonthStart) {
            thisMonthRevenue += b.total_amount || 0;
          } else if (checkIn >= lastMonthStart && checkIn <= lastMonthEnd) {
            lastMonthRevenue += b.total_amount || 0;
          }
        });

        // Fetch mid-term bookings
        const { data: mtBookings } = await supabase
          .from("mid_term_bookings")
          .select("monthly_rent, start_date, property_id")
          .in("property_id", propertyIds)
          .gte("start_date", yearStart.toISOString().split("T")[0]);

        mtBookings?.forEach((b) => {
          const startDate = new Date(b.start_date);
          ytdRevenue += b.monthly_rent || 0;
          if (startDate >= thisMonthStart) {
            thisMonthRevenue += b.monthly_rent || 0;
          } else if (startDate >= lastMonthStart && startDate <= lastMonthEnd) {
            lastMonthRevenue += b.monthly_rent || 0;
          }
        });
      }

      // Fetch upcoming bookings
      const upcomingBookings: OwnerContext["upcomingBookings"] = [];
      if (propertyIds.length > 0) {
        const { data: upcoming } = await supabase
          .from("ownerrez_bookings")
          .select("id, guest_name, check_in, check_out, total_amount, property_id, properties(name)")
          .in("property_id", propertyIds)
          .gte("check_in", now.toISOString())
          .order("check_in", { ascending: true })
          .limit(5);

        upcoming?.forEach((b: any) => {
          upcomingBookings.push({
            id: b.id,
            guestName: b.guest_name || "Guest",
            checkIn: b.check_in,
            checkOut: b.check_out,
            propertyName: b.properties?.name || "Property",
            amount: b.total_amount || 0,
          });
        });
      }

      // Fetch pending maintenance
      const pendingMaintenance: OwnerContext["pendingMaintenance"] = [];
      if (propertyIds.length > 0) {
        const { data: maintenance } = await supabase
          .from("work_orders")
          .select("id, title, status, property_id, created_at, properties(name)")
          .in("property_id", propertyIds)
          .not("status", "in", '("completed", "cancelled")')
          .order("created_at", { ascending: false })
          .limit(5);

        maintenance?.forEach((m: any) => {
          pendingMaintenance.push({
            id: m.id,
            title: m.title,
            status: m.status,
            propertyName: m.properties?.name || "Property",
            createdAt: m.created_at,
          });
        });
      }

      // Fetch recent guests
      const recentGuests: OwnerContext["recentGuests"] = [];
      if (propertyIds.length > 0) {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const { data: recent } = await supabase
          .from("ownerrez_bookings")
          .select("guest_name, check_in, check_out, property_id, properties(name)")
          .in("property_id", propertyIds)
          .lte("check_in", now.toISOString())
          .gte("check_out", thirtyDaysAgo.toISOString())
          .order("check_in", { ascending: false })
          .limit(3);

        recent?.forEach((g: any) => {
          recentGuests.push({
            name: g.guest_name || "Guest",
            checkIn: g.check_in,
            checkOut: g.check_out,
            propertyName: g.properties?.name || "Property",
          });
        });
      }

      return {
        properties: properties || [],
        recentRevenue: {
          thisMonth: thisMonthRevenue,
          lastMonth: lastMonthRevenue,
          ytd: ytdRevenue,
        },
        upcomingBookings,
        pendingMaintenance,
        recentGuests,
      };
    },
    enabled: !!ownerCall && !!ownerId,
  });

  const handleDeleteOwnerCall = async () => {
    if (!ownerCall) return;
    setIsDeleting(true);

    // Optimistic update
    onOptimisticDelete(ownerCall.id);

    try {
      // Delete the Google Calendar event if it exists
      if (ownerCall.google_calendar_event_id) {
        console.log("Deleting Google Calendar event:", ownerCall.google_calendar_event_id);
        const { error: calendarError } = await supabase.functions.invoke(
          "delete-calendar-event",
          {
            body: { eventId: ownerCall.google_calendar_event_id },
          }
        );

        if (calendarError) {
          console.warn("Failed to delete calendar event:", calendarError);
        }
      }

      // Delete from database
      const { error } = await supabase.from("owner_calls").delete().eq("id", ownerCall.id);

      if (error) throw error;

      toast.success("Owner call deleted", {
        description: `Call with ${ownerName} removed`,
      });

      onDeleted();
      onClose();
    } catch (error: any) {
      console.error("Error deleting owner call:", error);
      // Revert optimistic update on error
      onRevertDelete(ownerCall.id);
      toast.error("Failed to delete call", {
        description: error.message,
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCallOwner = () => {
    setShowCallConfirm(false);
    setShowCallDialog(true);
  };

  if (!ownerCall) return null;

  const scheduledAt = new Date(ownerCall.scheduled_at);
  const isVideoCall = ownerCall.meeting_type === "video";
  const TopicIcon = TOPIC_ICONS[ownerCall.topic] || Tag;
  const primaryProperty = context?.properties?.[0];

  return (
    <>
      <Dialog open={!!ownerCall} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4">
            <DialogHeader className="space-y-1">
              <DialogTitle className="flex items-center gap-3 text-white">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-lg font-semibold">{ownerName}</span>
                  <p className="text-sm font-normal text-purple-200">
                    {formatInESTWithLabel(scheduledAt, "EEEE, MMMM d 'at' h:mm a")} EST
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    "ml-auto",
                    isVideoCall
                      ? "bg-blue-500/20 text-blue-100 border-blue-400/30"
                      : "bg-green-500/20 text-green-100 border-green-400/30"
                  )}
                >
                  {isVideoCall ? (
                    <>
                      <Video className="h-3 w-3 mr-1" /> Video Call
                    </>
                  ) : (
                    <>
                      <Phone className="h-3 w-3 mr-1" /> Phone Call
                    </>
                  )}
                </Badge>
              </DialogTitle>
            </DialogHeader>
          </div>

          <ScrollArea className="max-h-[calc(90vh-180px)]">
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Left Column - Property & Context */}
                <div className="lg:col-span-3 space-y-4">
                  {/* Property Photo & Address */}
                  {primaryProperty ? (
                    <div className="rounded-xl border overflow-hidden bg-card">
                      <PropertyPhotos
                        address={primaryProperty.address}
                        height="200px"
                        className="rounded-none"
                      />
                      <div className="p-3 border-t bg-muted/30">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{primaryProperty.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {primaryProperty.address}
                            </p>
                          </div>
                          <Button variant="ghost" size="sm" className="shrink-0 h-7 px-2" asChild>
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                primaryProperty.address
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        </div>
                        {context && context.properties.length > 1 && (
                          <Badge variant="secondary" className="mt-2 text-xs">
                            +{context.properties.length - 1} more properties
                          </Badge>
                        )}
                      </div>
                    </div>
                  ) : isLoadingContext ? (
                    <Skeleton className="h-[250px] rounded-xl" />
                  ) : (
                    <div className="h-[200px] bg-muted rounded-xl flex items-center justify-center border">
                      <div className="text-center text-muted-foreground">
                        <Home className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No property linked</p>
                      </div>
                    </div>
                  )}

                  {/* Revenue Summary */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                        This Month
                      </p>
                      <p className="text-lg font-bold text-green-700 dark:text-green-300">
                        {isLoadingContext ? (
                          <Skeleton className="h-6 w-16" />
                        ) : (
                          formatCurrency(context?.recentRevenue.thisMonth || 0)
                        )}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                        Last Month
                      </p>
                      <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                        {isLoadingContext ? (
                          <Skeleton className="h-6 w-16" />
                        ) : (
                          formatCurrency(context?.recentRevenue.lastMonth || 0)
                        )}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg border bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                      <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                        YTD Revenue
                      </p>
                      <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
                        {isLoadingContext ? (
                          <Skeleton className="h-6 w-16" />
                        ) : (
                          formatCurrency(context?.recentRevenue.ytd || 0)
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Upcoming Bookings */}
                  {context?.upcomingBookings && context.upcomingBookings.length > 0 && (
                    <div className="rounded-lg border p-3">
                      <h4 className="font-medium text-sm flex items-center gap-2 mb-3">
                        <BedDouble className="h-4 w-4 text-blue-500" />
                        Upcoming Bookings
                      </h4>
                      <div className="space-y-2">
                        {context.upcomingBookings.slice(0, 3).map((booking) => (
                          <div
                            key={booking.id}
                            className="flex items-center justify-between text-sm p-2 rounded bg-muted/50"
                          >
                            <div className="min-w-0">
                              <p className="font-medium truncate">{booking.guestName}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(booking.checkIn).toLocaleDateString()} -{" "}
                                {new Date(booking.checkOut).toLocaleDateString()}
                              </p>
                            </div>
                            <Badge variant="secondary" className="shrink-0 ml-2">
                              {formatCurrency(booking.amount)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pending Maintenance */}
                  {context?.pendingMaintenance && context.pendingMaintenance.length > 0 && (
                    <div className="rounded-lg border p-3 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
                      <h4 className="font-medium text-sm flex items-center gap-2 mb-3 text-amber-700 dark:text-amber-400">
                        <Wrench className="h-4 w-4" />
                        Open Maintenance ({context.pendingMaintenance.length})
                      </h4>
                      <div className="space-y-2">
                        {context.pendingMaintenance.slice(0, 3).map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 text-sm p-2 rounded bg-white dark:bg-amber-900/20"
                          >
                            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{item.title}</p>
                              <p className="text-xs text-muted-foreground">{item.propertyName}</p>
                            </div>
                            <Badge
                              variant="outline"
                              className="text-xs shrink-0 capitalize border-amber-300 text-amber-700"
                            >
                              {item.status.replace(/_/g, " ")}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Guests */}
                  {context?.recentGuests && context.recentGuests.length > 0 && (
                    <div className="rounded-lg border p-3">
                      <h4 className="font-medium text-sm flex items-center gap-2 mb-3">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        Recent Guests (Last 30 Days)
                      </h4>
                      <div className="space-y-2">
                        {context.recentGuests.map((guest, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50"
                          >
                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{guest.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {guest.propertyName} •{" "}
                                {new Date(guest.checkIn).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column - Contact & Call Info */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Topic Card */}
                  <div className="p-4 rounded-xl border bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-800 flex items-center justify-center">
                        <TopicIcon className="h-5 w-5 text-purple-600 dark:text-purple-300" />
                      </div>
                      <div>
                        <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                          Call Topic
                        </p>
                        <p className="font-semibold text-purple-800 dark:text-purple-200">
                          {TOPIC_LABELS[ownerCall.topic] || ownerCall.topic}
                        </p>
                      </div>
                    </div>
                    {ownerCall.topic_details && (
                      <p className="mt-3 text-sm text-purple-700 dark:text-purple-300 bg-white dark:bg-purple-900/30 rounded-lg p-2 border border-purple-100 dark:border-purple-700">
                        {ownerCall.topic_details}
                      </p>
                    )}
                  </div>

                  {/* Contact Info */}
                  <div className="p-4 rounded-xl border">
                    <h4 className="font-semibold text-sm mb-3">Contact Information</h4>
                    <div className="space-y-3">
                      {ownerEmail && (
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground">Email</p>
                            <p className="text-sm font-medium truncate">{ownerEmail}</p>
                          </div>
                        </div>
                      )}
                      {ownerPhone && (
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground">Phone</p>
                            <p className="text-sm font-medium">{ownerPhone}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-muted-foreground">Duration</p>
                          <p className="text-sm font-medium">{ownerCall.duration_minutes} minutes</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    {isVideoCall && ownerCall.google_meet_link ? (
                      <Button
                        className="w-full h-12 text-sm bg-blue-600 hover:bg-blue-700 font-medium"
                        asChild
                      >
                        <a href={ownerCall.google_meet_link} target="_blank" rel="noopener noreferrer">
                          <Video className="h-5 w-5 mr-2" /> Join Google Meet
                        </a>
                      </Button>
                    ) : (
                      ownerPhone && (
                        <Button
                          className="w-full h-12 text-sm bg-green-600 hover:bg-green-700 font-medium"
                          onClick={() => setShowCallConfirm(true)}
                        >
                          <Phone className="h-5 w-5 mr-2" /> Call {ownerPhone}
                        </Button>
                      )
                    )}

                    {/* If video call but also has phone, show secondary call button */}
                    {isVideoCall && ownerPhone && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowCallConfirm(true)}
                      >
                        <Phone className="h-4 w-4 mr-2" /> Call Instead: {ownerPhone}
                      </Button>
                    )}
                  </div>

                  {/* Meet Link Display */}
                  {ownerCall.google_meet_link && (
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">
                        Google Meet Link
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300 break-all font-mono">
                        {ownerCall.google_meet_link}
                      </p>
                    </div>
                  )}

                  {/* Notes */}
                  {ownerCall.meeting_notes && (
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                      <h4 className="font-semibold text-xs flex items-center gap-1 text-amber-800 dark:text-amber-200 mb-2">
                        Notes
                      </h4>
                      <p className="text-sm text-amber-900 dark:text-amber-100 whitespace-pre-wrap">
                        {ownerCall.meeting_notes}
                      </p>
                    </div>
                  )}

                  {/* Delete Button */}
                  <Button
                    variant="outline"
                    className="w-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Delete Call
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Call Confirmation Dialog */}
      <AlertDialog open={showCallConfirm} onOpenChange={setShowCallConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-green-600" />
              Call {ownerName}?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>You're about to initiate a call to:</p>
              <div className="p-4 rounded-lg bg-muted mt-2">
                <p className="font-semibold text-lg">{ownerName}</p>
                <p className="text-primary font-medium text-lg">{ownerPhone}</p>
                {ownerCall.topic && (
                  <Badge variant="outline" className="mt-2">
                    {TOPIC_LABELS[ownerCall.topic] || ownerCall.topic}
                  </Badge>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCallOwner} className="bg-green-600 hover:bg-green-700">
              <Phone className="h-4 w-4 mr-2" />
              Yes, Call Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete Owner Call?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this owner call and remove it from the calendar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOwnerCall}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Call Dialog */}
      <CallDialog
        open={showCallDialog}
        onOpenChange={setShowCallDialog}
        contactName={ownerName}
        contactPhone={ownerPhone || undefined}
        ownerId={ownerId || undefined}
      />
    </>
  );
}
