import { useMemo, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  MapPin, 
  TrendingUp, 
  Sparkles, 
  Clock,
  Trophy,
  Music,
  Building2,
  PartyPopper,
  Sun,
  Users,
  Plane,
  Star
} from "lucide-react";
import { format, differenceInDays, parseISO, isAfter, addMonths } from "date-fns";

interface UpcomingEvent {
  id: string;
  event: string;
  date: string;
  parsedDate: Date;
  daysUntil: number;
  impact: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  gradientFrom: string;
  gradientTo: string;
}

interface UpcomingEventsTimelineProps {
  events: Array<{
    event: string;
    date: string;
    impact: string;
  }>;
  propertyAddress?: string;
  propertyCity?: string;
}

// Category styling without AI images - using icons and gradients
const eventCategoryStyles: Record<string, { 
  category: string; 
  icon: React.ComponentType<{ className?: string }>;
  gradientFrom: string;
  gradientTo: string;
}> = {
  // Sports
  "football": { category: "Sports", icon: Trophy, gradientFrom: "from-red-500", gradientTo: "to-orange-600" },
  "soccer": { category: "Sports", icon: Trophy, gradientFrom: "from-green-500", gradientTo: "to-emerald-600" },
  "super bowl": { category: "Sports", icon: Trophy, gradientFrom: "from-blue-600", gradientTo: "to-red-500" },
  "falcons": { category: "Sports", icon: Trophy, gradientFrom: "from-red-600", gradientTo: "to-black" },
  "hawks": { category: "Sports", icon: Trophy, gradientFrom: "from-red-500", gradientTo: "to-yellow-500" },
  "braves": { category: "Sports", icon: Trophy, gradientFrom: "from-blue-800", gradientTo: "to-red-600" },
  "united": { category: "Sports", icon: Trophy, gradientFrom: "from-red-600", gradientTo: "to-black" },
  "marathon": { category: "Sports", icon: Users, gradientFrom: "from-orange-500", gradientTo: "to-red-500" },
  "peachtree": { category: "Sports", icon: Users, gradientFrom: "from-pink-500", gradientTo: "to-orange-400" },
  "world cup": { category: "Sports", icon: Trophy, gradientFrom: "from-gold-400", gradientTo: "to-yellow-500" },
  
  // Concerts & Music
  "concert": { category: "Music", icon: Music, gradientFrom: "from-purple-600", gradientTo: "to-pink-500" },
  "taylor swift": { category: "Music", icon: Music, gradientFrom: "from-pink-400", gradientTo: "to-purple-600" },
  "beyonce": { category: "Music", icon: Music, gradientFrom: "from-yellow-400", gradientTo: "to-amber-600" },
  "music festival": { category: "Music", icon: Music, gradientFrom: "from-indigo-500", gradientTo: "to-purple-600" },
  "shaky knees": { category: "Music", icon: Music, gradientFrom: "from-teal-500", gradientTo: "to-green-500" },
  
  // Conferences & Business
  "convention": { category: "Business", icon: Building2, gradientFrom: "from-blue-600", gradientTo: "to-indigo-700" },
  "conference": { category: "Business", icon: Building2, gradientFrom: "from-slate-600", gradientTo: "to-blue-700" },
  "trade show": { category: "Business", icon: Building2, gradientFrom: "from-gray-600", gradientTo: "to-slate-700" },
  "summit": { category: "Business", icon: Building2, gradientFrom: "from-blue-500", gradientTo: "to-cyan-600" },
  
  // Festivals & Cultural
  "festival": { category: "Festival", icon: PartyPopper, gradientFrom: "from-amber-500", gradientTo: "to-orange-600" },
  "dragon con": { category: "Festival", icon: Star, gradientFrom: "from-purple-600", gradientTo: "to-indigo-800" },
  "pride": { category: "Festival", icon: PartyPopper, gradientFrom: "from-pink-500", gradientTo: "to-violet-500" },
  
  // Seasonal & Holidays
  "holiday": { category: "Seasonal", icon: Sun, gradientFrom: "from-red-500", gradientTo: "to-green-600" },
  "thanksgiving": { category: "Seasonal", icon: Sun, gradientFrom: "from-amber-600", gradientTo: "to-orange-700" },
  "christmas": { category: "Seasonal", icon: Star, gradientFrom: "from-red-500", gradientTo: "to-green-600" },
  "new year": { category: "Seasonal", icon: PartyPopper, gradientFrom: "from-yellow-400", gradientTo: "to-amber-500" },
  "spring break": { category: "Seasonal", icon: Plane, gradientFrom: "from-cyan-400", gradientTo: "to-blue-500" },
  "summer": { category: "Seasonal", icon: Sun, gradientFrom: "from-yellow-400", gradientTo: "to-orange-500" },
};

const getEventStyle = (eventName: string) => {
  const lowerName = eventName.toLowerCase();
  for (const [keyword, data] of Object.entries(eventCategoryStyles)) {
    if (lowerName.includes(keyword)) {
      return data;
    }
  }
  return { 
    category: "Event", 
    icon: Calendar,
    gradientFrom: "from-primary",
    gradientTo: "to-primary/70"
  };
};

