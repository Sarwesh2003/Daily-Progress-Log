import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import {
  TrackerData,
  Task,
  DayRecord,
  loadData,
  saveData,
  formatDate,
} from "@/lib/storage";

interface TrackerContextValue {
  data: TrackerData;
  addTask: (name: string, category: string, color: string) => void;
  updateTask: (id: string, name: string, category: string, color: string) => void;
  deleteTask: (id: string) => void;
  toggleTask: (date: string, taskId: string) => void;
  isTaskCompleted: (date: string, taskId: string) => boolean;
  importData: (newData: TrackerData) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  today: string;
}

const TrackerContext = createContext<TrackerContextValue | null>(null);

export function TrackerProvider({ children }: { children: ReactNode }) {
  const today = formatDate(new Date());
  const [data, setData] = useState<TrackerData>(() => loadData());
  const [selectedDate, setSelectedDate] = useState<string>(today);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const addTask = useCallback((name: string, category: string, color: string) => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      name,
      category,
      color,
      createdAt: new Date().toISOString(),
    };
    setData((prev) => ({ ...prev, tasks: [...prev.tasks, newTask] }));
  }, []);

  const updateTask = useCallback((id: string, name: string, category: string, color: string) => {
    setData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === id ? { ...t, name, category, color } : t
      ),
    }));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setData((prev) => {
      const newRecords = { ...prev.records };
      for (const key of Object.keys(newRecords)) {
        newRecords[key] = {
          ...newRecords[key],
          completedTaskIds: newRecords[key].completedTaskIds.filter((tid) => tid !== id),
        };
      }
      return {
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== id),
        records: newRecords,
      };
    });
  }, []);

  const toggleTask = useCallback((date: string, taskId: string) => {
    setData((prev) => {
      const existing = prev.records[date] ?? { date, completedTaskIds: [] };
      const alreadyDone = existing.completedTaskIds.includes(taskId);
      const newRecord: DayRecord = {
        date,
        completedTaskIds: alreadyDone
          ? existing.completedTaskIds.filter((id) => id !== taskId)
          : [...existing.completedTaskIds, taskId],
      };
      return {
        ...prev,
        records: { ...prev.records, [date]: newRecord },
      };
    });
  }, []);

  const isTaskCompleted = useCallback(
    (date: string, taskId: string) => {
      return data.records[date]?.completedTaskIds.includes(taskId) ?? false;
    },
    [data.records]
  );

  const importDataFn = useCallback((newData: TrackerData) => {
    setData(newData);
  }, []);

  return (
    <TrackerContext.Provider
      value={{
        data,
        addTask,
        updateTask,
        deleteTask,
        toggleTask,
        isTaskCompleted,
        importData: importDataFn,
        selectedDate,
        setSelectedDate,
        today,
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
