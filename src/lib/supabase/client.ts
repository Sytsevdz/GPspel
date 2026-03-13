import { supabaseAnonKey, supabaseUrl } from "./env";

export const createBrowserSupabaseClient = () => {
  const { createClient } = require("@supabase/supabase-js");

  return createClient(supabaseUrl, supabaseAnonKey);
};
