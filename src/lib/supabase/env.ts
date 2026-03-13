const getRequiredEnv = (name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing env.${name}`);
  }

  return value;
};

export const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
export const supabaseAnonKey = getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
