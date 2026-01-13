import { ReactNode, useState, useEffect } from "react";
import { Building2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "./ProtectedRoute";
import { FloatingChatButton } from "@/components/ai-assistant/FloatingChatButton";
import { MainNavigation } from "@/components/navigation/MainNavigation";
import { MobileNavigation } from "@/components/navigation/MobileNavigation";
import { QuickCommunicationButton } from "@/components/communications/QuickCommunicationButton";
import { useLeadRealtimeMessages } from "@/hooks/useLeadRealtimeMessages";
import { TaskConfirmationModal } from "@/components/TaskConfirmationModal";
import { CallRecapModal } from "@/components/CallRecapModal";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { user, loading, pendingApproval } = useAuth() as any;
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasUserRole, setHasUserRole] = useState(false);
  
  // Real-time notifications for inbound lead messages
  useLeadRealtimeMessages();

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
              <Building2 className="w-6 h-6" />
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
      <header className="bg-card/80 backdrop-blur-md border-b border-border shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-2 sm:px-4">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Left side: Mobile menu + Logo */}
            <div className="flex items-center gap-2 sm:gap-3">
              {canAccessNav && <MobileNavigation isAdmin={isAdmin} />}
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-warm">
                  <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-lg font-bold text-foreground">Property Central</h1>
                </div>
              </div>
            </div>

            {/* Center: Desktop Navigation */}
            {canAccessNav && <MainNavigation isAdmin={isAdmin} />}

            {/* Right side: Quick Actions + User info + Logout */}
            <div className="flex items-center gap-1 sm:gap-2">
              {canAccessNav && <QuickCommunicationButton />}
              {user && (
                <>
                  <span className="text-sm text-muted-foreground hidden lg:inline truncate max-w-[150px]">
                    {user.email}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleLogout} 
                    className="shrink-0 h-9 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
                  >
                    <LogOut className="h-4 w-4 lg:mr-2" />
                    <span className="hidden lg:inline">Logout</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 md:py-8 text-base">{children}</main>
      <FloatingChatButton />
      <CallRecapModal />
      <TaskConfirmationModal />
    </div>
  );
};

export default Layout;
