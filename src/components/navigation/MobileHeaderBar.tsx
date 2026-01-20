import { memo, useState } from 'react';
import { Menu, Bot, LogOut, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { QuickCommunicationButton } from '@/components/communications/QuickCommunicationButton';
import { NotificationBell } from '@/components/team-hub/NotificationBell';
import { MobileNavigation } from './MobileNavigation';

interface MobileHeaderBarProps {
  isAdmin: boolean;
  hasUserRole: boolean;
  user: any;
  onOpenAiChat: () => void;
  navigationContent: React.ReactNode;
}

export const MobileHeaderBar = memo(function MobileHeaderBar({
  isAdmin,
  hasUserRole,
  user,
  onOpenAiChat,
  navigationContent,
}: MobileHeaderBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const canAccessNav = isAdmin || hasUserRole;

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logged out successfully");
    } catch (error) {
      toast.error("Failed to log out");
    }
  };

  return (
    <header className="md:hidden sticky top-0 z-50 safe-area-inset">
      <div className="bg-background/95 backdrop-blur-xl border-b border-border/40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Menu + Title */}
            <div className="flex items-center gap-3">
              {canAccessNav && (
                <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                  <SheetTrigger asChild>
                    <button className="w-10 h-10 flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 active:scale-95 transition-all touch-manipulation">
                      <Menu className="w-5 h-5 text-secondary-foreground" />
                    </button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[300px] p-0 border-r-0">
                    <div className="h-full flex flex-col bg-background">
                      {/* Header */}
                      <div className="px-5 py-4 border-b border-border/50">
                        <span className="font-semibold text-base block">Property Central</span>
                        <span className="text-xs text-muted-foreground">{user?.email}</span>
                      </div>
                      
                      {/* Navigation */}
                      <div className="flex-1 overflow-auto">
                        <MobileNavigation isAdmin={isAdmin} onNavigate={() => setMenuOpen(false)} />
                      </div>
                      
                      {/* Footer */}
                      {user && (
                        <div className="p-4 border-t border-border/50 space-y-2">
                          <Button 
                            variant="secondary" 
                            className="w-full justify-start gap-3 h-11"
                            onClick={() => { navigate('/team-hub'); setMenuOpen(false); }}
                          >
                            <Users className="w-5 h-5" />
                            Team Hub
                          </Button>
                          <Button 
                            variant="ghost" 
                            className="w-full justify-start gap-3 h-11 text-muted-foreground"
                            onClick={handleLogout}
                          >
                            <LogOut className="w-5 h-5" />
                            Sign Out
                          </Button>
                        </div>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              )}
              
              <span className="font-semibold text-base">Property Central</span>
            </div>

            {/* Right: Working Action Buttons */}
            {canAccessNav && (
              <div className="flex items-center gap-1">
                {/* Team Hub - Navigate to /team-hub */}
                <button
                  onClick={() => navigate('/team-hub')}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 active:scale-95 transition-all touch-manipulation"
                  aria-label="Team Hub"
                >
                  <Users className="w-5 h-5 text-secondary-foreground" />
                </button>

                {/* Dialer - Uses existing QuickCommunicationButton */}
                <QuickCommunicationButton />

                {/* Notifications - Uses existing NotificationBell */}
                <NotificationBell />

                {/* AI Assistant - Opens ChatDialog */}
                <button
                  onClick={onOpenAiChat}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 active:scale-95 transition-all touch-manipulation"
                  aria-label="AI Assistant"
                >
                  <Bot className="w-5 h-5 text-secondary-foreground" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
});
