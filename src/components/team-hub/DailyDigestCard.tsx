import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, CheckSquare, Phone, MapPin, AlertTriangle, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

interface DailyDigestCardProps {
  channelId?: string;
}

export function DailyDigestCard({ channelId }: DailyDigestCardProps) {
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: digest, isLoading } = useQuery({
    queryKey: ['daily-digest', channelId, today],
    queryFn: async () => {
      // Try to get today's digest from database
      const { data: existingDigest } = await supabase
        .from('team_daily_digests')
        .select('*')
        .eq('digest_date', today)
        .maybeSingle();

      if (existingDigest) {
        return existingDigest;
      }

      // Generate live stats from visits and calls tables
      const [visitsResult, callsResult] = await Promise.all([
        supabase
          .from('visits')
          .select('*', { count: 'exact', head: true })
          .gte('date', today)
          .lte('date', today),
        supabase
          .from('discovery_calls')
          .select('*', { count: 'exact', head: true })
          .gte('scheduled_at', `${today}T00:00:00`)
          .lte('scheduled_at', `${today}T23:59:59`)
          .eq('status', 'scheduled'),
      ]);

      return {
        summary: null,
        tasks_due: 0,
        visits_scheduled: visitsResult.count || 0,
        calls_scheduled: callsResult.count || 0,
        highlights: [],
        urgent_items: [],
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const urgentItems = Array.isArray(digest?.urgent_items) ? digest.urgent_items : [];

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Daily Digest</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs">
            {format(new Date(), 'EEEE, MMM d')}
          </Badge>
        </div>
        {digest?.summary && (
          <CardDescription className="text-sm mt-1">
            {digest.summary}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center p-3 rounded-lg bg-background/50 border">
            <CheckSquare className="h-5 w-5 text-primary mb-1" />
            <span className="text-2xl font-bold">{digest?.tasks_due || 0}</span>
            <span className="text-xs text-muted-foreground">Tasks Due</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-background/50 border">
            <MapPin className="h-5 w-5 text-success mb-1" />
            <span className="text-2xl font-bold">{digest?.visits_scheduled || 0}</span>
            <span className="text-xs text-muted-foreground">Visits</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-background/50 border">
            <Phone className="h-5 w-5 text-accent mb-1" />
            <span className="text-2xl font-bold">{digest?.calls_scheduled || 0}</span>
            <span className="text-xs text-muted-foreground">Calls</span>
          </div>
        </div>

        {/* Urgent Items */}
        {urgentItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-warning">
              <AlertTriangle className="h-4 w-4" />
              Urgent Items
            </div>
            <div className="space-y-1">
              {urgentItems.slice(0, 3).map((item: any, index: number) => (
                <div 
                  key={index} 
                  className="text-sm p-2 rounded bg-warning/10 border border-warning/20"
                >
                  {item.title || item}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No items message */}
        {digest?.tasks_due === 0 && digest?.visits_scheduled === 0 && digest?.calls_scheduled === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            ✨ No scheduled items for today. Catch up on tasks or plan ahead!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
