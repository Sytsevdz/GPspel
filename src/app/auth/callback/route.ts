import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase";
import { getSiteUrl } from "@/lib/supabase/env";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = requestUrl.searchParams.get("next");
  const safeNextPath = nextPath?.startsWith("/") ? nextPath : "/dashboard";

  if (code) {
    const supabase = createServerSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const redirectUrl = new URL(safeNextPath, getSiteUrl());
  return NextResponse.redirect(redirectUrl);
}
