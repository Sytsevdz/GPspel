"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type MainNavigationProps = {
  isAdmin: boolean;
  defaultLeagueId: string | null;
  onNavigate?: () => void;
};

function getActiveLeagueId(pathname: string, defaultLeagueId: string | null) {
  const match = pathname.match(/^\/leagues\/([^/]+)/);
  return match?.[1] ?? defaultLeagueId;
}

export function MainNavigation({ isAdmin, defaultLeagueId, onNavigate }: MainNavigationProps) {
  const pathname = usePathname();
  const activeLeagueId = getActiveLeagueId(pathname, defaultLeagueId);
  const gpSpelHref = activeLeagueId ? `/leagues/${activeLeagueId}/gp-spel` : "/leagues";

  const isLeaguesActive = pathname.startsWith("/leagues") && !pathname.includes("/gp-spel");

  return (
    <>
      <Link
        href={gpSpelHref}
        className={pathname.includes("/gp-spel") ? "nav-link active" : "nav-link"}
        onClick={onNavigate}
      >
        GP Spel
      </Link>
      <Link href="/leagues" className={isLeaguesActive ? "nav-link active" : "nav-link"} onClick={onNavigate}>
        Leagues
      </Link>
      <Link href="/spelregels" className={pathname === "/spelregels" ? "nav-link active" : "nav-link"} onClick={onNavigate}>
        Spelregels
      </Link>
      <Link href="/profile" className={pathname === "/profile" ? "nav-link active" : "nav-link"} onClick={onNavigate}>
        Profiel
      </Link>
      {isAdmin ? (
        <Link href="/admin" className={pathname.startsWith("/admin") ? "nav-link active" : "nav-link"} onClick={onNavigate}>
          Admin
        </Link>
      ) : null}
    </>
  );
}
