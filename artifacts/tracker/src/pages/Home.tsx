import { useState } from "react";
import { Moon, Sun, CheckSquare, LogOut, Lock, User as UserIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarView } from "@/components/CalendarView";
import { TasksPanel } from "@/components/TasksPanel";
import { StatsCard } from "@/components/StatsCard";
import { MonthlyProgress } from "@/components/MonthlyProgress";
import { JournalEntry } from "@/components/JournalEntry";
import { MigrationBanner } from "@/components/MigrationBanner";
import { useTracker } from "@/context/TrackerContext";
import { useAuth } from "@/context/AuthContext";
import { useCrypto } from "@/context/CryptoContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface HomeProps {
  isDark: boolean;
  toggleDark: () => void;
}

export default function Home({ isDark, toggleDark }: HomeProps) {
  const { setSelectedDate, selectedDate, today } = useTracker();
  const { user, signOut } = useAuth();
  const { lock } = useCrypto();
  const [managingTasks, setManagingTasks] = useState(false);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [signingOut, setSigningOut] = useState(false);

  const initials = (user?.displayName ?? user?.email ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      lock();
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const handleLock = () => {
    lock();
  };

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
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDark}
              data-testid="button-toggle-theme"
              className="h-8 w-8"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="h-8 w-8 rounded-full overflow-hidden hover:ring-2 hover:ring-primary/30 transition-all"
                  data-testid="button-user-menu"
                  aria-label="Account menu"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="flex items-start gap-2 font-normal">
                  <UserIcon className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <span className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-medium truncate">
                      {user?.displayName ?? "Signed in"}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {user?.email ?? ""}
                    </span>
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLock} data-testid="button-lock">
                  <Lock className="w-4 h-4 mr-2" />
                  Lock (re-enter passphrase)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} disabled={signingOut} data-testid="button-sign-out">
                  {signingOut ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4 mr-2" />
                  )}
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <MigrationBanner />

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Left column: Calendar + Monthly progress + Stats */}
          <aside className="space-y-4">
            <CalendarView
              onSelectDate={(date) => {
                setSelectedDate(date);
                setManagingTasks(false);
              }}
              viewMonth={viewMonth}
              viewYear={viewYear}
              onMonthChange={(m, y) => {
                setViewMonth(m);
                setViewYear(y);
              }}
            />
            <MonthlyProgress month={viewMonth} year={viewYear} />
            <StatsCard />
          </aside>

          {/* Right column: Tasks + Journal */}
          <div className="space-y-4">
            <section className="bg-card border border-border rounded-2xl p-5 shadow-sm min-h-[400px]">
              <TasksPanel
                managingTasks={managingTasks}
                onToggleManage={() => setManagingTasks((m) => !m)}
              />
            </section>
            <JournalEntry date={selectedDate} displayDateLabel={selectedDate === today ? "Today" : selectedDate} />
          </div>
        </div>
      </main>
    </div>
  );
}
