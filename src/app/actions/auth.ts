"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseActionClient } from "@/lib/supabase";
import { getSiteUrl } from "@/lib/supabase/env";

const fallbackErrorMessage = "Er is iets misgegaan. Probeer het opnieuw.";

const toRedirectUrl = (path: string, key: "error" | "message", value: string) => {
  const params = new URLSearchParams({ [key]: value });
  return `${path}?${params.toString()}`;
};

const getAuthErrorMessage = (message?: string) => {
  if (!message) {
    return fallbackErrorMessage;
  }

  if (message.toLowerCase().includes("invalid login credentials")) {
    return "Ongeldig e-mailadres of wachtwoord.";
  }

  if (message.toLowerCase().includes("email not confirmed")) {
    return "Verifieer eerst je e-mailadres voordat je inlogt.";
  }

  if (message.toLowerCase().includes("already registered")) {
    return "Er bestaat al een account met dit e-mailadres.";
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
    redirect(toRedirectUrl("/login", "error", "E-mailadres en wachtwoord zijn verplicht."));
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
    redirect(toRedirectUrl("/register", "error", "E-mailadres en wachtwoord zijn verplicht."));
  }

  if (password.length < 6) {
    redirect(toRedirectUrl("/register", "error", "Wachtwoord moet minimaal 6 tekens bevatten."));
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
      "Account succesvol aangemaakt. Controleer je e-mail om je account te bevestigen voordat je inlogt.",
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
  redirect(toRedirectUrl("/login", "message", "Je bent succesvol uitgelogd."));
}

const getPasswordResetRedirectUrl = () => {
  const siteUrl = getSiteUrl();

  if (siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1")) {
    return `${siteUrl}/nieuw-wachtwoord`;
  }

  return "https://gpspel.vercel.app/nieuw-wachtwoord";
};

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect(toRedirectUrl("/wachtwoord-vergeten", "error", "Vul een e-mailadres in."));
  }

  const supabase = createServerSupabaseActionClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getPasswordResetRedirectUrl(),
  });

  if (error) {
    redirect(toRedirectUrl("/wachtwoord-vergeten", "error", "Kon geen resetlink versturen. Probeer het opnieuw."));
  }

  redirect(
    toRedirectUrl(
      "/wachtwoord-vergeten",
      "message",
      "Als het e-mailadres bekend is, is er een resetlink verstuurd.",
    ),
  );
}
