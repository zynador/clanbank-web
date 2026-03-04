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
  signIn: (username: string, password: string) => Promise<{ error: string | null }>;
  signUp: (params: SignUpParams) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

interface SignUpParams {
  password: string;
  inviteCode: string;
  username: string;
  displayName: string;
  ingameName: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Generate a fake email from username (Supabase Auth requires an email)
function usernameToEmail(username: string): string {
  return username.toLowerCase().replace(/[^a-z0-9]/g, "") + "@clanbank.local";
}

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

  // Sign in with username + password
  async function signIn(
    username: string,
    password: string
  ): Promise<{ error: string | null }> {
    const fakeEmail = usernameToEmail(username);
    const { error } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password,
    });

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        return { error: "Benutzername oder Passwort ist falsch." };
      }
      return { error: error.message };
    }
    return { error: null };
  }

  // Sign up: validate code → create auth user → register with code (creates profile)
  async function signUp(params: SignUpParams): Promise<{ error: string | null }> {
    const { password, inviteCode, username, displayName, ingameName } = params;

    // Step 1: Validate the invite code
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

    // Step 2: Create auth user in Supabase Auth (with fake email)
    const fakeEmail = usernameToEmail(username);
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
      if (authError.message.includes("already registered")) {
        return { error: "Dieser Benutzername ist bereits vergeben." };
      }
      if (authError.message.includes("password")) {
        return { error: "Passwort muss mindestens 6 Zeichen lang sein." };
      }
      return { error: "Registrierung fehlgeschlagen: " + authError.message };
    }

    if (!authData.user) {
      return { error: "Benutzer konnte nicht erstellt werden." };
    }

    // Step 3: Register with clan code → creates profile via auth.uid()
    const { data: registration, error: regError } = await supabase.rpc(
      "register_with_clan_code",
      {
        input_code: inviteCode,
        input_username: username,
        input_ingame_name: ingameName || "",
      }
    );

    if (regError) {
      return { error: "Profil-Erstellung fehlgeschlagen: " + regError.message };
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
