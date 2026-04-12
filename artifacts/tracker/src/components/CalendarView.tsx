import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTracker } from "@/context/TrackerContext";
import { formatDate, computeStats } from "@/lib/storage";
import { cn } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface CalendarViewProps {
  onSelectDate: (date: string) => void;
}

export function CalendarView({ onSelectDate }: CalendarViewProps) {
  const { data, selectedDate, today } = useTracker();
  const todayDate = new Date();
  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  // 0=Sun, shift so Mon=0
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const goToToday = () => {
    setViewYear(todayDate.getFullYear());
    setViewMonth(todayDate.getMonth());
    onSelectDate(today);
  };

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  function getDayStats(day: number) {
    const date = formatDate(new Date(viewYear, viewMonth, day));
    const record = data.records[date];
    if (!record || data.tasks.length === 0) return null;
    const done = record.completedTaskIds.length;
    const total = data.tasks.length;
    return { done, total, rate: Math.round((done / total) * 100) };
  }

  function getDotColor(rate: number): string {
    if (rate === 100) return "bg-green-500";
    if (rate >= 70) return "bg-primary";
    if (rate >= 40) return "bg-amber-500";
    return "bg-rose-400";
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {MONTHS[viewMonth]} {viewYear}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={goToToday}
            data-testid="button-calendar-today"
            title="Go to today"
          >
            <span className="text-xs font-medium">Today</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth} data-testid="button-prev-month">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth} data-testid="button-next-month">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-7 mb-2">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={`empty-${i}`} />;
            }
            const dateStr = formatDate(new Date(viewYear, viewMonth, day));
            const isSelected = selectedDate === dateStr;
            const isToday = today === dateStr;
            const isFuture = dateStr > today;
            const stats = getDayStats(day);

            return (
              <motion.button
                key={dateStr}
                whileTap={{ scale: 0.92 }}
                onClick={() => onSelectDate(dateStr)}
                data-testid={`calendar-day-${dateStr}`}
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-xl transition-all duration-150 py-1.5 min-h-[48px]",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : isToday
                    ? "bg-primary/10 text-primary font-semibold"
                    : isFuture
                    ? "text-muted-foreground/50 cursor-default"
                    : "hover:bg-muted text-foreground cursor-pointer"
                )}
              >
                <span className={cn("text-sm leading-none", isToday && !isSelected ? "font-bold" : "font-medium")}>
                  {day}
                </span>
                {stats && !isFuture && (
                  <div className="mt-1 flex gap-0.5 items-center">
                    <div
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        isSelected ? "bg-primary-foreground/80" : getDotColor(stats.rate)
                      )}
                    />
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
