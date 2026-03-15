import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase";

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  redirect("/");
}
