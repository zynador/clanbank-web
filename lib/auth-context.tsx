"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

// Profile type matching the profiles table
export interface Profile {
  id: string;
  username: string;
  display_name: string;
  ingame_name: string;
  role: "admin" | "offizier" | "mitglied";
  clan_id: string;
  created_at: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (params: SignUpParams) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

interface SignUpParams {
  email: string;
  password: string;
  inviteCode: string;
  username: string;
  displayName: string;
  ingameName: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch the profile from the profiles table
  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Fehler beim Laden des Profils:", error.message);
      return null;
    }
    return data as Profile;
  }

  // Refresh profile (callable from outside)
  async function refreshProfile() {
    if (user) {
      const p = await fetchProfile(user.id);
      setProfile(p);
    }
  }

  // Initialize session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).then(setProfile);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).then(setProfile);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sign in with email + password
  async function signIn(
    email: string,
    password: string
  ): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error.message };
    }
    return { error: null };
  }

  // Sign up: validate code → create auth user → redeem code (creates profile)
  async function signUp(params: SignUpParams): Promise<{ error: string | null }> {
    const { email, password, inviteCode, username, displayName, ingameName } =
      params;

    // Step 1: Validate the invite code
    const { data: validation, error: valError } = await supabase.rpc(
      "validate_invite_code",
      { input_code: inviteCode }
    );

    if (valError) {
      return { error: "Fehler bei der Code-Prüfung: " + valError.message };
    }

    if (!validation.valid) {
      return { error: validation.message || "Ungültiger Einladungscode" };
    }

    // Step 2: Create auth user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: displayName,
        },
      },
    });

    if (authError) {
      // Map common Supabase Auth errors to German
      if (authError.message.includes("already registered")) {
        return { error: "Diese E-Mail-Adresse ist bereits registriert." };
      }
      if (authError.message.includes("password")) {
        return {
          error: "Passwort muss mindestens 6 Zeichen lang sein.",
        };
      }
      return { error: "Registrierung fehlgeschlagen: " + authError.message };
    }

    if (!authData.user) {
      return { error: "Benutzer konnte nicht erstellt werden." };
    }

    // Step 3: Redeem invite code → creates profile + marks code as used
    const { data: redemption, error: redeemError } = await supabase.rpc(
      "redeem_invite_code",
      {
        input_code: inviteCode,
        input_user_id: authData.user.id,
        input_username: username,
        input_display_name: displayName,
        input_ingame_name: ingameName,
      }
    );

    if (redeemError) {
      return {
        error: "Code-Einlösung fehlgeschlagen: " + redeemError.message,
      };
    }

    if (!redemption.success) {
      return {
        error:
          redemption.message ||
          "Code konnte nicht eingelöst werden. Bitte kontaktiere einen Admin.",
      };
    }

    return { error: null };
  }

  // Sign out
  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth muss innerhalb von AuthProvider verwendet werden");
  }
  return context;
}
