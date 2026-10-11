import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Lock, User, Eye, EyeOff, LogIn, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface AuthScreenProps {
  onAuthSuccess?: () => void;
}

type AuthMode = "login" | "signup" | "reset";

export function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const { signUp, signIn, resetPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || (!password && mode !== "reset")) {
      toast({
        title: "Missing information",
        description: mode === "reset"
          ? "Please enter your email address."
          : "Please enter your email and password.",
        variant: "destructive"
      });
      return;
    }

    if (mode === "signup" && !displayName.trim()) {
      toast({
        title: "Missing name",
        description: "Please enter your display name.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      if (mode === "signup") {
        await signUp(email, password, displayName);
        toast({
          title: "Welcome!",
          description: "Your account has been created successfully."
        });
      } else if (mode === "login") {
        await signIn(email, password);
        toast({
          title: "Welcome back!",
          description: "You've been signed in successfully."
        });
      } else if (mode === "reset") {
        await resetPassword(email);
        toast({
          title: "Reset email sent",
          description: "Check your email for password reset instructions."
        });
        setMode("login");
        return;
      }
      onAuthSuccess?.();
    } catch (error) {
      toast({
        title: mode === "signup" ? "Signup failed" : mode === "login" ? "Login failed" : "Reset failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive"
      });
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
            <CardTitle className="text-2xl font-bold">
              {mode === "signup" ? "Create Account" : mode === "reset" ? "Reset Password" : "Welcome Back"}
            </CardTitle>
            <CardDescription>
              {mode === "signup"
                ? "Start tracking your daily progress"
                : mode === "reset"
                  ? "Enter your email to reset your password"
                  : "Sign in to continue to your tracker"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
              <span className="flex-shrink-0">🔒</span>
              <span>Your goals and journals are end-to-end encrypted with a separate passphrase you'll set after signing in.</span>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="displayName"
                      type="text"
                      placeholder="Your name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="pl-10"
                      autoComplete="name"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              {mode !== "reset" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={() => setMode("reset")}
                        className="text-sm text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      required
                      minLength={mode === "signup" ? 6 : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {mode === "signup" ? "Creating account..." : mode === "reset" ? "Sending..." : "Signing in..."}
                  </>
                ) : mode === "signup" ? (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create Account
                  </>
                ) : mode === "reset" ? (
                  "Send Reset Email"
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In
                  </>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2 text-center text-sm">
            {mode === "login" ? (
              <>
                <span className="text-muted-foreground">Don't have an account?</span>
                <button
                  onClick={() => setMode("signup")}
                  className="text-primary hover:underline font-medium"
                >
                  Create one
                </button>
              </>
            ) : mode === "signup" ? (
              <>
                <span className="text-muted-foreground">Already have an account?</span>
                <button
                  onClick={() => setMode("login")}
                  className="text-primary hover:underline font-medium"
                >
                  Sign in
                </button>
              </>
            ) : (
              <button
                onClick={() => setMode("login")}
                className="text-primary hover:underline font-medium"
              >
                Back to login
              </button>
            )}
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}