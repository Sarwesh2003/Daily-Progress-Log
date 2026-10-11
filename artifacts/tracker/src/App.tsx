import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { CryptoProvider, useCrypto } from "@/context/CryptoContext";
import { TrackerProvider } from "@/context/TrackerContext";
import { AuthScreen } from "@/components/AuthScreen";
import { PassphraseSetup } from "@/components/PassphraseSetup";
import { UnlockScreen } from "@/components/UnlockScreen";
import { getCryptoMeta } from "@/lib/firestore-service";
import Home from "@/pages/Home";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ThemeWrapper() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  const toggleDark = () => setIsDark((d) => !d);

  return (
    <TrackerProvider>
      <Switch>
        <Route path="/" component={() => <Home isDark={isDark} toggleDark={toggleDark} />} />
        <Route component={NotFound} />
      </Switch>
    </TrackerProvider>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();
  const [authHandled, setAuthHandled] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user && !authHandled) {
    return <AuthScreen onAuthSuccess={() => setAuthHandled(true)} />;
  }

  if (!user) {
    return <AuthScreen onAuthSuccess={() => setAuthHandled(true)} />;
  }

  return <ThemeWrapper />;
}

// After login, gate on unlock. Auto-detects whether this account already
// has encryption set up (shows Unlock) or needs first-time setup.
// Setup is ONLY shown for fresh accounts (no crypto meta). Existing accounts
// must verify passphrase/recovery key — re-keying without proof is blocked.
function UnlockGate() {
  const { user } = useAuth();
  const { isUnlocked } = useCrypto();
  // null = still checking, true = has crypto meta, false = fresh account
  const [hasSetup, setHasSetup] = useState<boolean | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Reset setup-check when switching accounts (different UID).
  useEffect(() => {
    if (user) setHasSetup(null);
  }, [user?.uid]);

  const handleUnlockComplete = () => {
    // After successful setup OR unlock, this account is known to have setup.
    setHasSetup(true);
    setRefreshKey((k) => k + 1);
  };

  // Not logged in yet — show auth screen (login-first, not passphrase-first)
  if (!user) {
    return <AuthGate />;
  }

  // Logged in and unlocked — show app
  if (isUnlocked) {
    return <ThemeWrapper />;
  }

  // Logged in but locked — check whether this account has encryption set up
  return (
    <UnlockDecider
      key={`${user.uid}-${refreshKey}`}
      uid={user.uid}
      hasSetup={hasSetup}
      setHasSetup={setHasSetup}
      onComplete={handleUnlockComplete}
    />
  );
}

function UnlockDecider({
  uid,
  hasSetup,
  setHasSetup,
  onComplete,
}: {
  uid: string;
  hasSetup: boolean | null;
  setHasSetup: (v: boolean | null) => void;
  onComplete: () => void;
}) {
  useEffect(() => {
    let cancelled = false;
    setHasSetup(null);
    import("@/lib/firestore-service").then(({ getCryptoMeta }) => {
      getCryptoMeta(uid)
        .then((meta) => {
          if (!cancelled) setHasSetup(meta !== null);
        })
        .catch(() => {
          // Offline or permission error — default to unlock screen, which
          // surfaces the real error on submit. Never block on setup.
          if (!cancelled) setHasSetup(true);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [uid, setHasSetup]);

  if (hasSetup === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Checking encryption setup…</p>
        </div>
      </div>
    );
  }

  if (!hasSetup) {
    return <PassphraseSetup onComplete={onComplete} />;
  }

  return <UnlockScreen onUnlock={onComplete} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <CryptoProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <UnlockGate />
            </WouterRouter>
          </CryptoProvider>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;