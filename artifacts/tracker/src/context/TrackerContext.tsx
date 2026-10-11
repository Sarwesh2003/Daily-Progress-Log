import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import {
  TrackerData,
  Task,
  DayRecord,
  loadData,
  formatDate,
} from "@/lib/storage";
import {
  createGoal,
  updateGoal,
  deleteGoal,
  createOrUpdateCheckin,
  createOrUpdateJournal,
  deleteJournal,
  getUserGoals,
  getAllCheckins,
  migrateLocalData,
  hasLocalDataToMigrate,
  clearLocalData,
} from "@/lib/firestore-service";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getUserCheckinsCollection, getUserGoalsCollection } from "@/lib/firestore-service";
import { useAuth } from "@/context/AuthContext";
import { useCrypto } from "@/context/CryptoContext";

interface TrackerContextValue {
  data: TrackerData;
  loading: boolean;
  migrationState: "idle" | "migrating" | "done" | "failed";
  journals: Record<string, string>;
  addTask: (name: string, category: string, color: string, description?: string) => Promise<void>;
  updateTask: (id: string, name: string, category: string, color: string, description?: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  archiveTask: (id: string, archived?: boolean) => Promise<void>;
  toggleTask: (date: string, taskId: string) => Promise<void>;
  isTaskCompleted: (date: string, taskId: string) => boolean;
  importData: (newData: TrackerData) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  today: string;
  saveJournal: (date: string, content: string) => Promise<void>;
  deleteJournal: (date: string) => Promise<void>;
}

const TrackerContext = createContext<TrackerContextValue | null>(null);

const CACHE_PREFIX = "daytrack-cache-";

function readCache(uid: string): TrackerData | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + uid);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TrackerData;
    if (!parsed.tasks || !parsed.records) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(uid: string, data: TrackerData) {
  try {
    localStorage.setItem(CACHE_PREFIX + uid, JSON.stringify(data));
  } catch {
    // quota / private mode — ignore
  }
}

