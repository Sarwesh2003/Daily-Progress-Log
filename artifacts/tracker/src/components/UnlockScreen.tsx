import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, Loader2, KeyRound, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrypto } from "@/context/CryptoContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getCryptoMeta } from "@/lib/firestore-service";
import { parseEncryptedPayload, verifyAgainstStored, passphraseFromRecoveryKey } from "@/lib/crypto";

interface UnlockScreenProps {
  onUnlock: () => void;
}

export function UnlockScreen({ onUnlock }: UnlockScreenProps) {
  const { unlock, lock } = useCrypto();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<"passphrase" | "recovery">("passphrase");
  const [passphrase, setPassphrase] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleUnlockWithPassphrase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase) {
      toast({ title: "Missing passphrase", description: "Enter your encryption passphrase.", variant: "destructive" });
      return;
    }
    if (!user) {
      toast({ title: "Error", description: "Not authenticated.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      // Verify passphrase against stored verifier
      const meta = await getCryptoMeta(user.uid);
      if (!meta) {
        toast({ title: "No encryption set up", description: "Use recovery key or contact support.", variant: "destructive" });
        return;
      }
      const verifier = parseEncryptedPayload(meta.verifier);
      if (!verifier) throw new Error("Corrupt verifier.");
      const ok = await verifyAgainstStored(verifier, passphrase);
      if (!ok) {
        toast({ title: "Wrong passphrase", description: "The passphrase does not match this account.", variant: "destructive" });
        return;
      }
      unlock(passphrase);
      onUnlock();
    } catch (e) {
      toast({ title: "Unlock failed", description: e instanceof Error ? e.message : "Could not unlock.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlockWithRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryKey.trim()) {
      toast({ title: "Missing recovery key", description: "Paste your recovery key.", variant: "destructive" });
      return;
    }
    if (!user) {
      toast({ title: "Error", description: "Not authenticated.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const meta = await getCryptoMeta(user.uid);
      if (!meta) {
        toast({ title: "No encryption set up", description: "Use recovery key or contact support.", variant: "destructive" });
        return;
      }
      const escrow = parseEncryptedPayload(meta.escrow);
      if (!escrow) throw new Error("Corrupt escrow.");
      const derived = await passphraseFromRecoveryKey(recoveryKey.trim(), escrow);
      unlock(derived);
      onUnlock();
    } catch (e) {
      toast({ title: "Invalid recovery key", description: e instanceof Error ? e.message : "Check the key and try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <Card>
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Unlock Encrypted Data</CardTitle>
            <CardDescription>
              Your goals and journals are end-to-end encrypted. Enter your passphrase to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mode === "passphrase" ? (
              <form onSubmit={handleUnlockWithPassphrase} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="unlock-passphrase">Passphrase</Label>
                  <div className="relative">
                    <Input
                      id="unlock-passphrase"
                      type={showPassphrase ? "text" : "password"}
                      placeholder="Your encryption passphrase"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      className="pr-10"
                      autoComplete="current-password"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Unlocking…
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      Unlock
                    </>
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => setMode("recovery")}
                  className="text-sm text-primary hover:underline block mx-auto"
                >
                  Use recovery key instead
                </button>
              </form>
            ) : (
              <form onSubmit={handleUnlockWithRecovery} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recovery-key">Recovery Key</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="recovery-key"
                      type="text"
                      placeholder="Paste your recovery key"
                      value={recoveryKey}
                      onChange={(e) => setRecoveryKey(e.target.value)}
                      className="pl-10 font-mono text-sm"
                      autoComplete="off"
                      autoFocus
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Unlocking…
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4 mr-2" />
                      Unlock with Recovery Key
                    </>
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => setMode("passphrase")}
                  className="text-sm text-primary hover:underline block mx-auto"
                >
                  Back to passphrase
                </button>
              </form>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-2 text-center text-sm">
            <p className="text-muted-foreground">
              Forgot passphrase? Use your recovery key above, or contact support if you lost both.
            </p>
            <Button variant="ghost" size="sm" onClick={() => { lock(); signOut(); }} className="w-full">
              <LogOut className="w-4 h-4 mr-2" />
              Sign out instead
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}