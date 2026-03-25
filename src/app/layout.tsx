import type { Metadata } from "next";
import Link from "next/link";

import { MainNavigation } from "@/app/main-navigation";
import { logout } from "@/app/actions/auth";
import { createServerSupabaseClient } from "@/lib/supabase";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Het betere GP spel",
  description: "Het betere GP spel web app.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle<{ role: string | null }>()
    : { data: null };

  const { data: memberships } = user
    ? await supabase
        .from("league_members")
        .select("league_id")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: true })
        .limit(1)
    : { data: null };

  const isAdmin = profile?.role === "admin";
  const defaultLeagueId = memberships?.[0]?.league_id ?? null;

  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            GP spel
          </Link>

          <nav>
            {user ? (
              <div className="nav-auth">
                <MainNavigation isAdmin={isAdmin} defaultLeagueId={defaultLeagueId} />
                <form action={logout}>
                  <button type="submit" className="link-button">
                    Log out
                  </button>
                </form>
              </div>
            ) : (
              <div className="nav-auth">
                <Link href="/login">Log in</Link>
                <Link href="/register">Register</Link>
              </div>
            )}
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
