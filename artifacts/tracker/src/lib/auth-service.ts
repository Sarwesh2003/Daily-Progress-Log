import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  User as FirebaseUser
} from "firebase/auth";
import { auth } from "./firebase";

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  createdAt?: Date;
}

class AuthService {
  private currentUser: User | null = null;
  private authUnsubscribe: (() => void) | null = null;

  constructor() {
    this.authUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      this.currentUser = firebaseUser ? {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        emailVerified: firebaseUser.emailVerified,
        createdAt: firebaseUser.metadata.creationTime ? new Date(firebaseUser.metadata.creationTime) : undefined
      } : null;
    });
  }

  async signUp(email: string, password: string, displayName?: string): Promise<User> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(userCredential.user, { displayName });
      }
      return this.getCurrentUser()!;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  async signIn(email: string, password: string): Promise<User> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return this.getCurrentUser()!;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  async signOut(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  onAuthStateChange(callback: (user: User | null) => void): () => void {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      const user: User | null = firebaseUser ? {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
        emailVerified: firebaseUser.emailVerified,
        createdAt: firebaseUser.metadata.creationTime ? new Date(firebaseUser.metadata.creationTime) : undefined
      } : null;
      callback(user);
    });
    return unsubscribe;
  }

  cleanup() {
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
      this.authUnsubscribe = null;
    }
  }

  private handleAuthError(error: any): Error {
    console.error("Auth error:", error);
    const errorCode = error.code;
    const errorMessage = error.message;

    switch (errorCode) {
      case "auth/invalid-credential":
      case "auth/invalid-login-credentials":
        return new Error(
          "Incorrect email or password. If you don't have an account yet, use “Create one” to register first."
        );
      case "auth/user-not-found":
        return new Error("No user found with this email address.");
      case "auth/wrong-password":
        return new Error("Incorrect password. Please try again.");
      case "auth/email-already-in-use":
        return new Error("An account with this email already exists.");
      case "auth/weak-password":
        return new Error("Password should be at least 6 characters.");
      case "auth/invalid-email":
        return new Error("Please enter a valid email address.");
      case "auth/too-many-requests":
        return new Error("Too many attempts. Please try again later.");
      default:
        return new Error(errorMessage || "An error occurred during authentication.");
    }
  }
}

export const authService = new AuthService();