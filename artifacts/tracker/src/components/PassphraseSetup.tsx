import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Copy, Check, AlertTriangle, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useCrypto } from "@/context/CryptoContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { generateRecoveryKey, createSetupBlobs } from "@/lib/crypto";
import { setCryptoMeta } from "@/lib/firestore-service";

interface PassphraseSetupProps {
  onComplete: () => void;
}

export function PassphraseSetup({ onComplete }: PassphraseSetupProps) {
  const { unlock } = useCrypto();
  const { user } = useAuth();
  const { toast } = useToast();
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState("");
  const [pendingPassphrase, setPendingPassphrase] = useState("");
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"passphrase" | "recovery">("passphrase");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passphrase || !confirmPassphrase) {
      toast({ title: "Missing passphrase", description: "Please fill in both fields.", variant: "destructive" });
      return;
    }
    if (passphrase !== confirmPassphrase) {
      toast({ title: "Mismatch", description: "Passphrases do not match.", variant: "destructive" });
      return;
    }
    if (passphrase.length < 12) {
      toast({ title: "Too short", description: "Passphrase must be at least 12 characters.", variant: "destructive" });
      return;
    }
    if (!user) {
      toast({ title: "Error", description: "No authenticated user.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // Generate recovery key and create verifier + escrow blobs
      const rk = generateRecoveryKey();
      const { verifier, escrow } = await createSetupBlobs(passphrase, rk);

      // Store in Firestore (ciphertext only)
      await setCryptoMeta(user.uid, {
        verifier: JSON.stringify(verifier),
        escrow: JSON.stringify(escrow),
        ver: 1,
      });

      // Verify the write succeeded by reading it back
      const { getCryptoMeta } = await import("@/lib/firestore-service");
      const meta = await getCryptoMeta(user.uid);
      if (!meta) throw new Error("Setup wrote but could not verify. Check Firestore rules.");

      // Don't unlock yet — show recovery key first and unlock only after user confirms save
      setPendingPassphrase(passphrase);
      setRecoveryKey(rk);
      setStep("recovery");
    } catch (e) {
      toast({ title: "Setup failed", description: e instanceof Error ? e.message : "Failed to set passphrase — check connection/rules.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoveryComplete = () => {
    // Now unlock with the passphrase user just created
    if (pendingPassphrase) {
      unlock(pendingPassphrase);
    }
    onComplete();
  };

  const copyRecoveryKey = () => {
    navigator.clipboard.writeText(recoveryKey);
    toast({ title: "Copied", description: "Recovery key copied to clipboard." });
  };

  if (step === "passphrase") {
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
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold">Set Up Encryption</CardTitle>
              <CardDescription>
                Create a passphrase to encrypt your goals and journals. This is separate from your login password and cannot be reset by email.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="passphrase">Passphrase</Label>
                  <div className="relative">
                    <Input
                      id="passphrase"
                      type={showPassphrase ? "text" : "password"}
                      placeholder="At least 12 characters"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      className="pr-10"
                      autoComplete="new-password"
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
                <div className="space-y-2">
                  <Label htmlFor="confirmPassphrase">Confirm Passphrase</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassphrase"
                      type={showPassphrase ? "text" : "password"}
                      placeholder="Re-enter passphrase"
                      value={confirmPassphrase}
                      onChange={(e) => setConfirmPassphrase(e.target.value)}
                      className="pr-10"
                      autoComplete="new-password"
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
                <p className="text-xs text-muted-foreground">
                  <AlertTriangle className="w-3 h-3 inline mr-1" /> This passphrase cannot be recovered if lost.
                  You will receive a one-time recovery key on the next screen — save it securely.
                </p>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Setting up…
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Create Passphrase
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col space-y-2 text-center text-sm">
              <p className="text-muted-foreground">
                By continuing, you acknowledge that losing both your passphrase and recovery key
                means your encrypted data is permanently unreadable.
              </p>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Recovery key step
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
            <div className="mx-auto w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-3">
              <Shield className="w-6 h-6 text-amber-600 dark:text-amber-300" />
            </div>
            <CardTitle className="text-2xl font-bold">Your Recovery Key</CardTitle>
            <CardDescription>
              This is the <strong>only time</strong> you'll see it. Save it now.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-xl border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recovery Key</span>
                <Button variant="ghost" size="icon" onClick={copyRecoveryKey} className="h-7 w-7">
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
              <code className="text-sm font-mono break-all bg-background p-2 rounded block" data-testid="recovery-key-display">
                {recoveryKey}
              </code>
            </div>
            <p className="text-xs text-muted-foreground">
              <AlertTriangle className="w-3 h-3 inline mr-1" /> Store this in a password manager or write it down.
              Anyone with this key can decrypt your data.
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={recoveryConfirmed}
                onChange={(e) => setRecoveryConfirmed(e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-foreground">I have saved this recovery key securely</span>
            </label>
            <Button onClick={handleRecoveryComplete} className="w-full" disabled={!recoveryConfirmed}>
              <Check className="w-4 h-4 mr-2" />
              Continue to App
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}