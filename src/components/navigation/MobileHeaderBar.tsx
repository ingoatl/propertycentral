import { memo, useState } from 'react';
import { Menu, Phone, Bell, Bot, LogOut, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
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
      {/* Apple-style glassmorphic header */}
      <div className="bg-background/70 backdrop-blur-xl border-b border-border/50 shadow-sm">
        <div className="px-3 py-2">
          {/* Top Row - Logo, Quick Actions */}
          <div className="flex items-center justify-between gap-2">
            {/* Left: Menu + Logo */}
            <div className="flex items-center gap-2">
              {canAccessNav && (
                <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                  <SheetTrigger asChild>
                    <button className="p-2.5 rounded-2xl bg-muted/50 hover:bg-muted active:scale-95 transition-all touch-manipulation">
                      <Menu className="w-5 h-5 text-foreground" />
                    </button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[280px] p-0">
                    <div className="h-full flex flex-col">
                      <div className="p-4 border-b flex items-center gap-3">
                        <img src={peachIcon} alt="Peach" className="w-10 h-10 rounded-xl" />
                        <span className="font-semibold text-lg">Property Central</span>
                      </div>
                      <div className="flex-1 overflow-auto" onClick={() => setMenuOpen(false)}>
                        {navigationContent}
                      </div>
                      {user && (
                        <div className="p-4 border-t">
                          <p className="text-sm text-muted-foreground truncate mb-2">{user.email}</p>
                          <Button variant="outline" size="sm" className="w-full gap-2" onClick={handleLogout}>
                            <LogOut className="w-4 h-4" />
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
                className="flex items-center gap-2 p-1 rounded-xl active:scale-95 transition-transform touch-manipulation"
              >
                <img src={peachIcon} alt="Peach" className="w-9 h-9 rounded-xl shadow-md" />
              </button>
            </div>

            {/* Right: Quick Action Pills */}
            {canAccessNav && (
              <div className="flex items-center gap-1.5">
                {/* Dialer Button - Primary Action */}
                <button
                  onClick={onOpenDialer}
                  className={cn(
                    "relative flex items-center justify-center",
                    "w-11 h-11 rounded-2xl",
                    "bg-primary text-primary-foreground",
                    "shadow-lg shadow-primary/25",
                    "active:scale-95 transition-all touch-manipulation"
                  )}
                >
                  <Phone className="w-5 h-5" />
                </button>

                {/* Notification Bell */}
                <button
                  onClick={onOpenNotifications}
                  className={cn(
                    "relative flex items-center justify-center",
                    "w-11 h-11 rounded-2xl",
                    "bg-muted/80 hover:bg-muted",
                    "active:scale-95 transition-all touch-manipulation"
                  )}
                >
                  <Bell className="w-5 h-5 text-foreground" />
                  {unreadCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1.5 text-[10px] font-bold rounded-full"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Badge>
                  )}
                </button>

                {/* AI Assistant */}
                <button
                  onClick={onOpenAiChat}
                  className={cn(
                    "relative flex items-center justify-center",
                    "w-11 h-11 rounded-2xl",
                    "bg-emerald-100 dark:bg-emerald-900/30",
                    "border border-emerald-200 dark:border-emerald-800",
                    "active:scale-95 transition-all touch-manipulation"
                  )}
                >
                  <Bot className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </button>

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className={cn(
                    "flex items-center justify-center",
                    "w-11 h-11 rounded-2xl",
                    "bg-muted/50 hover:bg-muted",
                    "active:scale-95 transition-all touch-manipulation"
                  )}
                >
                  <LogOut className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Row - Segmented Control for Communication Tabs */}
        {canAccessNav && (
          <div className="px-3 pb-3">
            <CommunicationSegmentedControl />
          </div>
        )}
      </div>
    </header>
  );
});

// Apple-style Segmented Control for communication types
function CommunicationSegmentedControl() {
  const navigate = useNavigate();
  const segments = [
    { icon: '💬', label: 'Inbox', path: '/inbox' },
    { icon: '📱', label: 'SMS', path: '/inbox?filter=sms' },
    { icon: '📞', label: 'Calls', path: '/inbox?filter=call' },
    { icon: '✉️', label: 'Email', path: '/inbox?filter=email' },
    { icon: '🎥', label: 'Video', path: '/inbox?filter=video' },
  ];

  return (
    <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-2xl">
      {segments.map((seg, idx) => (
        <button
          key={seg.label}
          onClick={() => navigate(seg.path)}
          className={cn(
            "flex-1 flex items-center justify-center gap-1",
            "py-2.5 px-1.5 rounded-xl",
            "text-xs font-medium",
            "active:scale-95 transition-all touch-manipulation",
            idx === 0 
              ? "bg-background shadow-sm text-foreground" 
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
        >
          <span className="text-base">{seg.icon}</span>
        </button>
      ))}
      
      {/* Search */}
      <button
        onClick={() => navigate('/inbox?search=true')}
        className={cn(
          "flex items-center justify-center",
          "w-10 h-10 rounded-xl",
          "text-muted-foreground hover:text-foreground hover:bg-background/50",
          "active:scale-95 transition-all touch-manipulation"
        )}
      >
        <Search className="w-4 h-4" />
      </button>
    </div>
  );
}
