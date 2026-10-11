import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { Task, TrackerData } from "@/lib/storage";
import { isEncryptedValue, parseEncryptedPayload, decrypt, encrypt } from "./crypto";

// --- Collection helpers (UID-scoped, never trust client paths elsewhere) ---

export function getUserGoalsCollection(uid: string) {
  return collection(db, "users", uid, "goals");
}

export function getUserCheckinsCollection(uid: string) {
  return collection(db, "users", uid, "checkins");
}

export function getUserJournalsCollection(uid: string) {
  return collection(db, "users", uid, "journals");
}

// Firestore stores server Timestamps; normalize to ISO strings for the UI.
function toISO(v: unknown): string {
  if (v && typeof v === "object" && "toDate" in (v as Record<string, unknown>)) {
    try {
      return ((v as { toDate: () => Date }).toDate()).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
  if (typeof v === "string") return v;
  return new Date().toISOString();
}

// --- Encryption helpers (service owns encryption so callers just pass passphrase) ---

async function maybeEncrypt(v: string | undefined, passphrase: string | undefined): Promise<string> {
  if (!passphrase || !v) return v ?? "";
  const payload = await encrypt(v, passphrase);
  return JSON.stringify(payload);
}

function normalizeTask(id: string, raw: Record<string, unknown>): Task {
  return {
    id,
    name: String(raw.name ?? ""),
    category: String(raw.category ?? ""),
    color: String(raw.color ?? "violet"),
    createdAt: toISO(raw.createdAt),
    description: typeof raw.description === "string" ? raw.description : undefined,
    isArchived: raw.isArchived === true,
  };
}

// --- Goals ---

export async function createGoal(
  uid: string,
  goal: { name: string; category: string; color: string; createdAt: string; description?: string },
  passphrase?: string
): Promise<Task> {
  const ref = doc(getUserGoalsCollection(uid));
  await setDoc(ref, {
    name: await maybeEncrypt(goal.name, passphrase),
    category: await maybeEncrypt(goal.category, passphrase),
    color: goal.color,
    description: await maybeEncrypt(goal.description, passphrase),
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return {
    id: ref.id,
    name: goal.name,
    category: goal.category,
    color: goal.color,
    createdAt: goal.createdAt,
    description: goal.description,
    isArchived: false,
  };
}

export async function updateGoal(
  uid: string,
  id: string,
  updates: { name?: string; category?: string; color?: string; description?: string; isArchived?: boolean },
  passphrase?: string
) {
  const ref = doc(getUserGoalsCollection(uid), id);
  const toUpdate: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (updates.name !== undefined) toUpdate.name = await maybeEncrypt(updates.name, passphrase);
  if (updates.category !== undefined) toUpdate.category = await maybeEncrypt(updates.category, passphrase);
  if (updates.color !== undefined) toUpdate.color = updates.color;
  if (updates.description !== undefined) toUpdate.description = await maybeEncrypt(updates.description, passphrase);
  if (updates.isArchived !== undefined) toUpdate.isArchived = updates.isArchived;
  await updateDoc(ref, toUpdate);
}

export async function deleteGoal(uid: string, id: string) {
  const ref = doc(getUserGoalsCollection(uid), id);
  await deleteDoc(ref);
  const q = query(getUserCheckinsCollection(uid), where("goalId", "==", id));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function getUserGoals(uid: string, passphrase?: string): Promise<Task[]> {
  const snap = await getDocs(query(getUserGoalsCollection(uid)));
  const tasks = snap.docs.map((d) => {
    const raw = d.data() as Record<string, unknown>;
    return normalizeTask(d.id, raw);
  });
  if (passphrase) {
    for (const t of tasks) {
      if (isEncryptedValue(t.name)) {
        t.name = await decrypt(parseEncryptedPayload(t.name)!, passphrase);
      }
      if (isEncryptedValue(t.category)) {
        t.category = await decrypt(parseEncryptedPayload(t.category)!, passphrase);
      }
      if (isEncryptedValue(t.description)) {
        t.description = await decrypt(parseEncryptedPayload(t.description!)!, passphrase);
      }
    }
  }
  tasks.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return tasks;
}

// --- Check-ins (deterministic id: {goalId}_{date}) ---

export function getCheckinDocId(goalId: string, date: string): string {
  return `${goalId}_${date}`;
}

export async function createOrUpdateCheckin(
  uid: string,
  goalId: string,
  date: string,
  completed: boolean
) {
  const ref = doc(getUserCheckinsCollection(uid), getCheckinDocId(goalId, date));
  if (completed) {
    await setDoc(ref, {
      goalId,
      date,
      completed: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await deleteDoc(ref);
  }
}

export interface CheckinRecord {
  goalId: string;
  date: string;
  completed: boolean;
}

export async function getCheckinsForDate(uid: string, date: string): Promise<Record<string, boolean>> {
  const q = query(getUserCheckinsCollection(uid), where("date", "==", date));
  const snap = await getDocs(q);
  const result: Record<string, boolean> = {};
  snap.forEach((d) => {
    const data = d.data() as { goalId: string; completed: boolean };
    result[data.goalId] = data.completed;
  });
  return result;
}

export async function getAllCheckins(uid: string): Promise<CheckinRecord[]> {
  const snap = await getDocs(query(getUserCheckinsCollection(uid)));
  return snap.docs.map((d) => {
    const data = d.data() as { goalId: string; date: string; completed: boolean };
    return { goalId: data.goalId, date: data.date, completed: data.completed !== false };
  });
}

// --- Journals (doc id = YYYY-MM-DD) ---

export async function createOrUpdateJournal(uid: string, date: string, content: string, passphrase?: string) {
  const ref = doc(getUserJournalsCollection(uid), date);
  await setDoc(
    ref,
    { date, content: await maybeEncrypt(content, passphrase), updatedAt: serverTimestamp(), createdAt: serverTimestamp() },
    { merge: true }
  );
}

export async function getJournal(uid: string, date: string, passphrase?: string): Promise<string | null> {
  const ref = doc(getUserJournalsCollection(uid), date);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as { content?: unknown };
  const raw = typeof data.content === "string" ? data.content : "";
  if (!passphrase || !isEncryptedValue(raw)) return raw;
  return decrypt(parseEncryptedPayload(raw)!, passphrase);
}

export async function deleteJournal(uid: string, date: string) {
  await deleteDoc(doc(getUserJournalsCollection(uid), date));
}

// --- Migration (legacy localStorage -> Firestore, idempotent) ---

const LEGACY_KEY = "achievement-tracker-data";

export function hasLocalDataToMigrate(): boolean {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as TrackerData;
    return (
      (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) ||
      (parsed.records != null && Object.keys(parsed.records).length > 0)
    );
  } catch {
    return false;
  }
}

export function readLegacyData(): TrackerData | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TrackerData;
    if (!Array.isArray(parsed.tasks) || typeof parsed.records !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function migrateLocalData(uid: string, localData: TrackerData) {
  const batch = writeBatch(db);
  const goalIdMap = new Map<string, string>();

  for (const task of localData.tasks) {
    const ref = doc(getUserGoalsCollection(uid));
    goalIdMap.set(task.id, ref.id);
    batch.set(ref, {
      name: task.name,
      category: task.category ?? "",
      color: task.color ?? "violet",
      description: "",
      isArchived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  for (const [dateStr, record] of Object.entries(localData.records ?? {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;
    for (const oldTaskId of record.completedTaskIds ?? []) {
      const newGoalId = goalIdMap.get(oldTaskId);
      if (!newGoalId) continue;
      const ref = doc(getUserCheckinsCollection(uid), `${newGoalId}_${dateStr}`);
      batch.set(ref, {
        goalId: newGoalId,
        date: dateStr,
        completed: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  }

  await batch.commit();
}

export function clearLocalData() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw) {
      localStorage.setItem(`${LEGACY_KEY}-backup`, raw);
      localStorage.removeItem(LEGACY_KEY);
    }
  } catch {}
}

// --- Encryption migration (legacy plaintext -> encrypted) ---

export async function encryptExistingData(uid: string, passphrase: string) {
  const goalsSnap = await getDocs(query(getUserGoalsCollection(uid)));
  const goalBatch = writeBatch(db);
  let hasGoalUpdates = false;
  for (const docSnap of goalsSnap.docs) {
    const data = docSnap.data() as Record<string, unknown>;
    if (isEncryptedValue(data.name) || isEncryptedValue(data.category) || isEncryptedValue(data.description)) continue;
    // Only update if there's something to encrypt
    const name = data.name as string;
    const cat = data.category as string;
    const desc = (data.description as string) ?? "";
    if (!name && !cat && !desc) continue;
    hasGoalUpdates = true;
    goalBatch.update(docSnap.ref, {
      name: await maybeEncrypt(name, passphrase),
      category: await maybeEncrypt(cat, passphrase),
      description: await maybeEncrypt(desc, passphrase),
      updatedAt: serverTimestamp(),
    });
  }
  if (hasGoalUpdates) await goalBatch.commit();
  else { /* cancel empty batch - set a no-op so Firestore doesn't complain */ }

  const journalsSnap = await getDocs(query(getUserJournalsCollection(uid)));
  const journalBatch = writeBatch(db);
  let hasJournalUpdates = false;
  for (const docSnap of journalsSnap.docs) {
    const data = docSnap.data() as { content?: unknown };
    const content = typeof data.content === "string" ? data.content : "";
    if (!content || isEncryptedValue(content)) continue;
    hasJournalUpdates = true;
    journalBatch.update(docSnap.ref, {
      content: await maybeEncrypt(content, passphrase),
      updatedAt: serverTimestamp(),
    });
  }
  if (hasJournalUpdates) await journalBatch.commit();
}

// --- Encryption setup metadata (verifier + recovery escrow, ciphertext only) ---

export interface CryptoMeta {
  /** encrypt(VERIFIER, passphrase) — proves a candidate passphrase for this account. */
  verifier: string;
  /** encrypt(passphrase, recoveryDerivedKey) — recovery path; never plaintext. */
  escrow: string;
  ver: 1;
}

export function getCryptoMetaDoc(uid: string) {
  return doc(db, "users", uid, "meta", "crypto");
}

export async function getCryptoMeta(uid: string): Promise<CryptoMeta | null> {
  const snap = await getDoc(getCryptoMetaDoc(uid));
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<CryptoMeta>;
  if (typeof data.verifier !== "string" || typeof data.escrow !== "string") return null;
  return { verifier: data.verifier, escrow: data.escrow, ver: 1 };
}

export async function setCryptoMeta(uid: string, meta: CryptoMeta): Promise<void> {
  await setDoc(getCryptoMetaDoc(uid), meta);
}
