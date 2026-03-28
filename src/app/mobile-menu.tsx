"use client";

import Link from "next/link";
import { useRef } from "react";

import { logout } from "@/app/actions/auth";
import { MainNavigation } from "@/app/main-navigation";

type MobileMenuProps = {
  isAuthenticated: boolean;
  isAdmin: boolean;
  defaultLeagueId: string | null;
};

export function MobileMenu({ isAuthenticated, isAdmin, defaultLeagueId }: MobileMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);

  const closeMenu = () => {
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  };

  return (
    <details className="mobile-menu" ref={detailsRef}>
      <summary aria-label="Open menu">Menu</summary>
      <div className="mobile-menu-panel">
        {isAuthenticated ? (
          <>
            <div className="mobile-menu-links">
              <MainNavigation isAdmin={isAdmin} defaultLeagueId={defaultLeagueId} onNavigate={closeMenu} />
            </div>
            <form action={logout}>
              <button type="submit" className="link-button mobile-menu-button" onClick={closeMenu}>
                Uitloggen
              </button>
            </form>
          </>
        ) : (
          <div className="mobile-menu-links">
            <Link href="/login" onClick={closeMenu}>
              Inloggen
            </Link>
            <Link href="/register" onClick={closeMenu}>
              Meld je aan
            </Link>
            <Link href="/leagues" onClick={closeMenu}>
              Leagues
            </Link>
            <Link href="/spelregels" onClick={closeMenu}>
              Spelregels
            </Link>
          </div>
        )}
      </div>
    </details>
  );
}
