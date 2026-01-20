import { memo, useState } from 'react';
import { Menu, Phone, Bell, Bot, LogOut, MessageSquare, Mail, Video, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import peachIcon from '@/assets/peach-icon.png';
import { cn } from '@/lib/utils';

interface MobileHeaderBarProps {
  isAdmin: boolean;
  hasUserRole: boolean;
  user: any;
  unreadCount?: number;
  onOpenAiChat: () => void;
  onOpenDialer: () => void;
  onOpenNotifications: () => void;
  navigationContent: React.ReactNode;
}

export const MobileHeaderBar = memo(function MobileHeaderBar({
  isAdmin,
  hasUserRole,
  user,
  unreadCount = 0,
  onOpenAiChat,
  onOpenDialer,
  onOpenNotifications,
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
      {/* Apple-style clean header */}
      <div className="bg-background/95 backdrop-blur-xl border-b border-border/40">
        <div className="px-4 py-3">
          {/* Top Row - Logo, Quick Actions */}
          <div className="flex items-center justify-between">
            {/* Left: Menu + Logo */}
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
                      <div className="px-5 py-4 border-b border-border/50 flex items-center gap-3">
                        <img src={peachIcon} alt="Peach" className="w-11 h-11 rounded-2xl" />
                        <div>
                          <span className="font-semibold text-base block">Property Central</span>
                          <span className="text-xs text-muted-foreground">{user?.email}</span>
                        </div>
                      </div>
                      
                      {/* Navigation */}
                      <div className="flex-1 overflow-auto" onClick={() => setMenuOpen(false)}>
                        {navigationContent}
                      </div>
                      
                      {/* Footer with Team Hub + Sign Out */}
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
              
              {/* Peach Logo */}
              <button 
                onClick={() => navigate('/')}
                className="flex items-center active:scale-95 transition-transform touch-manipulation"
              >
                <img src={peachIcon} alt="Peach" className="w-10 h-10 rounded-2xl" />
              </button>
            </div>

            {/* Right: Minimal Action Bar */}
            {canAccessNav && (
              <div className="flex items-center gap-2">
                {/* Team Hub - Direct Access */}
                <button
                  onClick={() => navigate('/team-hub')}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 active:scale-95 transition-all touch-manipulation"
                >
                  <Users className="w-5 h-5 text-secondary-foreground" />
                </button>

                {/* Dialer */}
                <button
                  onClick={onOpenDialer}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-foreground text-background active:scale-95 transition-all touch-manipulation"
                >
                  <Phone className="w-5 h-5" />
                </button>

                {/* Notifications */}
                <button
                  onClick={onOpenNotifications}
                  className="relative w-10 h-10 flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 active:scale-95 transition-all touch-manipulation"
                >
                  <Bell className="w-5 h-5 text-secondary-foreground" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* AI Assistant */}
                <button
                  onClick={onOpenAiChat}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 active:scale-95 transition-all touch-manipulation"
                >
                  <Bot className="w-5 h-5 text-secondary-foreground" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Row - Clean Segmented Tabs */}
        {canAccessNav && (
          <div className="px-4 pb-3">
            <CommunicationTabs />
          </div>
        )}
      </div>
    </header>
  );
});

// Apple-style minimal tab bar
function CommunicationTabs() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname + location.search;
  
  const tabs = [
    { icon: MessageSquare, label: 'All', path: '/inbox' },
    { icon: MessageSquare, label: 'SMS', path: '/inbox?filter=sms' },
    { icon: Phone, label: 'Calls', path: '/inbox?filter=call' },
    { icon: Mail, label: 'Email', path: '/inbox?filter=email' },
    { icon: Video, label: 'Video', path: '/inbox?filter=video' },
  ];

  const isActive = (path: string) => {
    if (path === '/inbox') {
      return currentPath === '/inbox' || currentPath === '/inbox?';
    }
    return currentPath.includes(path.split('?')[1] || '');
  };

  return (
    <div className="flex items-center bg-secondary/50 rounded-xl p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = isActive(tab.path);
        
        return (
          <button
            key={tab.label}
            onClick={() => navigate(tab.path)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all touch-manipulation",
              active 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden xs:inline">{tab.label}</span>
          </button>
        );
      })}
      
      {/* Search */}
      <button
        onClick={() => navigate('/inbox?search=true')}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-all touch-manipulation"
      >
        <Search className="w-4 h-4" />
      </button>
    </div>
  );
}
