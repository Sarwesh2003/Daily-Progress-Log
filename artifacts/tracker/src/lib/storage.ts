export interface Task {
  id: string;
  name: string;
  category: string;
  color: string;
  createdAt: string;
}

export interface DayRecord {
  date: string; // YYYY-MM-DD
  completedTaskIds: string[];
}

export interface TrackerData {
  tasks: Task[];
  records: Record<string, DayRecord>; // keyed by YYYY-MM-DD
  version: number;
}

const STORAGE_KEY = "achievement-tracker-data";
const CURRENT_VERSION = 1;

function getDefaultData(): TrackerData {
  return {
    tasks: [],
    records: {},
    version: CURRENT_VERSION,
  };
}

export function loadData(): TrackerData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultData();
    const parsed = JSON.parse(raw) as TrackerData;
    if (!parsed.version) {
      return getDefaultData();
    }
    return parsed;
  } catch {
    return getDefaultData();
  }
}

export function saveData(data: TrackerData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // quota exceeded or private mode — fail silently
  }
}

export function generateSyncCode(data: TrackerData): string {
  const json = JSON.stringify(data);
  return btoa(encodeURIComponent(json));
}

export function parseSyncCode(code: string): TrackerData {
  const json = decodeURIComponent(atob(code.trim()));
  const parsed = JSON.parse(json) as TrackerData;
  if (!parsed.tasks || !parsed.records) {
    throw new Error("Invalid sync code");
  }
  return { ...parsed, version: CURRENT_VERSION };
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function getWeekDates(date: Date): string[] {
  const day = date.getDay(); // 0=Sun
  const mon = new Date(date);
  mon.setDate(date.getDate() - ((day + 6) % 7)); // Monday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return formatDate(d);
  });
}

export function getMonthDates(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const dates: string[] = [];
  for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
    dates.push(formatDate(new Date(d)));
  }
  return dates;
}

export function computeStats(
  tasks: Task[],
  records: Record<string, DayRecord>,
  dates: string[]
): { completed: number; total: number; rate: number } {
  if (tasks.length === 0 || dates.length === 0) {
    return { completed: 0, total: 0, rate: 0 };
  }
  let completed = 0;
  let total = 0;
  for (const date of dates) {
    const record = records[date];
    total += tasks.length;
    if (record) {
      completed += record.completedTaskIds.length;
    }
  }
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, rate };
}

export const TASK_COLORS = [
  { label: "Violet", value: "violet", bg: "bg-violet-500", light: "bg-violet-100 text-violet-700", border: "border-violet-300" },
  { label: "Blue", value: "blue", bg: "bg-blue-500", light: "bg-blue-100 text-blue-700", border: "border-blue-300" },
  { label: "Green", value: "green", bg: "bg-green-500", light: "bg-green-100 text-green-700", border: "border-green-300" },
  { label: "Amber", value: "amber", bg: "bg-amber-500", light: "bg-amber-100 text-amber-700", border: "border-amber-300" },
  { label: "Rose", value: "rose", bg: "bg-rose-500", light: "bg-rose-100 text-rose-700", border: "border-rose-300" },
  { label: "Teal", value: "teal", bg: "bg-teal-500", light: "bg-teal-100 text-teal-700", border: "border-teal-300" },
  { label: "Orange", value: "orange", bg: "bg-orange-500", light: "bg-orange-100 text-orange-700", border: "border-orange-300" },
  { label: "Pink", value: "pink", bg: "bg-pink-500", light: "bg-pink-100 text-pink-700", border: "border-pink-300" },
];

export function getColorInfo(colorValue: string) {
  return TASK_COLORS.find((c) => c.value === colorValue) ?? TASK_COLORS[0];
}
