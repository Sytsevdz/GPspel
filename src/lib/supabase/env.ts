const getRequiredEnv = (name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing env.${name}`);
  }

  return value;
};

const normalizeSiteUrl = (value: string) => {
  return value.startsWith("http") ? value : `https://${value}`;
};

export const getSiteUrl = () => {
  const explicitSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (explicitSiteUrl) {
    return normalizeSiteUrl(explicitSiteUrl);
  }

  const vercelUrl = process.env.VERCEL_URL;

  if (vercelUrl) {
    return normalizeSiteUrl(vercelUrl);
  }

  return "http://localhost:3000";
};

export const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
export const supabaseAnonKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
