import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Pencil, Trash2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskCheckbox } from "@/components/TaskCheckbox";
import { AddTaskDialog } from "@/components/AddTaskDialog";
import { useTracker } from "@/context/TrackerContext";
import { Task, getColorInfo } from "@/lib/storage";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDisplayDate(dateStr: string, today: string): string {
  if (dateStr === today) return "Today";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
  return `${dayName}, ${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

interface TaskRowProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

function TaskManageRow({ task, onEdit, onDelete }: TaskRowProps) {
  const colorInfo = getColorInfo(task.color);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors group"
    >
      <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", colorInfo.bg)} />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-foreground truncate block">{task.name}</span>
        {task.category && (
          <span className={cn("text-xs px-1.5 py-0.5 rounded-md font-medium inline-block mt-0.5", colorInfo.light)}>
            {task.category}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onEdit(task)}
          data-testid={`button-edit-task-${task.id}`}
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(task.id)}
          data-testid={`button-delete-task-${task.id}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}

interface TasksPanelProps {
  managingTasks: boolean;
  onToggleManage: () => void;
}

export function TasksPanel({ managingTasks, onToggleManage }: TasksPanelProps) {
  const { data, deleteTask, selectedDate, today } = useTracker();
  const [addOpen, setAddOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const displayDate = formatDisplayDate(selectedDate, today);
  const completedCount = data.records[selectedDate]?.completedTaskIds.length ?? 0;
  const totalCount = data.tasks.length;
  const isFuture = selectedDate > today;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{displayDate}</h2>
          {totalCount > 0 && !isFuture && (
            <p className="text-sm text-muted-foreground">
              {completedCount} of {totalCount} completed
            </p>
          )}
          {isFuture && (
            <p className="text-sm text-muted-foreground">Future date — tasks listed below</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={managingTasks ? "secondary" : "ghost"}
            size="sm"
            onClick={onToggleManage}
            data-testid="button-manage-tasks"
            className="gap-1.5"
          >
            <Settings2 className="w-4 h-4" />
            <span className="hidden sm:inline">Manage</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            data-testid="button-add-task"
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Task</span>
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && !isFuture && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-primary"
            animate={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </div>
      )}

      {/* Task list */}
      <AnimatePresence mode="popLayout">
        {managingTasks ? (
          <motion.div
            key="manage"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide px-1">
              All Tasks ({totalCount})
            </p>
            {data.tasks.length === 0 ? (
              <EmptyState onAdd={() => setAddOpen(true)} />
            ) : (
              <AnimatePresence>
                {data.tasks.map((task) => (
                  <TaskManageRow
                    key={task.id}
                    task={task}
                    onEdit={(t) => setEditTask(t)}
                    onDelete={deleteTask}
                  />
                ))}
              </AnimatePresence>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="check"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            {data.tasks.length === 0 ? (
              <EmptyState onAdd={() => setAddOpen(true)} />
            ) : (
              <AnimatePresence>
                {data.tasks.map((task) => (
                  <TaskCheckbox key={task.id} task={task} date={selectedDate} />
                ))}
              </AnimatePresence>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AddTaskDialog open={addOpen} onClose={() => setAddOpen(false)} />
      {editTask && (
        <AddTaskDialog
          open={!!editTask}
          onClose={() => setEditTask(null)}
          editTask={editTask}
        />
      )}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-12 text-center"
    >
      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
        <Plus className="w-6 h-6 text-primary" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">No tasks yet</p>
      <p className="text-sm text-muted-foreground mb-4">
        Add your daily routines and achievements to track
      </p>
      <Button size="sm" onClick={onAdd} data-testid="button-add-first-task">
        Add your first task
      </Button>
    </motion.div>
  );
}
