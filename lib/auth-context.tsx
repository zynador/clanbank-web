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

  // Sign up: validate code → create auth user → register with code (creates profile)
  async function signUp(params: SignUpParams): Promise<{ error: string | null }> {
    const { email, password, inviteCode, username, displayName, ingameName } =
      params;

    // Step 1: Validate the invite code
    // FIXED: was "validate_invite_code", DB function is "validate_clan_code"
    const { data: validation, error: valError } = await supabase.rpc(
      "validate_clan_code",
      { input_code: inviteCode }
    );

    if (valError) {
      return { error: "Fehler bei der Code-Prüfung: " + valError.message };
    }

    if (!validation.valid) {
      return { error: validation.error || "Ungültiger Einladungscode" };
    }

    // Step 2: Create auth user in Supabase Auth
    const fakeEmail = username.toLowerCase().replace(/[^a-z0-9]/g, "") + "@clanbank.local";
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: fakeEmail,
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

    // Step 3: Register with clan code → creates profile via auth.uid()
    // FIXED: was "redeem_invite_code" with 5 params
    // DB function is "register_with_clan_code" with 3 params (uses auth.uid() internally)
    const { data: registration, error: regError } = await supabase.rpc(
      "register_with_clan_code",
      {
        input_code: inviteCode,
        input_username: username,
        input_ingame_name: ingameName || "",
      }
    );

    if (regError) {
      return {
        error: "Profil-Erstellung fehlgeschlagen: " + regError.message,
      };
    }

    if (!registration.success) {
      return {
        error:
          registration.error ||
          "Profil konnte nicht erstellt werden. Bitte kontaktiere einen Admin.",
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
