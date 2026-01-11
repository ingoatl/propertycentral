import { useMemo, memo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Star,
  Ticket,
  Utensils,
  GraduationCap,
  Heart,
  Zap,
  DollarSign,
  ArrowUpRight,
  ChevronRight,
  Globe,
  Flame,
  Target,
  CalendarDays,
  Megaphone
} from "lucide-react";
import { format, differenceInDays, parseISO, isAfter, addMonths, addDays } from "date-fns";

interface ProcessedEvent {
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
  pricingMultiplier: number;
  attendees?: string;
  venue?: string;
  isLocal: boolean;
  isMetro: boolean;
}

interface EnhancedEventsTimelineProps {
  events: Array<{
    event: string;
    date: string;
    impact: string;
  }>;
  propertyAddress?: string;
  propertyCity?: string;
}

// Comprehensive event category styles with rich iconography
const eventCategoryStyles: Record<string, { 
  category: string; 
  icon: React.ComponentType<{ className?: string }>;
  gradientFrom: string;
  gradientTo: string;
  pricingMultiplier: number;
  attendees?: string;
}> = {
  // Major Sports Events
  "super bowl": { category: "Major Sports", icon: Trophy, gradientFrom: "from-red-600", gradientTo: "to-blue-700", pricingMultiplier: 4.0, attendees: "100,000+" },
  "world cup": { category: "Major Sports", icon: Globe, gradientFrom: "from-green-500", gradientTo: "to-yellow-500", pricingMultiplier: 4.5, attendees: "150,000+" },
  "college football playoff": { category: "Major Sports", icon: Trophy, gradientFrom: "from-orange-600", gradientTo: "to-red-700", pricingMultiplier: 3.5, attendees: "80,000+" },
  "sec championship": { category: "Sports", icon: Trophy, gradientFrom: "from-amber-500", gradientTo: "to-red-600", pricingMultiplier: 2.5, attendees: "75,000+" },
  "peach bowl": { category: "Sports", icon: Trophy, gradientFrom: "from-orange-500", gradientTo: "to-pink-500", pricingMultiplier: 2.0, attendees: "70,000+" },
  "chick-fil-a": { category: "Sports", icon: Trophy, gradientFrom: "from-red-500", gradientTo: "to-orange-600", pricingMultiplier: 2.0, attendees: "70,000+" },
  
  // Atlanta Teams
  "falcons": { category: "NFL", icon: Trophy, gradientFrom: "from-red-600", gradientTo: "to-black", pricingMultiplier: 1.5, attendees: "71,000" },
  "hawks": { category: "NBA", icon: Trophy, gradientFrom: "from-red-500", gradientTo: "to-yellow-500", pricingMultiplier: 1.3, attendees: "17,000" },
  "braves": { category: "MLB", icon: Trophy, gradientFrom: "from-blue-800", gradientTo: "to-red-600", pricingMultiplier: 1.4, attendees: "42,000" },
  "united": { category: "MLS", icon: Trophy, gradientFrom: "from-red-600", gradientTo: "to-black", pricingMultiplier: 1.5, attendees: "45,000" },
  "atlanta dream": { category: "WNBA", icon: Trophy, gradientFrom: "from-pink-500", gradientTo: "to-red-500", pricingMultiplier: 1.2, attendees: "10,000" },
  
  // Running Events
  "peachtree": { category: "Running", icon: Users, gradientFrom: "from-pink-500", gradientTo: "to-orange-400", pricingMultiplier: 1.8, attendees: "60,000" },
  "marathon": { category: "Running", icon: Users, gradientFrom: "from-orange-500", gradientTo: "to-red-500", pricingMultiplier: 1.5, attendees: "20,000+" },
  
  // Major Concerts & Music Festivals
  "taylor swift": { category: "Concert", icon: Music, gradientFrom: "from-pink-400", gradientTo: "to-purple-600", pricingMultiplier: 3.0, attendees: "70,000" },
  "beyonce": { category: "Concert", icon: Music, gradientFrom: "from-yellow-400", gradientTo: "to-amber-600", pricingMultiplier: 3.0, attendees: "70,000" },
  "coldplay": { category: "Concert", icon: Music, gradientFrom: "from-blue-400", gradientTo: "to-purple-500", pricingMultiplier: 2.5, attendees: "70,000" },
  "music midtown": { category: "Festival", icon: Music, gradientFrom: "from-purple-600", gradientTo: "to-pink-500", pricingMultiplier: 2.2, attendees: "50,000" },
  "shaky knees": { category: "Festival", icon: Music, gradientFrom: "from-teal-500", gradientTo: "to-green-500", pricingMultiplier: 2.0, attendees: "40,000" },
  "one musicfest": { category: "Festival", icon: Music, gradientFrom: "from-orange-500", gradientTo: "to-red-500", pricingMultiplier: 1.8, attendees: "30,000" },
  "sweetwater": { category: "Festival", icon: Music, gradientFrom: "from-blue-500", gradientTo: "to-green-500", pricingMultiplier: 1.5, attendees: "15,000" },
  "concert": { category: "Concert", icon: Music, gradientFrom: "from-purple-600", gradientTo: "to-pink-500", pricingMultiplier: 1.8 },
  
  // Conventions & Conferences
  "dragon con": { category: "Convention", icon: Star, gradientFrom: "from-purple-600", gradientTo: "to-indigo-800", pricingMultiplier: 3.0, attendees: "85,000" },
  "momocon": { category: "Convention", icon: Star, gradientFrom: "from-pink-500", gradientTo: "to-blue-500", pricingMultiplier: 1.8, attendees: "35,000" },
  "anime weekend": { category: "Convention", icon: Star, gradientFrom: "from-pink-400", gradientTo: "to-purple-600", pricingMultiplier: 1.6, attendees: "25,000" },
  "aws": { category: "Tech", icon: Building2, gradientFrom: "from-orange-500", gradientTo: "to-yellow-500", pricingMultiplier: 2.0, attendees: "50,000" },
  "connect": { category: "Tech", icon: Building2, gradientFrom: "from-blue-600", gradientTo: "to-cyan-500", pricingMultiplier: 1.8, attendees: "30,000" },
  "convention": { category: "Business", icon: Building2, gradientFrom: "from-blue-600", gradientTo: "to-indigo-700", pricingMultiplier: 1.5 },
  "conference": { category: "Business", icon: Building2, gradientFrom: "from-slate-600", gradientTo: "to-blue-700", pricingMultiplier: 1.5 },
  "trade show": { category: "Business", icon: Building2, gradientFrom: "from-gray-600", gradientTo: "to-slate-700", pricingMultiplier: 1.4 },
  "summit": { category: "Business", icon: Building2, gradientFrom: "from-blue-500", gradientTo: "to-cyan-600", pricingMultiplier: 1.5 },
  
  // Cultural & Community Events
  "pride": { category: "Festival", icon: Heart, gradientFrom: "from-pink-500", gradientTo: "to-violet-500", pricingMultiplier: 1.8, attendees: "300,000" },
  "dogwood festival": { category: "Festival", icon: Sun, gradientFrom: "from-pink-400", gradientTo: "to-green-400", pricingMultiplier: 1.4, attendees: "250,000" },
  "taste of atlanta": { category: "Food", icon: Utensils, gradientFrom: "from-orange-500", gradientTo: "to-red-500", pricingMultiplier: 1.4, attendees: "100,000" },
  "festival": { category: "Festival", icon: PartyPopper, gradientFrom: "from-amber-500", gradientTo: "to-orange-600", pricingMultiplier: 1.5 },
  
  // Seasonal & Holidays
  "thanksgiving": { category: "Holiday", icon: Sun, gradientFrom: "from-amber-600", gradientTo: "to-orange-700", pricingMultiplier: 1.6 },
  "christmas": { category: "Holiday", icon: Star, gradientFrom: "from-red-500", gradientTo: "to-green-600", pricingMultiplier: 1.8 },
  "new year": { category: "Holiday", icon: PartyPopper, gradientFrom: "from-yellow-400", gradientTo: "to-amber-500", pricingMultiplier: 2.0 },
  "spring break": { category: "Seasonal", icon: Plane, gradientFrom: "from-cyan-400", gradientTo: "to-blue-500", pricingMultiplier: 1.5 },
  "summer": { category: "Seasonal", icon: Sun, gradientFrom: "from-yellow-400", gradientTo: "to-orange-500", pricingMultiplier: 1.3 },
  "labor day": { category: "Holiday", icon: Sun, gradientFrom: "from-blue-500", gradientTo: "to-red-500", pricingMultiplier: 1.8 },
  "memorial day": { category: "Holiday", icon: Sun, gradientFrom: "from-red-500", gradientTo: "to-blue-600", pricingMultiplier: 1.5 },
  "july 4": { category: "Holiday", icon: PartyPopper, gradientFrom: "from-red-500", gradientTo: "to-blue-600", pricingMultiplier: 1.7 },
  "fourth of july": { category: "Holiday", icon: PartyPopper, gradientFrom: "from-red-500", gradientTo: "to-blue-600", pricingMultiplier: 1.7 },
  "independence day": { category: "Holiday", icon: PartyPopper, gradientFrom: "from-red-500", gradientTo: "to-blue-600", pricingMultiplier: 1.7 },
  "holiday": { category: "Holiday", icon: Sun, gradientFrom: "from-red-500", gradientTo: "to-green-600", pricingMultiplier: 1.5 },
  
  // Education & Graduation
  "graduation": { category: "Education", icon: GraduationCap, gradientFrom: "from-blue-600", gradientTo: "to-purple-600", pricingMultiplier: 1.6, attendees: "varies" },
  "georgia tech": { category: "Education", icon: GraduationCap, gradientFrom: "from-yellow-500", gradientTo: "to-blue-600", pricingMultiplier: 1.4 },
  "emory": { category: "Education", icon: GraduationCap, gradientFrom: "from-blue-600", gradientTo: "to-yellow-500", pricingMultiplier: 1.4 },
  "georgia state": { category: "Education", icon: GraduationCap, gradientFrom: "from-blue-500", gradientTo: "to-red-500", pricingMultiplier: 1.3 },
};

