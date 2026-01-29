import { ReactNode, useState, useEffect } from "react";
import { LogOut, Bot, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "./ProtectedRoute";
import { useNavigate, useLocation } from "react-router-dom";
import { ChatDialog } from "@/components/ai-assistant/ChatDialog";
import { MainNavigation } from "@/components/navigation/MainNavigation";
import { MobileNavigation } from "@/components/navigation/MobileNavigation";
import { MobileHeaderBar } from "@/components/navigation/MobileHeaderBar";
import { QuickCommunicationButton } from "@/components/communications/QuickCommunicationButton";
import { useLeadRealtimeMessages } from "@/hooks/useLeadRealtimeMessages";
import { TaskConfirmationModal } from "@/components/TaskConfirmationModal";
import { CallRecapModal } from "@/components/CallRecapModal";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NotificationBell } from "@/components/team-hub/NotificationBell";
import { TaskNotificationBell } from "@/components/dashboard/TaskNotificationBell";
import { useInAppNotifications } from "@/hooks/useTeamHub";
import { IncomingCallProvider } from "@/components/communications/IncomingCallProvider";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { user, loading, pendingApproval } = useAuth() as any;
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasUserRole, setHasUserRole] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  
  // Real-time notifications for inbound lead messages
  useLeadRealtimeMessages();
  
  // Get notification count - must be called before any conditional returns
  const { data: notifications = [] } = useInAppNotifications();
  const unreadCount = notifications.length;

  useEffect(() => {
    const checkRoles = async () => {
      if (!user) return;
      
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      setIsAdmin(roles?.some(r => r.role === 'admin') || false);
      setHasUserRole(roles?.some(r => r.role === 'user') || false);
    };

    checkRoles();
  }, [user]);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("Logged out successfully");
    } catch (error: any) {
      if (import.meta.env.DEV) {
        console.error("Logout error:", error);
      }
      toast.error("Failed to log out");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Show pending approval message
  if (pendingApproval) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Account Pending Approval
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Your account has been created successfully! An administrator needs to approve your access before you can use the application.
            </p>
            <p className="text-sm text-muted-foreground">
              You'll receive an email once your account is approved. Thank you for your patience!
            </p>
            <Button onClick={handleLogout} variant="outline" className="w-full">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canAccessNav = isAdmin || hasUserRole;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Mobile Header */}
      <MobileHeaderBar
        isAdmin={isAdmin}
        hasUserRole={hasUserRole}
        user={user}
        onOpenAiChat={() => setAiChatOpen(true)}
        navigationContent={<MobileNavigation isAdmin={isAdmin} />}
      />
      
      {/* Desktop Header - Hidden on mobile */}
      <header className="hidden md:block bg-card/80 backdrop-blur-md border-b border-border shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-2 sm:px-4">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Left side: Logo */}
            <div className="flex items-center gap-2 sm:gap-3">
              <h1 className="text-lg font-bold text-foreground">Property Central</h1>
            </div>

            {/* Center: Desktop Navigation */}
            {canAccessNav && <MainNavigation isAdmin={isAdmin} />}

            {/* Right side: Quick Actions + Team Hub + Notification Bell + AI + Logout */}
            <div className="flex items-center gap-1 sm:gap-2">
              {canAccessNav && <QuickCommunicationButton />}
              
              {/* Team Hub Direct Access */}
              {canAccessNav && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigate('/team-hub')}
                      className="shrink-0 h-9 gap-2"
                    >
                      <Users className="h-4 w-4" />
                      <span className="hidden lg:inline">Team Hub</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Open Team Hub for internal messaging</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              {/* Task Assignment Notification Bell */}
              {canAccessNav && <TaskNotificationBell />}
              
              {/* Team Hub Notification Bell */}
              {canAccessNav && <NotificationBell />}
              
              {/* AI Assistant Button in Nav */}
              {canAccessNav && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setAiChatOpen(true)}
                      className="shrink-0 h-9 gap-2"
                    >
                      <Bot className="h-4 w-4" />
                      <span className="hidden sm:inline">AI</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Ask questions about properties, bookings, and more</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              {user && (
                <>
                  <span className="text-sm text-muted-foreground hidden xl:inline truncate max-w-[120px]">
                    {user.email}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleLogout} 
                    className="shrink-0 h-9"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 md:py-8 text-base">{children}</main>
      
      {/* AI Chat Dialog - moved from floating button to header-triggered */}
      <ChatDialog open={aiChatOpen} onOpenChange={setAiChatOpen} />
      
      <CallRecapModal />
      <TaskConfirmationModal />
      
      {/* Incoming Call Modal - listens for realtime call notifications */}
      <IncomingCallProvider />
    </div>
  );
};

export default Layout;
