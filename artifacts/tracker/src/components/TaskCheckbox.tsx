import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { Task } from "@/lib/storage";
import { getColorInfo } from "@/lib/storage";
import { useTracker } from "@/context/TrackerContext";
import { cn } from "@/lib/utils";

interface TaskCheckboxProps {
  task: Task;
  date: string;
}

export function TaskCheckbox({ task, date }: TaskCheckboxProps) {
  const { toggleTask, isTaskCompleted } = useTracker();
  const completed = isTaskCompleted(date, task.id);
  const colorInfo = getColorInfo(task.color);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 cursor-pointer select-none group",
        completed
          ? "bg-muted/50 border-border/50 opacity-75"
          : "bg-card border-border hover:border-primary/30 hover:shadow-sm"
      )}
      onClick={() => toggleTask(date, task.id)}
      data-testid={`task-checkbox-${task.id}`}
    >
      <div
        className={cn(
          "w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200",
          completed
            ? `${colorInfo.bg} border-transparent`
            : "border-border group-hover:border-primary/50"
        )}
      >
        <AnimatePresence>
          {completed && (
            <motion.div
              key="check"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 min-w-0">
        <span
          className={cn(
            "text-sm font-medium transition-all duration-200",
            completed ? "line-through text-muted-foreground" : "text-foreground"
          )}
        >
          {task.name}
        </span>
        {task.category && (
          <span
            className={cn(
              "ml-2 text-xs px-1.5 py-0.5 rounded-md font-medium",
              colorInfo.light
            )}
          >
            {task.category}
          </span>
        )}
      </div>

      <div
        className={cn(
          "w-2 h-2 rounded-full flex-shrink-0 transition-all duration-200",
          colorInfo.bg,
          completed ? "opacity-40" : "opacity-100"
        )}
      />
    </motion.div>
  );
}
