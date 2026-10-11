import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTracker } from "@/context/TrackerContext";
import { TASK_COLORS, Task, getColorInfo } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Archive, RotateCcw, Loader2 } from "lucide-react";

interface AddTaskDialogProps {
  open: boolean;
  onClose: () => void;
  editTask?: Task | null;
}

export function AddTaskDialog({ open, onClose, editTask }: AddTaskDialogProps) {
  const { addTask, updateTask, archiveTask } = useTracker();
  const { toast } = useToast();
  const [name, setName] = useState(editTask?.name ?? "");
  const [category, setCategory] = useState(editTask?.category ?? "");
  const [color, setColor] = useState(editTask?.color ?? "violet");
  const [description, setDescription] = useState(editTask?.description ?? "");
  const [saving, setSaving] = useState(false);

  const isEdit = !!editTask;

  const handleOpen = () => {
    if (editTask) {
      setName(editTask.name);
      setCategory(editTask.category);
      setColor(editTask.color);
      setDescription(editTask.description ?? "");
    } else {
      setName("");
      setCategory("");
      setColor("violet");
      setDescription("");
    }
    setSaving(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const desc = description.trim() || undefined;
      if (isEdit && editTask) {
        await updateTask(editTask.id, name.trim(), category.trim(), color, desc);
        toast({ title: "Task updated" });
      } else {
        await addTask(name.trim(), category.trim(), color, desc);
        toast({ title: "Task added" });
      }
      onClose();
    } catch {
      toast({
        title: isEdit ? "Update failed" : "Add failed",
        description: "Could not save task. Check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleArchive = async () => {
    if (!editTask) return;
    const next = !editTask.isArchived;
    try {
      await archiveTask(editTask.id, next);
      toast({ title: next ? "Task archived" : "Task restored" });
      onClose();
    } catch {
      toast({ title: "Action failed", description: "Could not update archive status.", variant: "destructive" });
    }
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
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmit()}
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
            <Label htmlFor="task-description">Description (optional)</Label>
            <Textarea
              id="task-description"
              data-testid="input-task-description"
              placeholder="Add details, notes, or context…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{description.length} / 500</p>
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
              {description.trim() && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{description.trim()}</p>
              )}
            </div>
          )}
          {isEdit && editTask && (
            <div className="pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleArchive}
                className={cn("gap-1.5 w-full", editTask.isArchived ? "text-primary" : "text-muted-foreground")}
                data-testid="button-toggle-archive"
              >
                {editTask.isArchived ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                {editTask.isArchived ? "Unarchive task" : "Archive task"}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-1">
                {editTask.isArchived ? "Archived goals are hidden from the daily list but kept in history." : "Archive to hide from daily list without deleting history."}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || saving} data-testid="button-save-task" className="gap-1.5">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
