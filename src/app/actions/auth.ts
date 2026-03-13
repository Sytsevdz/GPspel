"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseActionClient } from "@/lib/supabase";
import { getSiteUrl } from "@/lib/supabase/env";

const fallbackErrorMessage = "Something went wrong. Please try again.";

const toRedirectUrl = (path: string, key: "error" | "message", value: string) => {
  const params = new URLSearchParams({ [key]: value });
  return `${path}?${params.toString()}`;
};

const getAuthErrorMessage = (message?: string) => {
  if (!message) {
    return fallbackErrorMessage;
  }

  if (message.toLowerCase().includes("invalid login credentials")) {
    return "Invalid email or password.";
  }

  if (message.toLowerCase().includes("email not confirmed")) {
    return "Please verify your email before signing in.";
  }

  if (message.toLowerCase().includes("already registered")) {
    return "An account with this email already exists.";
  }

  return fallbackErrorMessage;
};

const sanitizeDisplayName = (rawValue: FormDataEntryValue | null) => {
  const value = String(rawValue ?? "").trim();

  if (!value) {
    return null;
  }

  return value.slice(0, 50);
};

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) {
    redirect(toRedirectUrl("/login", "error", "Email and password are required."));
  }

  const supabase = createServerSupabaseActionClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(toRedirectUrl("/login", "error", getAuthErrorMessage(error.message)));
  }

  redirect("/dashboard");
}

export async function register(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const displayName = sanitizeDisplayName(formData.get("display_name"));

  if (!email || !password) {
    redirect(toRedirectUrl("/register", "error", "Email and password are required."));
  }

  if (password.length < 6) {
    redirect(toRedirectUrl("/register", "error", "Password must be at least 6 characters."));
  }

  const supabase = createServerSupabaseActionClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: displayName ? { display_name: displayName } : undefined,
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    redirect(toRedirectUrl("/register", "error", getAuthErrorMessage(error.message)));
  }

  if (data.session) {
    redirect("/dashboard");
  }

  redirect(
    toRedirectUrl(
      "/login",
      "message",
      "Account created successfully. Check your email to confirm your account before logging in.",
    ),
  );
}

export async function updateDisplayName(formData: FormData) {
  const displayName = sanitizeDisplayName(formData.get("display_name"));

  if (!displayName) {
    redirect(toRedirectUrl("/profile", "error", "Display name is required."));
  }

  const supabase = createServerSupabaseActionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    redirect(toRedirectUrl("/profile", "error", "Unable to update display name. Please try again."));
  }

  redirect(toRedirectUrl("/profile", "message", "Profile updated."));
}

export async function logout() {
  const supabase = createServerSupabaseActionClient();
  await supabase.auth.signOut();
  redirect(toRedirectUrl("/login", "message", "Logged out successfully."));
}