// Metro Atlanta events database
const metroAtlantaEvents: Array<{
  event: string;
  date: string;
  impact: string;
  venue?: string;
  isLocal?: boolean;
}> = [
  // January-February 2026
  { event: "Atlanta Hawks vs Lakers", date: "2026-01-15", impact: "NBA marquee matchup drives downtown hotel demand", venue: "State Farm Arena" },
  { event: "Martin Luther King Jr. Day Events", date: "2026-01-19", impact: "National visitors for MLK historic site activities", venue: "Multiple locations" },
  { event: "Atlanta Restaurant Week", date: "2026-01-25", impact: "Foodies travel for exclusive dining experiences", venue: "Citywide" },
  { event: "Super Bowl LX Watch Parties", date: "2026-02-08", impact: "Major sports bars and venues packed citywide", venue: "Multiple venues" },
  
  // March-April 2026
  { event: "St. Patrick's Day Parade", date: "2026-03-14", impact: "Midtown celebration draws regional crowds", venue: "Midtown Atlanta" },
  { event: "Atlanta Dogwood Festival", date: "2026-04-10", impact: "250,000+ visitors over 3-day festival weekend", venue: "Piedmont Park" },
  { event: "Shaky Knees Music Festival", date: "2026-05-01", impact: "40,000+ music fans descend on Central Park", venue: "Central Park" },
  
  // May-June 2026
  { event: "Georgia Tech Graduation", date: "2026-05-09", impact: "Thousands of families book accommodations", venue: "Bobby Dodd Stadium" },
  { event: "Emory University Graduation", date: "2026-05-11", impact: "Major academic event fills Druid Hills area", venue: "Emory Campus" },
  { event: "FIFA World Cup - Atlanta Matches", date: "2026-06-15", impact: "Historic 300-400% rate opportunity", venue: "Mercedes-Benz Stadium" },
  { event: "Music Midtown Festival", date: "2026-09-19", impact: "50,000+ attendees create massive demand surge", venue: "Piedmont Park" },
  
  // July 2026
  { event: "Peachtree Road Race", date: "2026-07-04", impact: "60,000 runners + spectators flood Buckhead to Midtown", venue: "Peachtree Street" },
  { event: "July 4th Fireworks - Lenox Square", date: "2026-07-04", impact: "Massive Buckhead celebration crowds", venue: "Lenox Square" },
  { event: "July 4th Fireworks - Centennial Park", date: "2026-07-04", impact: "Downtown celebration draws 100,000+", venue: "Centennial Olympic Park" },
  
  // August-September 2026
  { event: "Dragon Con", date: "2026-09-04", impact: "85,000+ fans overwhelm downtown hotels", venue: "Downtown Hotels" },
  { event: "ONE Musicfest", date: "2026-09-12", impact: "30,000+ attendees for urban music festival", venue: "Piedmont Park" },
  { event: "Atlanta Pride Festival", date: "2026-10-10", impact: "300,000+ celebrate in Piedmont Park area", venue: "Piedmont Park" },
  
  // October-November 2026
  { event: "Atlanta Braves Postseason", date: "2026-10-05", impact: "If playoffs, expect 42,000+ per home game surge", venue: "Truist Park" },
  { event: "Taste of Atlanta", date: "2026-10-24", impact: "100,000+ foodies over 3-day event", venue: "Historic Fourth Ward" },
  { event: "Georgia vs Georgia Tech Rivalry", date: "2026-11-28", impact: "Clean Old-Fashioned Hate brings 90,000+ to stadium", venue: "Mercedes-Benz Stadium" },
  
  // December 2026
  { event: "SEC Championship Game", date: "2026-12-05", impact: "75,000+ fans fill downtown Atlanta", venue: "Mercedes-Benz Stadium" },
  { event: "Chick-fil-A Peach Bowl", date: "2026-12-30", impact: "Major bowl game draws 70,000+ visitors", venue: "Mercedes-Benz Stadium" },
  { event: "Atlanta New Year's Eve - Peach Drop", date: "2026-12-31", impact: "Underground Atlanta celebration draws regional crowds", venue: "Underground Atlanta" },
];

