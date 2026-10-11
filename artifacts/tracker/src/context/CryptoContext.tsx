import { createContext, useContext, useCallback, useState, ReactNode, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { encrypt, decrypt, parseEncryptedPayload } from "@/lib/crypto";

/**
 * In-memory encryption passphrase state.
 *
 * SECURITY: The passphrase lives only in React state. It is never written to
 * localStorage, Firestore, console, or URLs. Cleared on sign-out (via key change),
 * explicit lock, or tab close.
 */
interface CryptoContextValue {
  /** True once a passphrase is set for this session. */
  isUnlocked: boolean;
  /** Current session passphrase (null when locked). Needed for service calls. */
  passphrase: string | null;
  /** Set passphrase after setup or successful unlock. */
  unlock: (passphrase: string) => void;
  /** Forget passphrase (lock UI without signing out). */
  lock: () => void;
  /** Encrypt one text field; empty/undefined stays empty (no ciphertext overhead). */
  encryptField: (plaintext: string | undefined) => Promise<string>;
  /** Decrypt one Firestore string field; legacy plaintext passes through unchanged. */
  decryptField: (value: unknown) => Promise<string>;
}

const CryptoContext = createContext<CryptoContextValue | null>(null);

export function CryptoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [passphrase, setPassphrase] = useState<string | null>(null);
  // Ref mirrors state so async decrypt callbacks always use the live passphrase
  // without re-subscribing Firestore listeners on every keystroke.
  const keyRef = useRef<string | null>(null);

  // Clear passphrase on sign-out (user becomes null)
  useEffect(() => {
    if (!user) {
      keyRef.current = null;
      setPassphrase(null);
    }
  }, [user]);

  const unlock = useCallback((next: string) => {
    keyRef.current = next;
    setPassphrase(next);
  }, []);

  const lock = useCallback(() => {
    keyRef.current = null;
    setPassphrase(null);
  }, []);

  const encryptField = useCallback(async (plaintext: string | undefined): Promise<string> => {
    const key = keyRef.current;
    if (!plaintext) return "";
    if (!key) throw new Error("Unlock required to save data.");
    const payload = await encrypt(plaintext, key);
    return JSON.stringify(payload);
  }, []);

  const decryptField = useCallback(async (value: unknown): Promise<string> => {
    if (typeof value !== "string" || value === "") return "";
    const payload = parseEncryptedPayload(value);
    // Legacy plaintext (pre-encryption migration): pass through so the
    // unlock flow can detect it and re-encrypt.
    if (!payload) return value;
    const key = keyRef.current;
    if (!key) throw new Error("Unlock required to read data.");
    return decrypt(payload, key);
  }, []);

  return (
    <CryptoContext.Provider
      value={{
        isUnlocked: passphrase !== null,
        passphrase,
        unlock,
        lock,
        encryptField,
        decryptField,
      }}
    >
      {children}
    </CryptoContext.Provider>
  );
}

export function useCrypto() {
  const ctx = useContext(CryptoContext);
  if (!ctx) throw new Error("useCrypto must be used within CryptoProvider");
  return ctx;
}