export function TrackerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isUnlocked, passphrase, decryptField } = useCrypto();
  const today = formatDate(new Date());
  const [data, setData] = useState<TrackerData>({ tasks: [], records: {}, version: 1 });
  const [journals, setJournals] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [loading, setLoading] = useState(true);
  const [migrationState, setMigrationState] = useState<"idle" | "migrating" | "done" | "failed">("idle");
  const uidRef = useRef<string | null>(null);

  // Load + subscribe whenever the authenticated user changes.
  useEffect(() => {
    // Signed out or locked: clear in-memory state immediately (no leakage between accounts).
    if (!user || !isUnlocked) {
      uidRef.current = null;
      setData({ tasks: [], records: {}, version: 1 });
      setJournals({});
      setSelectedDate(formatDate(new Date()));
      setLoading(false);
      setMigrationState("idle");
      return;
    }

    const uid = user.uid;
    uidRef.current = uid;
    setLoading(true);

    let cancelled = false;

    const boot = async () => {
      // Show per-user cache instantly while Firestore loads.
      const cached = readCache(uid);
      if (cached && !cancelled) {
        setData(cached);
      }

      try {
        // One-time migration of legacy localStorage data, only if cloud is empty.
        if (hasLocalDataToMigrate()) {
          const existing = await getUserGoals(uid);
          if (existing.length === 0) {
            const legacy = loadData();
            const hasLegacy =
              legacy.tasks.length > 0 || Object.keys(legacy.records).length > 0;
            if (hasLegacy) {
              if (!cancelled) setMigrationState("migrating");
              await migrateLocalData(uid, legacy);
              clearLocalData();
              if (!cancelled) setMigrationState("done");
            }
          }
        }
      } catch (e) {
        console.warn("[Tracker] migration failed, continuing with cloud data:", e);
        if (!cancelled) setMigrationState("failed");
      }

      try {
        const [goals, checkins] = await Promise.all([
          getUserGoals(uid),
          getAllCheckins(uid),
        ]);
        if (cancelled || uidRef.current !== uid) return;
        const records: Record<string, DayRecord> = {};
        for (const c of checkins) {
          if (!c.completed) continue;
          if (!records[c.date]) records[c.date] = { date: c.date, completedTaskIds: [] };
          if (!records[c.date].completedTaskIds.includes(c.goalId)) {
            records[c.date].completedTaskIds.push(c.goalId);
          }
        }
        const fresh: TrackerData = { tasks: goals, records, version: 1 };
        setData(fresh);
        writeCache(uid, fresh);
      } catch (e) {
        console.error("[Tracker] initial load failed:", e);
        // Keep cache (or empty) so UI stays usable offline.
      } finally {
        if (!cancelled && uidRef.current === uid) setLoading(false);
      }
    };

    boot();

    // Real-time listeners: goals + check-ins + journals.
    // Snapshot handlers are async: decrypt each doc then set state once.
    const goalsRef = getUserGoalsCollection(uid);
    const unsubGoals = onSnapshot(
      goalsRef,
      async (snap) => {
        if (uidRef.current !== uid) return;
        const tasks: Task[] = [];
        for (const d of snap.docs) {
          const raw = d.data() as Record<string, unknown>;
          try {
            const name = await decryptField(raw.name);
            const category = await decryptField(raw.category);
            const descriptionRaw = await decryptField(raw.description);
            tasks.push({
              id: d.id,
              name,
              category,
              color: String(raw.color ?? "violet"),
              createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
              description: descriptionRaw || undefined,
              isArchived: raw.isArchived === true,
            } as Task);
          } catch (e) {
            // Wrong passphrase: skip this doc rather than showing ciphertext.
            console.warn("[Tracker] skipping undecryptable goal", d.id);
          }
        }
        if (uidRef.current !== uid || cancelled) return;
        // Keep sort stable between reads and live updates.
        tasks.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
        setData((prev) => {
          const next = { ...prev, tasks };
          writeCache(uid, next);
          return next;
        });
      },
      (e) => console.error("[Tracker] goals listener error:", e)
    );

    const checkinsRef = getUserCheckinsCollection(uid);
    const unsubCheckins = onSnapshot(
      checkinsRef,
      (snap) => {
        if (uidRef.current !== uid) return;
        const records: Record<string, DayRecord> = {};
        snap.forEach((docSnap) => {
          const c = docSnap.data() as { goalId: string; date: string; completed: boolean };
          if (!c.completed) return;
          if (!records[c.date]) records[c.date] = { date: c.date, completedTaskIds: [] };
          if (!records[c.date].completedTaskIds.includes(c.goalId)) {
            records[c.date].completedTaskIds.push(c.goalId);
          }
        });
        setData((prev) => {
          const next = { ...prev, records };
          writeCache(uid, next);
          return next;
        });
      },
      (e) => console.error("[Tracker] checkins listener error:", e)
    );

    const journalsRef = collection(db, "users", uid, "journals");
    const unsubJournals = onSnapshot(
      journalsRef,
      async (snap) => {
        if (uidRef.current !== uid) return;
        const next: Record<string, string> = {};
        for (const d of snap.docs) {
          const v = d.data() as { content?: unknown };
          if (typeof v.content !== "string" || !v.content) continue;
          try {
            const plaintext = await decryptField(v.content);
            if (plaintext) next[d.id] = plaintext;
          } catch {
            // Skip entries that can't be decrypted with current passphrase.
          }
        }
        if (uidRef.current !== uid || cancelled) return;
        setJournals(next);
      },
      (e) => console.error("[Tracker] journals listener error:", e)
    );

    return () => {
      cancelled = true;
      unsubGoals();
      unsubCheckins();
      unsubJournals();
    };
  }, [user, isUnlocked, decryptField]);

  const addTask = useCallback(
    async (name: string, category: string, color: string, description?: string) => {
      if (!user) throw new Error("Sign in to add goals.");
      if (!isUnlocked || !passphrase) throw new Error("Unlock required to save data.");
      const created = await createGoal(
        user.uid,
        { name, category, color, description, createdAt: new Date().toISOString() },
        passphrase
      );
      setData((prev) => {
        if (prev.tasks.some((t) => t.id === created.id)) return prev;
        const next = { ...prev, tasks: [...prev.tasks, created] };
        writeCache(user.uid, next);
        return next;
      });
    },
    [user, isUnlocked, passphrase]
  );

  const updateTask = useCallback(
    async (id: string, name: string, category: string, color: string, description?: string) => {
      if (!user) throw new Error("Sign in to edit goals.");
      if (!isUnlocked || !passphrase) throw new Error("Unlock required to save data.");
      await updateGoal(user.uid, id, { name, category, color, description }, passphrase);
      setData((prev) => {
        const next = {
          ...prev,
          tasks: prev.tasks.map((t) => (t.id === id ? { ...t, name, category, color, description } : t)),
        };
        writeCache(user.uid, next);
        return next;
      });
    },
    [user, isUnlocked, passphrase]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      if (!user) throw new Error("Sign in to delete goals.");
      await deleteGoal(user.uid, id);
      setData((prev) => {
        const newRecords = { ...prev.records };
        for (const key of Object.keys(newRecords)) {
          newRecords[key] = {
            ...newRecords[key],
            completedTaskIds: newRecords[key].completedTaskIds.filter((tid) => tid !== id),
          };
        }
        const next = {
          ...prev,
          tasks: prev.tasks.filter((t) => t.id !== id),
          records: newRecords,
        };
        writeCache(user.uid, next);
        return next;
      });
    },
    [user]
  );

  const archiveTask = useCallback(
    async (id: string, archived = true) => {
      if (!user) throw new Error("Sign in to archive goals.");
      await updateGoal(user.uid, id, { isArchived: archived });
      setData((prev) => {
        const next = {
          ...prev,
          tasks: prev.tasks.map((t) => (t.id === id ? { ...t, isArchived: archived } : t)),
        };
        writeCache(user.uid, next);
        return next;
      });
    },
    [user]
  );

  const toggleTask = useCallback(
    async (date: string, taskId: string) => {
      if (!user) throw new Error("Sign in to track completion.");
      const currentlyDone =
        data.records[date]?.completedTaskIds.includes(taskId) ?? false;
      const nextDone = !currentlyDone;
      // Optimistic update first for instant feedback.
      setData((prev) => {
        const existing = prev.records[date] ?? { date, completedTaskIds: [] };
        const newRecord: DayRecord = {
          date,
          completedTaskIds: nextDone
            ? [...existing.completedTaskIds, taskId].filter(
                (v, i, a) => a.indexOf(v) === i
              )
            : existing.completedTaskIds.filter((tid) => tid !== taskId),
        };
        const next = { ...prev, records: { ...prev.records, [date]: newRecord } };
        writeCache(user.uid, next);
        return next;
      });
      try {
        await createOrUpdateCheckin(user.uid, taskId, date, nextDone);
      } catch (e) {
        // Roll back on failure — never claim saved when it wasn't.
        setData((prev) => {
          const existing = prev.records[date] ?? { date, completedTaskIds: [] };
          const rolled: DayRecord = {
            date,
            completedTaskIds: currentlyDone
              ? [...existing.completedTaskIds, taskId].filter(
                  (v, i, a) => a.indexOf(v) === i
                )
              : existing.completedTaskIds.filter((tid) => tid !== taskId),
          };
          const next = { ...prev, records: { ...prev.records, [date]: rolled } };
          writeCache(user.uid, next);
          return next;
        });
        throw e;
      }
    },
    [user, data.records]
  );

  const isTaskCompleted = useCallback(
    (date: string, taskId: string) => {
      return data.records[date]?.completedTaskIds.includes(taskId) ?? false;
    },
    [data.records]
  );

  const importDataFn = useCallback(
    (newData: TrackerData) => {
      setData(newData);
      if (user) writeCache(user.uid, newData);
    },
    [user]
  );

  const saveJournal = useCallback(
    async (date: string, content: string) => {
      if (!user) throw new Error("Sign in to save journal entries.");
      if (!isUnlocked || !passphrase) throw new Error("Unlock required to save data.");
      const trimmed = content.slice(0, 10000);
      await createOrUpdateJournal(user.uid, date, trimmed, passphrase);
      setJournals((prev) => {
        if (trimmed.length === 0) {
          const next = { ...prev };
          delete next[date];
          return next;
        }
        return { ...prev, [date]: trimmed };
      });
    },
    [user, isUnlocked, passphrase]
  );

  const deleteJournalEntry = useCallback(
    async (date: string) => {
      if (!user) throw new Error("Sign in to delete journal entries.");
      await deleteJournal(user.uid, date);
      setJournals((prev) => {
        const next = { ...prev };
        delete next[date];
        return next;
      });
    },
    [user]
  );

  return (
    <TrackerContext.Provider
      value={{
        data,
        loading,
        migrationState,
        journals,
        addTask,
        updateTask,
        deleteTask,
        archiveTask,
        toggleTask,
        isTaskCompleted,
        importData: importDataFn,
        selectedDate,
        setSelectedDate,
        today,
        saveJournal,
        deleteJournal: deleteJournalEntry,
      }}
    >
      {children}
    </TrackerContext.Provider>
  );
}

export function useTracker() {
  const ctx = useContext(TrackerContext);
  if (!ctx) throw new Error("useTracker must be used within TrackerProvider");
  return ctx;
}
