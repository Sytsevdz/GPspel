import { NextResponse } from "next/server";

import { createServerSupabaseActionClient } from "@/lib/supabase";
import { getSiteUrl } from "@/lib/supabase/env";

const DEFAULT_NEXT_PATH = "/nieuw-wachtwoord";
const RECOVERY_ERROR_MESSAGE = "Deze+resetlink+is+ongeldig+of+verlopen.+Vraag+een+nieuwe+resetlink+aan.";

const sanitizeNextPath = (candidate: string | null) => {
  if (!candidate) {
    return DEFAULT_NEXT_PATH;
  }

  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return DEFAULT_NEXT_PATH;
  }

  return candidate;
};

const toForgotPasswordErrorRedirect = () => {
  const redirectUrl = new URL(`/wachtwoord-vergeten?error=${RECOVERY_ERROR_MESSAGE}`, getSiteUrl());
  return NextResponse.redirect(redirectUrl);
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const safeNextPath = sanitizeNextPath(requestUrl.searchParams.get("next"));

  if (type !== "recovery" || !tokenHash) {
    return toForgotPasswordErrorRedirect();
  }

  const supabase = createServerSupabaseActionClient();
  const { error } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: tokenHash,
  });

  if (error) {
    return toForgotPasswordErrorRedirect();
  }

  const redirectUrl = new URL(safeNextPath, getSiteUrl());
  return NextResponse.redirect(redirectUrl);
}
