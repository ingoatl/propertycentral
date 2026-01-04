import { useState, useEffect, useMemo, memo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, TrendingUp, Sparkles, Clock } from "lucide-react";
import { format, differenceInDays, parseISO, isAfter, addMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface UpcomingEvent {
  id: string;
  event: string;
  date: string;
  parsedDate: Date;
  daysUntil: number;
  impact: string;
  category: string;
  imageUrl?: string;
  isGeneratingImage?: boolean;
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

// Mapping of event keywords to categories and stock images as fallbacks
const eventCategoryMap: Record<string, { category: string; fallbackImage: string; aiPrompt: string }> = {
  // Sports
  "football": { category: "Sports", fallbackImage: "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=400&h=250&fit=crop", aiPrompt: "American football stadium packed with fans, evening lights, vibrant atmosphere" },
  "soccer": { category: "Sports", fallbackImage: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&h=250&fit=crop", aiPrompt: "Soccer match at a stadium, enthusiastic crowd, green field" },
  "super bowl": { category: "Sports", fallbackImage: "https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=400&h=250&fit=crop", aiPrompt: "Super Bowl stadium with massive crowd, confetti, celebration atmosphere" },
  "falcons": { category: "Sports", fallbackImage: "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=400&h=250&fit=crop", aiPrompt: "Atlanta Falcons football game at Mercedes-Benz Stadium" },
  "hawks": { category: "Sports", fallbackImage: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&h=250&fit=crop", aiPrompt: "Basketball game at State Farm Arena, Atlanta Hawks" },
  "braves": { category: "Sports", fallbackImage: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=400&h=250&fit=crop", aiPrompt: "Baseball game at Truist Park, Atlanta Braves" },
  "united": { category: "Sports", fallbackImage: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&h=250&fit=crop", aiPrompt: "Atlanta United soccer match at Mercedes-Benz Stadium" },
  "marathon": { category: "Sports", fallbackImage: "https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?w=400&h=250&fit=crop", aiPrompt: "City marathon with thousands of runners on street" },
  "peachtree": { category: "Sports", fallbackImage: "https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?w=400&h=250&fit=crop", aiPrompt: "AJC Peachtree Road Race in Atlanta, runners on Peachtree Street" },
  "world cup": { category: "Sports", fallbackImage: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&h=250&fit=crop", aiPrompt: "FIFA World Cup match at a major stadium, international flags" },
  
  // Concerts & Music
  "concert": { category: "Music", fallbackImage: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=250&fit=crop", aiPrompt: "Major concert at an arena, stage lights, crowd with phones" },
  "taylor swift": { category: "Music", fallbackImage: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=250&fit=crop", aiPrompt: "Pop concert at stadium, colorful stage lights, massive crowd" },
  "beyonce": { category: "Music", fallbackImage: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=250&fit=crop", aiPrompt: "Pop concert at stadium, dramatic lighting, enthusiastic fans" },
  "music festival": { category: "Music", fallbackImage: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&h=250&fit=crop", aiPrompt: "Outdoor music festival with multiple stages, colorful crowd" },
  "shaky knees": { category: "Music", fallbackImage: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&h=250&fit=crop", aiPrompt: "Shaky Knees Music Festival in Atlanta, outdoor stage" },
  
  // Conferences & Business
  "convention": { category: "Business", fallbackImage: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=250&fit=crop", aiPrompt: "Large convention center with attendees, exhibition booths" },
  "conference": { category: "Business", fallbackImage: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=250&fit=crop", aiPrompt: "Professional conference with keynote speaker, audience" },
  "trade show": { category: "Business", fallbackImage: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=250&fit=crop", aiPrompt: "Trade show exhibition floor with booths and visitors" },
  "summit": { category: "Business", fallbackImage: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=250&fit=crop", aiPrompt: "Business summit at a modern venue, networking professionals" },
  
  // Festivals & Cultural
  "festival": { category: "Festival", fallbackImage: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&h=250&fit=crop", aiPrompt: "Colorful outdoor festival with food vendors and entertainment" },
  "dragon con": { category: "Festival", fallbackImage: "https://images.unsplash.com/photo-1608889825103-eb5ed706fc64?w=400&h=250&fit=crop", aiPrompt: "Dragon Con in Atlanta, cosplay parade, downtown hotels" },
  "pride": { category: "Festival", fallbackImage: "https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=400&h=250&fit=crop", aiPrompt: "Pride parade with rainbow flags and celebration" },
  
  // Seasonal & Holidays
  "holiday": { category: "Seasonal", fallbackImage: "https://images.unsplash.com/photo-1482517967863-00e15c9b44be?w=400&h=250&fit=crop", aiPrompt: "Holiday season downtown with decorations and lights" },
  "thanksgiving": { category: "Seasonal", fallbackImage: "https://images.unsplash.com/photo-1509621152361-c63e3b4ec57e?w=400&h=250&fit=crop", aiPrompt: "Thanksgiving gathering, autumn decorations" },
  "christmas": { category: "Seasonal", fallbackImage: "https://images.unsplash.com/photo-1482517967863-00e15c9b44be?w=400&h=250&fit=crop", aiPrompt: "Christmas lights and decorations in the city" },
  "new year": { category: "Seasonal", fallbackImage: "https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=400&h=250&fit=crop", aiPrompt: "New Year's Eve celebration, peach drop in Atlanta" },
  "spring break": { category: "Seasonal", fallbackImage: "https://images.unsplash.com/photo-1505765050516-f72dcac9c60e?w=400&h=250&fit=crop", aiPrompt: "Spring break travelers, sunny weather, families" },
  "summer": { category: "Seasonal", fallbackImage: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&h=250&fit=crop", aiPrompt: "Summer activities, outdoor recreation" },
};

const getEventCategory = (eventName: string): { category: string; fallbackImage: string; aiPrompt: string } => {
  const lowerName = eventName.toLowerCase();
  for (const [keyword, data] of Object.entries(eventCategoryMap)) {
    if (lowerName.includes(keyword)) {
      return data;
    }
  }
  return { 
    category: "Event", 
    fallbackImage: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=250&fit=crop",
    aiPrompt: `${eventName} event in Atlanta, vibrant atmosphere`
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
      // If the date is in the past, assume next year
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
  
  // Fallback: return a date 30 days from now
  return addMonths(now, 1);
};

// Memoized event card component
const EventCard = memo(({ event, isFirst }: { event: UpcomingEvent; isFirst: boolean }) => {
  const categoryData = getEventCategory(event.event);
  
  const urgencyColor = event.daysUntil <= 7 
    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    : event.daysUntil <= 30 
      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";

  return (
    <div className={`relative flex gap-4 ${isFirst ? '' : 'pt-6'}`}>
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/50 to-primary/10" />
      
      {/* Timeline dot */}
      <div className="relative z-10 w-8 h-8 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center flex-shrink-0">
        <Calendar className="h-3.5 w-3.5 text-primary" />
      </div>
      
      {/* Event card */}
      <div className="flex-1 group">
        <div className="relative overflow-hidden rounded-xl border bg-card shadow-sm hover:shadow-md transition-all duration-300">
          {/* Image */}
          <div className="relative h-40 overflow-hidden">
            <img
              src={event.imageUrl || categoryData.fallbackImage}
              alt={event.event}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
            
            {/* Days until badge */}
            <div className="absolute top-3 right-3">
              <Badge className={`${urgencyColor} font-semibold`}>
                <Clock className="h-3 w-3 mr-1" />
                {event.daysUntil === 0 
                  ? "Today" 
                  : event.daysUntil === 1 
                    ? "Tomorrow" 
                    : `${event.daysUntil} days`}
              </Badge>
            </div>
            
            {/* Category badge */}
            <div className="absolute top-3 left-3">
              <Badge variant="secondary" className="bg-white/90 text-foreground">
                {categoryData.category}
              </Badge>
            </div>
            
            {/* Event info overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <h4 className="font-semibold text-lg leading-tight">{event.event}</h4>
              <p className="text-sm opacity-90 mt-1">
                {format(event.parsedDate, "EEEE, MMMM d, yyyy")}
              </p>
            </div>
          </div>
          
          {/* Impact section */}
          <div className="p-4 bg-gradient-to-r from-emerald-50/50 to-blue-50/50 dark:from-emerald-950/20 dark:to-blue-950/20">
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">{event.impact}</p>
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
  propertyAddress,
  propertyCity,
}: UpcomingEventsTimelineProps) {
  const [processedEvents, setProcessedEvents] = useState<UpcomingEvent[]>([]);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);

  // Process and sort events by date
  const sortedEvents = useMemo(() => {
    const now = new Date();
    
    return events
      .map((event, idx) => {
        const parsedDate = parseEventDate(event.date);
        const daysUntil = Math.max(0, differenceInDays(parsedDate, now));
        const categoryData = getEventCategory(event.event);
        
        return {
          id: `event-${idx}`,
          event: event.event,
          date: event.date,
          parsedDate,
          daysUntil,
          impact: event.impact,
          category: categoryData.category,
          imageUrl: categoryData.fallbackImage,
        };
      })
      .filter(event => isAfter(event.parsedDate, now) || event.daysUntil === 0)
      .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime())
      .slice(0, 8);
  }, [events]);

  // Generate AI images for events
  const generateEventImages = useCallback(async () => {
    if (isGeneratingImages || sortedEvents.length === 0) return;
    
    setIsGeneratingImages(true);
    const updatedEvents = [...sortedEvents];
    
    try {
      // Generate images for up to 4 events to avoid rate limits
      const eventsToProcess = sortedEvents.slice(0, 4);
      
      for (let i = 0; i < eventsToProcess.length; i++) {
        const event = eventsToProcess[i];
        const categoryData = getEventCategory(event.event);
        
        try {
          const { data, error } = await supabase.functions.invoke("generate-event-image", {
            body: {
              eventName: event.event,
              eventDate: event.date,
              propertyCity: propertyCity || "Atlanta",
              aiPrompt: categoryData.aiPrompt,
            },
          });

          if (!error && data?.imageUrl) {
            updatedEvents[i] = { ...updatedEvents[i], imageUrl: data.imageUrl };
          }
        } catch (err) {
          console.log(`Using fallback image for ${event.event}`);
        }
        
        // Small delay between requests
        if (i < eventsToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    } catch (err) {
      console.error("Error generating event images:", err);
    } finally {
      setProcessedEvents(updatedEvents.length > 0 ? updatedEvents : sortedEvents);
      setIsGeneratingImages(false);
    }
  }, [sortedEvents, propertyCity, isGeneratingImages]);

  useEffect(() => {
    if (sortedEvents.length > 0) {
      setProcessedEvents(sortedEvents);
      // Optionally generate AI images (disabled by default for performance)
      // generateEventImages();
    }
  }, [sortedEvents]);

  const displayEvents = processedEvents.length > 0 ? processedEvents : sortedEvents;

  if (displayEvents.length === 0) {
    return null;
  }

  return (
    <Card className="border-none shadow-lg overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-amber-600" />
            Upcoming Events Near Your Property
          </CardTitle>
          {propertyCity && (
            <Badge variant="secondary" className="gap-1">
              <MapPin className="h-3 w-3" />
              {propertyCity} Area
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Events driving demand • Current date: {format(new Date(), "MMMM d, yyyy")}
        </p>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-0">
          {displayEvents.map((event, idx) => (
            <EventCard key={event.id} event={event} isFirst={idx === 0} />
          ))}
        </div>
        
        {/* Revenue impact summary */}
        <div className="mt-6 p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl border border-primary/10">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="font-semibold text-sm">How PeachHaus Capitalizes on Events</p>
          </div>
          <p className="text-sm text-muted-foreground">
            We automatically adjust pricing using PriceLabs to maximize revenue during high-demand periods. 
            Event dates typically see 20-40% higher rates with maintained occupancy.
          </p>
        </div>
      </CardContent>
    </Card>
  );
});
