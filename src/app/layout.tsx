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
    <html lang="nl">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            Home
          </Link>

          <nav className="desktop-nav" aria-label="Hoofdnavigatie">
            {user ? (
              <div className="nav-auth">
                <MainNavigation isAdmin={isAdmin} defaultLeagueId={defaultLeagueId} />
                <form action={logout}>
                  <button type="submit" className="link-button">
                    Uitloggen
                  </button>
                </form>
              </div>
            ) : (
              <div className="nav-auth">
                <Link href="/login">Inloggen</Link>
                <Link href="/register">Meld je aan</Link>
              </div>
            )}
          </nav>

          <details className="mobile-menu">
            <summary aria-label="Open menu">Menu</summary>
            <div className="mobile-menu-panel">
              {user ? (
                <>
                  <div className="mobile-menu-links">
                    <MainNavigation isAdmin={isAdmin} defaultLeagueId={defaultLeagueId} />
                  </div>
                  <form action={logout}>
                    <button type="submit" className="link-button mobile-menu-button">
                      Uitloggen
                    </button>
                  </form>
                </>
              ) : (
                <div className="mobile-menu-links">
                  <Link href="/login">Inloggen</Link>
                  <Link href="/register">Meld je aan</Link>
                  <Link href="/leagues">Leagues</Link>
                  <Link href="/spelregels">Spelregels</Link>
                </div>
              )}
            </div>
          </details>
        </header>
        {children}
      </body>
    </html>
  );
}
