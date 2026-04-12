import { motion } from "framer-motion";
import { useTracker } from "@/context/TrackerContext";
import { computeStats, getWeekDates, getMonthDates, formatDate } from "@/lib/storage";
import { cn } from "@/lib/utils";

function StatBlock({
  label,
  rate,
  completed,
  total,
  delay = 0,
}: {
  label: string;
  rate: number;
  completed: number;
  total: number;
  delay?: number;
}) {
  const color =
    rate === 100
      ? "text-green-600 dark:text-green-400"
      : rate >= 70
      ? "text-primary"
      : rate >= 40
      ? "text-amber-600 dark:text-amber-400"
      : rate > 0
      ? "text-rose-500"
      : "text-muted-foreground";

  const barColor =
    rate === 100
      ? "bg-green-500"
      : rate >= 70
      ? "bg-primary"
      : rate >= 40
      ? "bg-amber-500"
      : "bg-rose-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25 }}
      className="flex flex-col gap-2"
    >
      <div className="flex items-end justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className={cn("text-lg font-bold tabular-nums leading-none", color)}>
          {rate}%
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={cn("h-full rounded-full", barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${rate}%` }}
          transition={{ delay: delay + 0.1, duration: 0.5, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {completed} / {total} tasks
      </span>
    </motion.div>
  );
}

export function StatsCard() {
  const { data } = useTracker();
  const today = new Date();
  const todayStr = formatDate(today);

  const weekDates = getWeekDates(today);
  const monthDates = getMonthDates(today.getFullYear(), today.getMonth());

  // Year dates: all days in this year up to today
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const yearDates: string[] = [];
  for (let d = new Date(yearStart); d <= today; d.setDate(d.getDate() + 1)) {
    yearDates.push(formatDate(new Date(d)));
  }

  const weekStats = computeStats(data.tasks, data.records, weekDates.filter((d) => d <= todayStr));
  const monthStats = computeStats(data.tasks, data.records, monthDates.filter((d) => d <= todayStr));
  const yearStats = computeStats(data.tasks, data.records, yearDates);

  if (data.tasks.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-1">Statistics</h3>
        <p className="text-sm text-muted-foreground">Add tasks to start tracking your progress.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4">Statistics</h3>
      <div className="space-y-4">
        <StatBlock label="This Week" rate={weekStats.rate} completed={weekStats.completed} total={weekStats.total} delay={0} />
        <StatBlock label="This Month" rate={monthStats.rate} completed={monthStats.completed} total={monthStats.total} delay={0.05} />
        <StatBlock label="This Year" rate={yearStats.rate} completed={yearStats.completed} total={yearStats.total} delay={0.1} />
      </div>
    </div>
  );
}
