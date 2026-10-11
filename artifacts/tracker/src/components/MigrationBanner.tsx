import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useTracker } from "@/context/TrackerContext";

export function MigrationBanner() {
  const { migrationState } = useTracker();

  if (migrationState === "idle" || migrationState === "migrating") {
    if (migrationState !== "migrating") return null;
    return (
      <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          Migrating your local data to your account…
        </div>
      </div>
    );
  }

  if (migrationState === "done") {
    return (
      <div className="bg-green-50 dark:bg-green-950/30 border-b border-green-200 dark:border-green-800">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Your previous local data was moved to this account. A backup is kept in your browser.
        </div>
      </div>
    );
  }

  // failed
  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
      <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        Local data migration failed. Your local data was kept — nothing was lost. Try reloading; if it persists, contact support.
      </div>
    </div>
  );
}
