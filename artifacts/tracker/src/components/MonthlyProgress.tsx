import { motion } from "framer-motion";
import { Flame, Minus } from "lucide-react";
import { useTracker } from "@/context/TrackerContext";
import { getMonthDates, computeStats, getColorInfo } from "@/lib/storage";
import { cn } from "@/lib/utils";

interface MonthlyProgressProps {
  month: number;
  year: number;
}

function ProgressBar({ rate, color }: { rate: number; color: string }) {
  return (
    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
      <motion.div
        className={cn("h-full rounded-full", color)}
        initial={{ width: 0 }}
        animate={{ width: `${rate}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

function calcStreak(taskId: string, dates: string[], records: Record<string, { completedTaskIds: string[] }>) {
  let current = 0;
  let best = 0;
  for (const d of dates) {
    const rec = records[d];
    if (rec?.completedTaskIds.includes(taskId)) {
      current++;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return { current, best };
}

export function MonthlyProgress({ month, year }: MonthlyProgressProps) {
  const { data, today } = useTracker();
  const { tasks, records } = data;

  const dates = getMonthDates(year, month);
  // Only dates up to today are "applicable"
  const applicableDates = dates.filter((d) => d <= today);

  if (tasks.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-1">Monthly Progress</h3>
        <p className="text-sm text-muted-foreground">Add goals to see monthly progress.</p>
      </div>
    );
  }

  // Aggregate per active goal
  const activeTasks = tasks.filter((t) => !t.isArchived);
  const progressItems = activeTasks.map((task) => {
    const stats = computeStats([task], records, applicableDates);
    const { current, best } = calcStreak(task.id, applicableDates, records);

    let rateColor: string;
    if (stats.rate === 100) rateColor = "bg-green-500";
    else if (stats.rate >= 70) rateColor = "bg-primary";
    else if (stats.rate >= 40) rateColor = "bg-amber-500";
    else rateColor = "bg-rose-400";

    return {
      task,
      completed: stats.completed,
      total: stats.total,
      rate: stats.rate,
      rateColor,
      current,
      best,
    };
  });

  // Overall stats
  const overallStats = computeStats(tasks, records, applicableDates);
  const overallRate = overallStats.rate;
  const overallColor = overallRate === 100 ? "text-green-600" : overallRate >= 70 ? "text-primary" : overallRate >= 40 ? "text-amber-600" : "text-rose-500";

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Monthly Progress</h3>
        <div className="text-right">
          <span className={cn("text-lg font-bold", overallColor)}>{overallRate}%</span>
          <span className="text-xs text-muted-foreground ml-1">overall</span>
        </div>
      </div>

      <ProgressBar rate={overallRate} color={overallColor.replace("text-", "bg-")} />

      <div className="mt-4 space-y-4">
        {progressItems.map((item: typeof progressItems[number], idx: number) => (
          <motion.div
            key={item.task.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className={cn("w-3 h-3 rounded-full flex-shrink-0", getColorInfo(item.task.color).bg)} />
                <span className="text-sm font-medium text-foreground truncate">{item.task.name}</span>
                {item.task.category && (
                  <span className={cn("text-xs px-1.5 py-0.5 rounded-md font-medium bg-muted")}>
                    {item.task.category}
                  </span>
                )}
              </div>
              <span className={cn("text-sm font-bold tabular-nums", item.rateColor.replace("bg-", "text-"))}>
                {item.rate}%
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ProgressBar rate={item.rate} color={item.rateColor} />
              <span className="w-16 text-right">{item.completed} / {item.total}</span>
              {item.current > 0 && (
                <span className="flex items-center gap-1 text-primary">
                  <Flame className="w-3 h-3" /> {item.current} {item.current === item.best ? "🔥" : ""}
                </span>
              )}
              {item.current === 0 && <span className="w-6 text-center"><Minus className="w-3 h-3 mx-auto" /></span>}
            </div>
          </motion.div>
        ))}
      </div>

      {activeTasks.length === 0 && tasks.length > 0 && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-muted-foreground text-center py-4">
          All goals are archived. Unarchive one to track it.
        </motion.p>
      )}
    </div>
  );
}