"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase";

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

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) {
    redirect(toRedirectUrl("/login", "error", "Email and password are required."));
  }

  const supabase = createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(toRedirectUrl("/login", "error", getAuthErrorMessage(error.message)));
  }

  redirect("/dashboard");
}

export async function register(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) {
    redirect(toRedirectUrl("/register", "error", "Email and password are required."));
  }

  if (password.length < 6) {
    redirect(toRedirectUrl("/register", "error", "Password must be at least 6 characters."));
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    redirect(toRedirectUrl("/register", "error", getAuthErrorMessage(error.message)));
  }

  if (data.session) {
    redirect("/dashboard");
  }

  redirect(toRedirectUrl("/login", "message", "Account created. Check your email to verify your account."));
}

export async function logout() {
  const supabase = createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect(toRedirectUrl("/login", "message", "Logged out successfully."));
}
