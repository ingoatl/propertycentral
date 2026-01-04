import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isWithinInterval, addMonths, subMonths } from "date-fns";

interface Booking {
  id: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  type: "short_term" | "mid_term";
}

interface BookingCalendarViewProps {
  bookings: Booking[];
}

export function BookingCalendarView({ bookings }: BookingCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getBookingsForDay = (day: Date) => {
    return bookings.filter(booking =>
      isWithinInterval(day, { start: booking.checkIn, end: booking.checkOut })
    );
  };

  const isCheckIn = (day: Date, booking: Booking) => {
    return format(day, "yyyy-MM-dd") === format(booking.checkIn, "yyyy-MM-dd");
  };

  const isCheckOut = (day: Date, booking: Booking) => {
    return format(day, "yyyy-MM-dd") === format(booking.checkOut, "yyyy-MM-dd");
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const firstDayOfMonth = startOfMonth(currentMonth).getDay();

  return (
    <Card className="border-none shadow-lg overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 border-b pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            Booking Calendar
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold min-w-[140px] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-sm text-muted-foreground">Short-term</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span className="text-sm text-muted-foreground">Mid-term</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for days before the first of the month */}
          {Array.from({ length: firstDayOfMonth }).map((_, index) => (
            <div key={`empty-${index}`} className="h-20 p-1" />
          ))}

          {/* Calendar days */}
          {calendarDays.map(day => {
            const dayBookings = getBookingsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isTodayDate = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={`h-20 p-1 border rounded-lg transition-colors ${
                  isCurrentMonth ? "bg-background" : "bg-muted/30"
                } ${isTodayDate ? "ring-2 ring-primary ring-offset-1" : ""}`}
              >
                <div className={`text-sm font-medium mb-1 ${
                  isTodayDate ? "text-primary" : "text-foreground"
                }`}>
                  {format(day, "d")}
                </div>
                <div className="space-y-0.5 overflow-hidden">
                  {dayBookings.slice(0, 2).map(booking => {
                    const isStart = isCheckIn(day, booking);
                    const isEnd = isCheckOut(day, booking);
                    const color = booking.type === "short_term" ? "bg-blue-500" : "bg-purple-500";

                    return (
                      <div
                        key={booking.id}
                        className={`text-[10px] px-1 py-0.5 text-white truncate ${color} ${
                          isStart ? "rounded-l-sm" : ""
                        } ${isEnd ? "rounded-r-sm" : ""}`}
                        title={`${booking.guestName}: ${format(booking.checkIn, "MMM d")} - ${format(booking.checkOut, "MMM d")}`}
                      >
                        {isStart ? booking.guestName : ""}
                      </div>
                    );
                  })}
                  {dayBookings.length > 2 && (
                    <div className="text-[10px] text-muted-foreground px-1">
                      +{dayBookings.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
