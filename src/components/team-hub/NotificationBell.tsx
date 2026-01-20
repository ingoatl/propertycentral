import { memo, useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useInAppNotifications } from '@/hooks/useTeamHub';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export const NotificationBell = memo(function NotificationBell() {
  const { data: notifications = [] } = useInAppNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const unreadCount = notifications.length;

  useEffect(() => {
    if (notifications.length > 0) {
      const latest = notifications[0];
      const createdAt = new Date(latest.created_at);
      if (Date.now() - createdAt.getTime() < 10000) {
        toast.info(latest.title, { description: latest.message || '' });
      }
    }
  }, [notifications]);

  const handleClick = async (n: (typeof notifications)[0]) => {
    await supabase.from('team_notifications').update({ is_read: true }).eq('id', n.id);
    navigate('/team-hub');
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b font-semibold">Notifications</div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">No new notifications</div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <button key={n.id} onClick={() => handleClick(n)} className="w-full text-left p-3 hover:bg-accent">
                  <p className="font-medium text-sm">{n.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
});
