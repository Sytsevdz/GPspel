import { createBrowserClient } from "@supabase/ssr";

import { supabaseAnonKey, supabaseUrl } from "./env";

export const createBrowserSupabaseClient = () =>
  createBrowserClient(supabaseUrl, supabaseAnonKey);
