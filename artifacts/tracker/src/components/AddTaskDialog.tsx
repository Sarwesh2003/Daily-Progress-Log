import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTracker } from "@/context/TrackerContext";
import { TASK_COLORS, Task, getColorInfo } from "@/lib/storage";
import { cn } from "@/lib/utils";

interface AddTaskDialogProps {
  open: boolean;
  onClose: () => void;
  editTask?: Task | null;
}

export function AddTaskDialog({ open, onClose, editTask }: AddTaskDialogProps) {
  const { addTask, updateTask } = useTracker();
  const [name, setName] = useState(editTask?.name ?? "");
  const [category, setCategory] = useState(editTask?.category ?? "");
  const [color, setColor] = useState(editTask?.color ?? "violet");

  const isEdit = !!editTask;

  const handleOpen = () => {
    if (editTask) {
      setName(editTask.name);
      setCategory(editTask.category);
      setColor(editTask.color);
    } else {
      setName("");
      setCategory("");
      setColor("violet");
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    if (isEdit && editTask) {
      updateTask(editTask.id, name.trim(), category.trim(), color);
    } else {
      addTask(name.trim(), category.trim(), color);
    }
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
        else handleOpen();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Task" : "Add New Task"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="task-name">Task name</Label>
            <Input
              id="task-name"
              data-testid="input-task-name"
              placeholder="e.g. Morning workout"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-category">Category (optional)</Label>
            <Input
              id="task-category"
              data-testid="input-task-category"
              placeholder="e.g. Health, Work, Personal"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {TASK_COLORS.map((c) => {
                const isSelected = color === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    data-testid={`color-option-${c.value}`}
                    onClick={() => setColor(c.value)}
                    className={cn(
                      "w-7 h-7 rounded-full transition-all duration-150",
                      c.bg,
                      isSelected
                        ? "ring-2 ring-offset-2 ring-primary scale-110"
                        : "opacity-60 hover:opacity-100"
                    )}
                    title={c.label}
                  />
                );
              })}
            </div>
          </div>
          {name.trim() && (
            <div className="pt-1">
              <p className="text-xs text-muted-foreground mb-1">Preview</p>
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl border",
                  "bg-card border-border"
                )}
              >
                <div className={cn("w-5 h-5 rounded-md border-2 border-border")} />
                <span className="text-sm font-medium">{name.trim()}</span>
                {category.trim() && (
                  <span className={cn("text-xs px-1.5 py-0.5 rounded-md font-medium", getColorInfo(color).light)}>
                    {category.trim()}
                  </span>
                )}
                <div className={cn("w-2 h-2 rounded-full ml-auto", getColorInfo(color).bg)} />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim()} data-testid="button-save-task">
            {isEdit ? "Save Changes" : "Add Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
