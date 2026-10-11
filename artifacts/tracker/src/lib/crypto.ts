/**
 * Client-side encryption for goal/journal content.
 * Uses Web Crypto API (PBKDF2 + AES-GCM) with a user-supplied passphrase.
 * Passphrase never leaves the browser; key is derived per session.
 */

// Derivation params (OWASP 2024 recommendation for PBKDF2-SHA256)
const PBKDF2_ITERATIONS = 600_000;
const RECOVERY_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

/** Fixed verifier string — encrypted once at setup to validate passphrase on unlock. */
const VERIFIER_PLAINTEXT = "daytrack-verifier-v1";

export interface EncryptedPayload {
  /** Base64url salt for key derivation */
  s: string;
  /** Base64url IV (nonce) */
  v: string;
  /** Base64url ciphertext || authTag */
  c: string;
  /** Version for future migrations */
  ver: 1;
}

/** Convert ArrayBuffer → base64url (no padding, URL-safe) */
function toB64Url(buf: ArrayBuffer | Uint8Array<ArrayBuffer>): string {
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64url → ArrayBuffer */
function fromB64Url(str: string): ArrayBuffer {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const buf = new ArrayBuffer(bin.length);
  new Uint8Array(buf).set(bin.split("").map((c) => c.charCodeAt(0)));
  return buf;
}

/**
 * Derive an AES-GCM key from passphrase + salt via PBKDF2.
 * Uses Web Crypto API (native, no extra deps).
 */
async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    false, // not extractable
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a plaintext string.
 * Returns {s, v, c, ver} object ready for JSON.stringify.
 */
export async function encrypt(plaintext: string, passphrase: string): Promise<EncryptedPayload> {
  if (!plaintext) return { s: "", v: "", c: "", ver: 1 }; // empty stays empty

  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(passphrase, salt);

  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
  const ctArr = new Uint8Array(ct);

  return {
    s: toB64Url(salt),
    v: toB64Url(iv),
    c: toB64Url(ctArr),
    ver: 1,
  };
}

/**
 * Decrypt an EncryptedPayload back to plaintext.
 * Throws on auth failure (wrong passphrase or tampered data).
 */
export async function decrypt(payload: EncryptedPayload, passphrase: string): Promise<string> {
  if (!payload.c) return ""; // empty
  if (payload.ver !== 1) throw new Error(`Unsupported encryption version: ${payload.ver}`);

  const salt = new Uint8Array(fromB64Url(payload.s));
  const iv = new Uint8Array(fromB64Url(payload.v));
  const ct = new Uint8Array(fromB64Url(payload.c));
  const key = await deriveKey(passphrase, salt);

  try {
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error("Decryption failed — wrong passphrase or corrupted data");
  }
}

/**
 * Simple check: does the passphrase produce a valid key for this payload?
 * Used for "unlock" UI without fully decrypting large blobs.
 */
export async function verifyPassphrase(payload: EncryptedPayload, passphrase: string): Promise<boolean> {
  if (!payload.c) return true; // empty — no passphrase needed
  try {
    await decrypt(payload, passphrase);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a random recovery key (base64url 32 bytes = 256 bits entropy).
 * User should save this offline (paper/manager) for account recovery.
 */
export function generateRecoveryKey(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return toB64Url(buf);
}

/**
 * Recovery model: the recovery key is a random 256-bit secret shown ONCE at
 * setup. Two ciphertext blobs tie it to the account without revealing anything:
 *
 *   1. `verifier = encrypt(VERIFIER, passphrase)` — checks passphrase/escrow on unlock.
 *   2. `escrow  = encrypt(passphrase, keyFrom(recoveryKey))` — recovery path.
 *
 * Unlock with recovery key:
 *   1. derive `keyFrom(recoveryKey)`,
 *   2. `passphrase = decrypt(escrow, keyFrom(recoveryKey))`,
 *   3. `verifyPassphrase(verifier, passphrase)` — rejects wrong keys loudly.
 *
 * Server/admin sees only ciphertext. No plaintext ever leaves the browser.
 */
export async function passphraseFromRecoveryKey(
  recoveryKey: string,
  escrowCiphertext: EncryptedPayload,
): Promise<string> {
  const normalized = recoveryKey.trim().replace(/\s+/g, "");
  if (!normalized) throw new Error("Recovery key is empty.");
  const key = await deriveRecoveryKey(normalized);
  try {
    const passphrase = await decrypt(escrowCiphertext, key);
    return passphrase;
  } catch {
    throw new Error("Recovery key does not match this account.");
  }
}


/** KDF: recovery key string -> symmetric key material (also reused for escrow encrypt). */
export async function deriveRecoveryKey(recoveryKey: string): Promise<string> {
  const normalized = recoveryKey.trim().replace(/\s+/g, "");
  if (!normalized) throw new Error("Recovery key is empty.");
  let raw: ArrayBuffer;
  try {
    raw = fromB64Url(normalized);
  } catch {
    throw new Error("Recovery key is not in the expected format.");
  }
  if (raw.byteLength < 16) throw new Error("Recovery key is not in the expected format.");
  const salt = new Uint8Array(raw).slice(0, 16);
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(normalized),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: RECOVERY_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return toB64Url(bits);
}

/** Create the setup-time verifier + escrow blobs. Call once per new passphrase. */
export async function createSetupBlobs(
  passphrase: string,
  recoveryKey: string,
): Promise<{ verifier: EncryptedPayload; escrow: EncryptedPayload }> {
  const verifier = await encrypt(VERIFIER_PLAINTEXT, passphrase);
  const recoveryKeyMaterial = await deriveRecoveryKey(recoveryKey);
  const escrow = await encrypt(passphrase, recoveryKeyMaterial);
  return { verifier, escrow };
}

/** True iff `candidate` decrypts the stored verifier for THIS account. */
export async function verifyAgainstStored(
  verifier: EncryptedPayload,
  candidate: string,
): Promise<boolean> {
  try {
    const pt = await decrypt(verifier, candidate);
    return pt === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
}

/**
 * Quick check whether a Firestore string value is our EncryptedPayload format.
 * Plaintext strings will fail this and can be migrated.
 */
export function isEncryptedValue(v: unknown): boolean {
  if (typeof v !== "string" || !v) return false;
  try {
    const parsed = JSON.parse(v) as Record<string, unknown>;
    return (
      parsed.ver === 1 &&
      typeof parsed.s === "string" &&
      typeof parsed.v === "string" &&
      typeof parsed.c === "string"
    );
  } catch {
    return false;
  }
}

/** Parse a JSON string payload into EncryptedPayload, or null if not our format. */
export function parseEncryptedPayload(v: unknown): EncryptedPayload | null {
  if (!isEncryptedValue(v)) return null;
  return JSON.parse(v as string) as EncryptedPayload;
}