import { useState } from "react";
import { Copy, Check, ArrowDownToLine, RefreshCw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTracker } from "@/context/TrackerContext";
import { generateSyncCode, parseSyncCode } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

type Mode = "idle" | "copy" | "paste";

export function SyncPanel() {
  const { data, importData: importDataFn } = useTracker();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("idle");
  const [copied, setCopied] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [loading, setLoading] = useState(false);

  const syncCode = generateSyncCode(data);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(syncCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Please select and copy the code manually.", variant: "destructive" });
    }
  };

  const handleApply = () => {
    if (!pasteValue.trim()) return;
    setLoading(true);
    try {
      const parsed = parseSyncCode(pasteValue.trim());
      importDataFn(parsed);
      toast({ title: "Sync successful", description: "Your data has been updated from the sync code." });
      setMode("idle");
      setPasteValue("");
    } catch {
      toast({ title: "Invalid code", description: "The sync code could not be read. Make sure you copied it correctly.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-1">Cross-device Sync</h3>
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
        Copy a sync code on one device and paste it on another to transfer your data instantly.
      </p>

      {/* Action buttons */}
      <div className="flex gap-2 mb-3">
        <Button
          variant={mode === "copy" ? "secondary" : "outline"}
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => setMode(mode === "copy" ? "idle" : "copy")}
          data-testid="button-copy-code"
        >
          <Copy className="w-3.5 h-3.5" />
          Copy Code
        </Button>
        <Button
          variant={mode === "paste" ? "secondary" : "outline"}
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => setMode(mode === "paste" ? "idle" : "paste")}
          data-testid="button-paste-code"
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
          Paste Code
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {mode === "copy" && (
          <motion.div
            key="copy-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2">
              <div className="relative">
                <Textarea
                  readOnly
                  value={syncCode}
                  rows={3}
                  data-testid="textarea-sync-code"
                  className="text-xs font-mono resize-none bg-muted/50 pr-10 select-all"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
                <button
                  onClick={handleCopy}
                  className={cn(
                    "absolute top-2 right-2 p-1.5 rounded-md transition-all duration-200",
                    copied
                      ? "text-green-600 bg-green-100 dark:bg-green-900/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  data-testid="button-copy-to-clipboard"
                  title="Copy to clipboard"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {copied ? "Copied! Now paste this on your other device." : "Click the code to select all, or use the copy button."}
              </p>
            </div>
          </motion.div>
        )}

        {mode === "paste" && (
          <motion.div
            key="paste-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2">
              <Textarea
                placeholder="Paste your sync code here..."
                value={pasteValue}
                onChange={(e) => setPasteValue(e.target.value)}
                rows={3}
                data-testid="textarea-paste-code"
                className="text-xs font-mono resize-none"
                autoFocus
              />
              <Button
                size="sm"
                className="w-full gap-1.5"
                onClick={handleApply}
                disabled={!pasteValue.trim() || loading}
                data-testid="button-apply-sync-code"
              >
                {loading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                )}
                Apply Sync Code
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn("flex items-start gap-1.5 p-2.5 rounded-lg bg-muted/50", mode !== "idle" ? "mt-3" : "")}>
        <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Applying a code replaces your current data. Copy your current code first if you want to keep it.
        </p>
      </div>
    </div>
  );
}
