import { useRef } from "react";
import { Download, Upload, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTracker } from "@/context/TrackerContext";
import { exportData, importData } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";

export function SyncPanel() {
  const { data, importData: importDataFn } = useTracker();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    exportData(data);
    toast({ title: "Data exported", description: "Your tracker data has been downloaded." });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importData(file);
      importDataFn(imported);
      toast({ title: "Data imported", description: "Your tracker data has been loaded." });
    } catch (err) {
      toast({ title: "Import failed", description: "The file could not be read. Make sure it's a valid export.", variant: "destructive" });
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-1">Cross-device Sync</h3>
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
        Export your data from one device and import it on another to keep everything in sync.
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          className="flex-1 gap-1.5"
          data-testid="button-export-data"
        >
          <Download className="w-3.5 h-3.5" />
          Export
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          className="flex-1 gap-1.5"
          data-testid="button-import-data"
        >
          <Upload className="w-3.5 h-3.5" />
          Import
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImport}
          data-testid="input-import-file"
        />
      </div>
      <div className="flex items-start gap-1.5 mt-3 p-2.5 rounded-lg bg-muted/50">
        <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Importing will replace all current data. Export first to avoid losing progress.
        </p>
      </div>
    </div>
  );
}
