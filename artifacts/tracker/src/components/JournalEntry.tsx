import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Check, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTracker } from "@/context/TrackerContext";
import { useToast } from "@/hooks/use-toast";

interface JournalEntryProps {
  date: string;
  displayDateLabel: string;
}

export function JournalEntry({ date, displayDateLabel }: JournalEntryProps) {
  const { journals, saveJournal, deleteJournal } = useTracker();
  const { toast } = useToast();

  const remoteContent = journals[date] ?? "";
  const [draft, setDraft] = useState(remoteContent);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const baselineRef = useRef(remoteContent);

  // Keep draft in sync when navigating dates or receiving remote updates
  // (but don't clobber an in-progress local edit).
  useEffect(() => {
    baselineRef.current = remoteContent;
    setDraft(remoteContent);
    setSaveState("idle");
  }, [remoteContent, date]);

  const hasChanges = draft !== baselineRef.current;
  const trimmed = draft.trim();
  const overLimit = draft.length > 10000;

  const onSave = async () => {
    if (overLimit) return;
    setSaving(true);
    setSaveState("idle");
    try {
      await saveJournal(date, draft);
      baselineRef.current = draft;
      setSaveState("saved");
      toast({
        title: trimmed.length === 0 ? "Journal cleared" : "Journal saved",
        description: trimmed.length === 0 ? "Entry removed for this date." : "Your entry was saved.",
      });
      setTimeout(() => setSaveState("idle"), 2200);
    } catch {
      setSaveState("error");
      toast({
        title: "Save failed",
        description: "Could not save your journal entry. Check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!remoteContent && !trimmed) return;
    const ok = window.confirm("Delete this journal entry? This cannot be undone.");
    if (!ok) return;
    setSaving(true);
    try {
      await deleteJournal(date);
      setDraft("");
      baselineRef.current = "";
      toast({ title: "Journal deleted" });
    } catch {
      toast({
        title: "Delete failed",
        description: "Could not delete this entry. Try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-2xl p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-violet-600 dark:text-violet-300" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Journal</h3>
            <p className="text-xs text-muted-foreground">{displayDateLabel}</p>
          </div>
        </div>
        {(remoteContent.length > 0 || hasChanges) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={saving}
            className="text-muted-foreground hover:text-destructive gap-1.5"
            data-testid="button-delete-journal"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </Button>
        )}
      </div>

      <Textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (saveState !== "idle") setSaveState("idle");
        }}
        placeholder="How did today go? What did you learn, feel, or notice?"
        rows={5}
        maxLength={10050}
        className="min-h-[110px] resize-y"
        data-testid="input-journal"
        aria-label="Journal entry"
      />

      <div className="flex items-center justify-between gap-3 mt-3">
        <div className="flex items-center gap-2 text-xs">
          <span className={overLimit ? "text-destructive font-medium" : "text-muted-foreground"}>
            {draft.length.toLocaleString()} / 10,000
          </span>
          {overLimit && (
            <span className="inline-flex items-center gap-1 text-destructive">
              <AlertTriangle className="w-3 h-3" /> Too long
            </span>
          )}
          {saveState === "saved" && (
            <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
          {saveState === "error" && (
            <span className="text-destructive">Not saved — retry</span>
          )}
        </div>

        <Button
          size="sm"
          onClick={onSave}
          disabled={!hasChanges || overLimit || saving}
          data-testid="button-save-journal"
          className="gap-1.5"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      {!hasChanges && remoteContent.length === 0 && (
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Tip: one entry per date. It syncs across devices and stays private to your account.
        </p>
      )}
    </motion.section>
  );
}
