import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Building2, DollarSign, Calendar, LogOut, Shield, Users, Receipt, FileText, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "./ProtectedRoute";
import { FloatingChatButton } from "@/components/ai-assistant/FloatingChatButton";

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const { user, loading, pendingApproval } = useAuth() as any;
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasUserRole, setHasUserRole] = useState(false);

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

  // Build nav items based on roles
  const navItems = [
    ...(isAdmin || hasUserRole ? [
      { path: "/", label: "Dashboard", icon: Home },
      { path: "/properties", label: "Properties", icon: Building2 },
      { path: "/visits", label: "Log Visit", icon: Calendar },
      { path: "/expenses", label: "Expenses", icon: DollarSign },
      { path: "/bookings", label: "Bookings", icon: CalendarDays },
      { path: "/mid-term-bookings", label: "Mid-term Bookings", icon: FileText },
    ] : []),
    ...(isAdmin ? [
      { path: "/owners", label: "Owners", icon: Users },
      { path: "/charges", label: "Charges", icon: Receipt },
      { path: "/admin", label: "Admin", icon: Shield }
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-3 max-md:py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 max-md:gap-2">
              <div className="w-10 h-10 max-md:w-8 max-md:h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-warm">
                <Building2 className="w-6 h-6 max-md:w-5 max-md:h-5 text-primary-foreground" />
              </div>
              <div>
                <img src="/property-central-logo.png" alt="Property Central" className="h-8 max-md:h-6" />
                <p className="text-xs max-md:text-[10px] text-muted-foreground">Property Tracker</p>
              </div>
            </div>
            <div className="flex items-center gap-4 max-md:gap-2">
              {user && (
                <>
                  <span className="text-sm text-muted-foreground hidden sm:inline">{user.email}</span>
                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Logout</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-card border-b border-border">
        <div className="container mx-auto px-4 max-md:px-2">
          <div className="flex gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-3 max-md:px-3 max-md:py-2.5 text-sm max-md:text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <Icon className="w-4 h-4 max-md:w-3.5 max-md:h-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8 max-md:px-3 max-md:py-4 max-md:text-base">{children}</main>
      <FloatingChatButton />
    </div>
  );
};

export default Layout;