const parseEventDate = (dateStr: string): Date => {
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Try parsing as ISO date
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    return parseISO(dateStr);
  }
  
  // Try parsing common formats like "March 15" or "March 15, 2026"
  const monthDayMatch = dateStr.match(/(\w+)\s+(\d{1,2})(?:,?\s*(\d{4}))?/);
  if (monthDayMatch) {
    const [, month, day, year] = monthDayMatch;
    const dateString = `${month} ${day}, ${year || currentYear}`;
    const parsed = new Date(dateString);
    if (!isNaN(parsed.getTime())) {
      if (parsed < now && !year) {
        parsed.setFullYear(currentYear + 1);
      }
      return parsed;
    }
  }
  
  // Try parsing just month like "March 2026"
  const monthYearMatch = dateStr.match(/(\w+)\s+(\d{4})/);
  if (monthYearMatch) {
    const [, month, year] = monthYearMatch;
    const parsed = new Date(`${month} 15, ${year}`);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  
  return addMonths(now, 1);
};

// Memoized event card component - clean icon-based design
const EventCard = memo(({ event, index }: { event: UpcomingEvent; index: number }) => {
  const IconComponent = event.icon;
  
  const urgencyBadge = event.daysUntil <= 7 
    ? { text: "This Week", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 animate-pulse" }
    : event.daysUntil <= 30 
      ? { text: `${event.daysUntil} days`, className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" }
      : { text: `${event.daysUntil} days`, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" };

  return (
    <div 
      className="group relative"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Connection line */}
      {index > 0 && (
        <div className="absolute left-6 -top-3 w-0.5 h-3 bg-gradient-to-b from-border to-primary/30" />
      )}
      
      <div className="flex gap-4 items-start">
        {/* Icon bubble */}
        <div className={`relative flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br ${event.gradientFrom} ${event.gradientTo} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
          <IconComponent className="h-5 w-5 text-white" />
          {/* Glow effect */}
          <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${event.gradientFrom} ${event.gradientTo} opacity-0 group-hover:opacity-40 blur-xl transition-opacity duration-300`} />
        </div>
        
        {/* Content card */}
        <div className="flex-1 min-w-0">
          <div className="bg-card border rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 group-hover:border-primary/30">
            {/* Header row */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground leading-tight truncate group-hover:text-primary transition-colors">
                  {event.event}
                </h4>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                  {format(event.parsedDate, "EEEE, MMM d, yyyy")}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Badge variant="secondary" className="text-xs whitespace-nowrap">
                  {event.category}
                </Badge>
                <Badge className={`text-xs whitespace-nowrap flex items-center gap-1 ${urgencyBadge.className}`}>
                  <Clock className="h-3 w-3" />
                  {urgencyBadge.text}
                </Badge>
              </div>
            </div>
            
            {/* Impact */}
            <div className="flex items-start gap-2 pt-2 border-t border-border/50">
              <TrendingUp className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-muted-foreground leading-relaxed">{event.impact}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

EventCard.displayName = "EventCard";

export const UpcomingEventsTimeline = memo(function UpcomingEventsTimeline({
  events,
  propertyCity,
}: UpcomingEventsTimelineProps) {
  // Process and sort events by date - no AI image generation
  const sortedEvents = useMemo(() => {
    const now = new Date();
    
    return events
      .map((event, idx) => {
        const parsedDate = parseEventDate(event.date);
        const daysUntil = Math.max(0, differenceInDays(parsedDate, now));
        const style = getEventStyle(event.event);
        
        return {
          id: `event-${idx}`,
          event: event.event,
          date: event.date,
          parsedDate,
          daysUntil,
          impact: event.impact,
          category: style.category,
          icon: style.icon,
          gradientFrom: style.gradientFrom,
          gradientTo: style.gradientTo,
        };
      })
      .filter(event => isAfter(event.parsedDate, now) || event.daysUntil === 0)
      .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime())
      .slice(0, 6);
  }, [events]);

  if (sortedEvents.length === 0) {
    return null;
  }

  return (
    <Card className="border-none shadow-lg overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-amber-50/80 to-orange-50/80 dark:from-amber-950/30 dark:to-orange-950/30">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                <Calendar className="h-4 w-4 text-amber-600" />
              </div>
              Upcoming Events Timeline
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Events driving demand near your property
            </p>
          </div>
          <div className="flex items-center gap-2">
            {propertyCity && (
              <Badge variant="outline" className="gap-1 bg-background/80">
                <MapPin className="h-3 w-3" />
                {propertyCity}
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {format(new Date(), "MMM yyyy")}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6 pb-4">
        <div className="space-y-4">
          {sortedEvents.map((event, idx) => (
            <EventCard key={event.id} event={event} index={idx} />
          ))}
        </div>
        
        {/* Revenue impact summary */}
        <div className="mt-6 p-4 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-xl border border-primary/10">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">How PeachHaus Capitalizes on Events</p>
              <p className="text-sm text-muted-foreground mt-1">
                We automatically adjust pricing using PriceLabs to maximize revenue during high-demand periods. 
                Event dates typically see 20-40% higher rates with maintained occupancy.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
