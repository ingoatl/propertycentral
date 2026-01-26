import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/ProtectedRoute";
import { toast } from "sonner";

export interface CallAlert {
  id: string;
  call_id: string;
  call_type: "discovery" | "owner" | "team_appointment";
  admin_user_id: string;
  alert_type: "5min" | "due";
  contact_name: string | null;
  property_address: string | null;
  scheduled_at: string;
  meeting_link: string | null;
  phone_number: string | null;
  dismissed: boolean;
  created_at: string;
}

// Admin user IDs (Anja and Ingo)
const ADMIN_USER_IDS = [
  "b2f495ac-2062-446e-bfa0-2197a82114c1", // Anja
  "8f7c8f43-536f-4587-99dc-5086c144a045", // Ingo
];

export function useCallReminders() {
  const { user } = useAuth();
  const [imminentCall, setImminentCall] = useState<CallAlert | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);

  const isAdmin = user?.id && ADMIN_USER_IDS.includes(user.id);

  // Request notification permission on mount
  useEffect(() => {
    if (isAdmin && !hasRequestedPermission && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().then((permission) => {
          console.log("Notification permission:", permission);
          setHasRequestedPermission(true);
        });
      } else {
        setHasRequestedPermission(true);
      }
    }
  }, [isAdmin, hasRequestedPermission]);

  // Calculate minutes until a date
  const minutesUntil = useCallback((dateStr: string): number => {
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.floor(diff / 60000);
  }, []);

  // Dismiss an alert
  const dismissAlert = useCallback(async (alertId: string | undefined) => {
    if (!alertId) return;
    
    try {
      await supabase
        .from("admin_call_alerts")
        .update({ dismissed: true, dismissed_at: new Date().toISOString() })
        .eq("id", alertId);
      
      setImminentCall(null);
      setShowModal(false);
    } catch (error) {
      console.error("Error dismissing alert:", error);
    }
  }, []);

  // Check for imminent calls
  const checkForAlerts = useCallback(async () => {
    if (!user?.id || !isAdmin) return;

    try {
      const now = new Date();
      const in10Min = new Date(now.getTime() + 10 * 60 * 1000);

      // Fetch upcoming undismissed alerts
      const { data, error } = await supabase
        .from("admin_call_alerts")
        .select("*")
        .eq("admin_user_id", user.id)
        .eq("dismissed", false)
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", in10Min.toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(1);

      if (error) {
        console.error("Error fetching alerts:", error);
        return;
      }

      if (data && data.length > 0) {
        const alert = data[0] as CallAlert;
        const mins = minutesUntil(alert.scheduled_at);
        
        // Only show if we don't already have this alert displayed
        if (!imminentCall || imminentCall.id !== alert.id) {
          setImminentCall(alert);

          // Show browser notification if within 5 minutes
          if (mins <= 5 && mins >= 0 && "Notification" in window && Notification.permission === "granted") {
            const callTypeLabel = alert.call_type === "discovery" ? "Discovery Call" : 
                                  alert.call_type === "owner" ? "Owner Call" : "Appointment";
            
            new Notification(`📞 ${callTypeLabel} in ${mins} min!`, {
              body: `${alert.contact_name || "Contact"} ${alert.property_address ? `- ${alert.property_address}` : ""}`,
              icon: "/favicon.ico",
              requireInteraction: true,
              tag: `call-reminder-${alert.id}`,
            });
          }

          // Show toast notification
          if (mins <= 5) {
            toast.info(`📞 Call with ${alert.contact_name} in ${mins} minute${mins !== 1 ? "s" : ""}!`, {
              duration: 10000,
              action: {
                label: "View",
                onClick: () => setShowModal(true),
              },
            });
          }

          // Show full modal if <= 1 minute away
          if (mins <= 1) {
            setShowModal(true);
          }
        } else {
          // Update existing alert with fresh data
          setImminentCall(alert);
          
          // Check if we should now show the modal
          if (mins <= 1 && !showModal) {
            setShowModal(true);
          }
        }
      } else {
        // No alerts, clear state
        if (imminentCall) {
          setImminentCall(null);
        }
      }
    } catch (error) {
      console.error("Error checking for alerts:", error);
    }
  }, [user?.id, isAdmin, imminentCall, minutesUntil, showModal]);

  // Poll for alerts every 30 seconds
  useEffect(() => {
    if (!isAdmin) return;

    // Initial check
    checkForAlerts();

    // Set up interval
    const interval = setInterval(checkForAlerts, 30000);

    return () => clearInterval(interval);
  }, [isAdmin, checkForAlerts]);

  // Also check when there's a direct discovery/owner call update
  useEffect(() => {
    if (!isAdmin) return;

    // Subscribe to new alerts
    const channel = supabase
      .channel("admin_call_alerts_realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "admin_call_alerts",
          filter: `admin_user_id=eq.${user?.id}`,
        },
        (payload) => {
          console.log("New call alert received:", payload);
          checkForAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, user?.id, checkForAlerts]);

  return {
    imminentCall,
    showModal,
    setShowModal,
    dismissAlert,
    isAdmin,
    minutesUntil,
  };
}
