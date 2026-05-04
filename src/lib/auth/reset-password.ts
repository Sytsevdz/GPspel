import { getSiteUrl } from "@/lib/supabase/env";

export const getPasswordResetRedirectUrl = () => {
  const siteUrl = getSiteUrl();

  if (siteUrl.includes("localhost") || siteUrl.includes("127.0.0.1")) {
    return `${siteUrl}/nieuw-wachtwoord`;
  }

  return "https://gpspel.vercel.app/nieuw-wachtwoord";
};
