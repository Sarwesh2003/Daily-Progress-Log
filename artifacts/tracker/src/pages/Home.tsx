import { useState } from "react";
import { Moon, Sun, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarView } from "@/components/CalendarView";
import { TasksPanel } from "@/components/TasksPanel";
import { StatsCard } from "@/components/StatsCard";
import { SyncPanel } from "@/components/SyncPanel";
import { useTracker } from "@/context/TrackerContext";

interface HomeProps {
  isDark: boolean;
  toggleDark: () => void;
}

export default function Home({ isDark, toggleDark }: HomeProps) {
  const { setSelectedDate } = useTracker();
  const [managingTasks, setManagingTasks] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <CheckSquare className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-base font-semibold text-foreground tracking-tight">DayTrack</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDark}
            data-testid="button-toggle-theme"
            className="h-8 w-8"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Left column: Calendar + Stats + Sync */}
          <aside className="space-y-4">
            <CalendarView onSelectDate={(date) => {
              setSelectedDate(date);
              setManagingTasks(false);
            }} />
            <StatsCard />
            <SyncPanel />
          </aside>

          {/* Right column: Tasks */}
          <section className="bg-card border border-border rounded-2xl p-5 shadow-sm min-h-[400px]">
            <TasksPanel
              managingTasks={managingTasks}
              onToggleManage={() => setManagingTasks((m) => !m)}
            />
          </section>
        </div>
      </main>
    </div>
  );
}
