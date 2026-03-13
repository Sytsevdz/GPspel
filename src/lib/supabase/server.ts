import { supabaseAnonKey, supabaseUrl } from "./env";

export const createServerSupabaseClient = () => {
  const { createClient } = require("@supabase/supabase-js");

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
};