const getEventStyle = (eventName: string): { 
  category: string; 
  icon: React.ComponentType<{ className?: string }>;
  gradientFrom: string;
  gradientTo: string;
  pricingMultiplier: number;
  attendees?: string;
} => {
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
    gradientTo: "to-primary/70",
    pricingMultiplier: 1.2
  };
};

const parseEventDate = (dateStr: string): Date => {
  const now = new Date();
  const currentYear = now.getFullYear();
  
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    return parseISO(dateStr);
  }
  
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

// Professional Event Card with pricing impact
const EventCard = memo(({ event, index }: { event: ProcessedEvent; index: number }) => {
  const IconComponent = event.icon;
  
  const urgencyBadge = event.daysUntil <= 7 
    ? { text: "This Week!", className: "bg-red-500 text-white animate-pulse border-0" }
    : event.daysUntil <= 14 
      ? { text: "2 Weeks", className: "bg-orange-500 text-white border-0" }
      : event.daysUntil <= 30 
        ? { text: `${event.daysUntil} days`, className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" }
        : { text: `${event.daysUntil} days`, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" };

  const pricingBadgeClass = event.pricingMultiplier >= 3 
    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white" 
    : event.pricingMultiplier >= 2 
      ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white"
      : "bg-gradient-to-r from-blue-500 to-indigo-500 text-white";

  return (
    <div 
      className="group relative animate-fade-in"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex gap-4 items-start">
        {/* Animated Icon bubble */}
        <div className="relative flex-shrink-0">
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${event.gradientFrom} ${event.gradientTo} flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300`}>
            <IconComponent className="h-6 w-6 text-white drop-shadow-sm" />
          </div>
          {/* Glow effect on hover */}
          <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${event.gradientFrom} ${event.gradientTo} opacity-0 group-hover:opacity-30 blur-xl transition-opacity duration-300 -z-10`} />
        </div>
        
        {/* Content card */}
        <div className="flex-1 min-w-0">
          <div className="bg-card border rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all duration-300 group-hover:border-primary/30 relative overflow-hidden">
            {/* Subtle gradient overlay */}
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${event.gradientFrom} ${event.gradientTo} opacity-5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2`} />
            
            {/* Header row */}
            <div className="flex items-start justify-between gap-3 mb-3 relative">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h4 className="font-bold text-foreground leading-tight group-hover:text-primary transition-colors text-base">
                    {event.event}
                  </h4>
                  {event.isLocal && (
                    <Badge variant="outline" className="text-[10px] bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300">
                      <MapPin className="h-2.5 w-2.5 mr-0.5" />
                      Local
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {format(event.parsedDate, "EEE, MMM d, yyyy")}
                  </span>
                  {event.venue && (
                    <span className="flex items-center gap-1 text-xs">
                      <MapPin className="h-3 w-3" />
                      {event.venue}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-2 shrink-0">
                <Badge className={`text-xs font-semibold ${urgencyBadge.className}`}>
                  <Clock className="h-3 w-3 mr-1" />
                  {urgencyBadge.text}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {event.category}
                </Badge>
              </div>
            </div>
            
            {/* Pricing Impact Section */}
            <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl border border-primary/10 mb-3">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${pricingBadgeClass} text-sm font-bold shadow-sm`}>
                <DollarSign className="h-3.5 w-3.5" />
                +{Math.round((event.pricingMultiplier - 1) * 100)}%
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-foreground">PriceLabs Auto-Adjustment</p>
                <p className="text-xs text-muted-foreground">
                  Rates automatically increase {Math.round((event.pricingMultiplier - 1) * 100)}% during this event
                </p>
              </div>
              {event.attendees && (
                <div className="text-right">
                  <p className="text-xs font-semibold text-primary">{event.attendees}</p>
                  <p className="text-[10px] text-muted-foreground">expected</p>
                </div>
              )}
            </div>
            
            {/* Impact description */}
            <div className="flex items-start gap-2">
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

export const EnhancedEventsTimeline = memo(function EnhancedEventsTimeline({
  events,
  propertyAddress,
  propertyCity,
}: EnhancedEventsTimelineProps) {
  const [activeTab, setActiveTab] = useState<"all" | "local" | "metro">("all");
  
  // Combine provided events with metro Atlanta events
  const allEvents = useMemo(() => {
    const now = new Date();
    const combinedEvents: ProcessedEvent[] = [];
    
    // Process provided events (from AI analysis)
    events.forEach((event, idx) => {
      const parsedDate = parseEventDate(event.date);
      const daysUntil = Math.max(0, differenceInDays(parsedDate, now));
      const style = getEventStyle(event.event);
      
      combinedEvents.push({
        id: `provided-${idx}`,
        event: event.event,
        date: event.date,
        parsedDate,
        daysUntil,
        impact: event.impact,
        category: style.category,
        icon: style.icon,
        gradientFrom: style.gradientFrom,
        gradientTo: style.gradientTo,
        pricingMultiplier: style.pricingMultiplier,
        attendees: style.attendees,
        isLocal: false,
        isMetro: true,
      });
    });
    
    // Add metro Atlanta events
    metroAtlantaEvents.forEach((event, idx) => {
      const parsedDate = parseEventDate(event.date);
      const daysUntil = Math.max(0, differenceInDays(parsedDate, now));
      const style = getEventStyle(event.event);
      
      // Check if this event already exists (avoid duplicates)
      const exists = combinedEvents.some(e => 
        e.event.toLowerCase().includes(event.event.toLowerCase().split(' ').slice(0, 2).join(' '))
      );
      
      if (!exists) {
        combinedEvents.push({
          id: `metro-${idx}`,
          event: event.event,
          date: event.date,
          parsedDate,
          daysUntil,
          impact: event.impact,
          category: style.category,
          icon: style.icon,
          gradientFrom: style.gradientFrom,
          gradientTo: style.gradientTo,
          pricingMultiplier: style.pricingMultiplier,
          attendees: style.attendees,
          venue: event.venue,
          isLocal: event.isLocal || false,
          isMetro: true,
        });
      }
    });
    
    return combinedEvents
      .filter(event => isAfter(event.parsedDate, now) || event.daysUntil === 0)
      .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
  }, [events]);
  
  const filteredEvents = useMemo(() => {
    let filtered = allEvents;
    if (activeTab === "local") {
      filtered = allEvents.filter(e => e.isLocal);
    } else if (activeTab === "metro") {
      filtered = allEvents.filter(e => e.isMetro);
    }
    return filtered.slice(0, 8);
  }, [allEvents, activeTab]);

  const upcomingHighImpact = useMemo(() => {
    return allEvents
      .filter(e => e.pricingMultiplier >= 2.0)
      .slice(0, 3);
  }, [allEvents]);

  if (allEvents.length === 0) {
    return null;
  }

  return (
    <Card className="border-none shadow-xl overflow-hidden">
      {/* Premium Header */}
      <CardHeader className="pb-4 bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-rose-950/20 border-b">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
              <Flame className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                Revenue-Driving Events
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Events that boost your property's earning potential
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {propertyCity && (
              <Badge variant="outline" className="gap-1.5 bg-background/80 font-medium">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {propertyCity}
              </Badge>
            )}
            <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0">
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              {allEvents.length} Upcoming
            </Badge>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mt-4">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="all" className="gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              All Events
            </TabsTrigger>
            <TabsTrigger value="metro" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Metro Atlanta
            </TabsTrigger>
            <TabsTrigger value="local" className="gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Local
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      
      <CardContent className="pt-6 pb-6">
        {/* High Impact Events Highlight */}
        {upcomingHighImpact.length > 0 && activeTab === "all" && (
          <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 rounded-xl border border-amber-200/50 dark:border-amber-700/30">
            <div className="flex items-center gap-2 mb-3">
              <Megaphone className="h-4 w-4 text-amber-600" />
              <h4 className="font-semibold text-amber-800 dark:text-amber-200">
                Highest Revenue Opportunities
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {upcomingHighImpact.map((event, idx) => (
                <div key={event.id} className="flex items-center gap-3 p-3 bg-white/80 dark:bg-background/50 rounded-lg">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${event.gradientFrom} ${event.gradientTo} flex items-center justify-center shadow`}>
                    <event.icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{event.event}</p>
                    <p className="text-xs text-muted-foreground">{format(event.parsedDate, "MMM d")}</p>
                  </div>
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-xs">
                    +{Math.round((event.pricingMultiplier - 1) * 100)}%
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Events Timeline */}
        <div className="space-y-4">
          {filteredEvents.map((event, idx) => (
            <EventCard key={event.id} event={event} index={idx} />
          ))}
        </div>
        
        {filteredEvents.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>No events found in this category</p>
          </div>
        )}
        
        {/* PriceLabs Integration Info */}
        <div className="mt-8 p-5 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-2xl border border-primary/10">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
              <Target className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-base mb-1">Dynamic Pricing Powered by PriceLabs</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                PeachHaus uses AI-powered dynamic pricing through PriceLabs to automatically capture these opportunities. 
                Your rates adjust in real-time based on demand, events, and market conditions—typically achieving 
                <span className="text-primary font-semibold"> 15-40% higher revenue</span> compared to static pricing.
              </p>
              <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  Real-time adjustments
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  Market-aware pricing
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-blue-500" />
                  Event-based surge
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
