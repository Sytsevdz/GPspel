import type { Metadata } from "next";
import Link from "next/link";

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
                <Link href="/dashboard">Dashboard</Link>
                <Link href="/profile">Profile</Link>
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
