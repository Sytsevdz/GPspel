export type TeamColorPalette = {
  accent: string;
  accentSecondary: string;
  backgroundFrom: string;
  backgroundTo: string;
};

export const TEAM_COLOR_MAP: Record<string, TeamColorPalette> = {
  Mercedes: {
    accent: "#6CD3BF",
    accentSecondary: "#8A8F98",
    backgroundFrom: "rgba(108, 211, 191, 0.16)",
    backgroundTo: "rgba(138, 143, 152, 0.06)",
  },
  Ferrari: {
    accent: "#CC0000",
    accentSecondary: "#7C0000",
    backgroundFrom: "rgba(204, 0, 0, 0.18)",
    backgroundTo: "rgba(124, 0, 0, 0.08)",
  },
  "Red Bull Racing": {
    accent: "#1E5BC6",
    accentSecondary: "#C8102E",
    backgroundFrom: "rgba(30, 91, 198, 0.18)",
    backgroundTo: "rgba(200, 16, 46, 0.08)",
  },
  McLaren: {
    accent: "#FF8000",
    accentSecondary: "#E86B00",
    backgroundFrom: "rgba(255, 128, 0, 0.18)",
    backgroundTo: "rgba(232, 107, 0, 0.08)",
  },
  "Aston Martin": {
    accent: "#006F62",
    accentSecondary: "#003D35",
    backgroundFrom: "rgba(0, 111, 98, 0.2)",
    backgroundTo: "rgba(0, 61, 53, 0.08)",
  },
  Alpine: {
    accent: "#0090FF",
    accentSecondary: "#FF4FA3",
    backgroundFrom: "rgba(0, 144, 255, 0.16)",
    backgroundTo: "rgba(255, 79, 163, 0.08)",
  },
  Williams: {
    accent: "#005AFF",
    accentSecondary: "#003B99",
    backgroundFrom: "rgba(0, 90, 255, 0.18)",
    backgroundTo: "rgba(0, 59, 153, 0.08)",
  },
  Haas: {
    accent: "#E10600",
    accentSecondary: "#111111",
    backgroundFrom: "rgba(225, 6, 0, 0.16)",
    backgroundTo: "rgba(17, 17, 17, 0.14)",
  },
  Audi: {
    accent: "#8B0000",
    accentSecondary: "#1A1A1A",
    backgroundFrom: "rgba(139, 0, 0, 0.16)",
    backgroundTo: "rgba(26, 26, 26, 0.14)",
  },
  "Racing Bulls": {
    accent: "#2B5CFF",
    accentSecondary: "#1234A6",
    backgroundFrom: "rgba(43, 92, 255, 0.16)",
    backgroundTo: "rgba(18, 52, 166, 0.08)",
  },
};

const DEFAULT_TEAM_COLORS: TeamColorPalette = {
  accent: "#6B7280",
  accentSecondary: "#3F3F46",
  backgroundFrom: "rgba(107, 114, 128, 0.12)",
  backgroundTo: "rgba(63, 63, 70, 0.06)",
};

const TEAM_NAME_ALIASES: Array<{ match: RegExp; mapTo: keyof typeof TEAM_COLOR_MAP }> = [
  { match: /mercedes/i, mapTo: "Mercedes" },
  { match: /ferrari/i, mapTo: "Ferrari" },
  { match: /red\s*bull/i, mapTo: "Red Bull Racing" },
  { match: /mclaren/i, mapTo: "McLaren" },
  { match: /aston\s*martin/i, mapTo: "Aston Martin" },
  { match: /alpine/i, mapTo: "Alpine" },
  { match: /williams/i, mapTo: "Williams" },
  { match: /haas/i, mapTo: "Haas" },
  { match: /audi|sauber|kick/i, mapTo: "Audi" },
  { match: /racing\s*bulls|rb\s*f1|alphatauri/i, mapTo: "Racing Bulls" },
];

export const getConstructorTeamColors = (teamName: string): TeamColorPalette => {
  if (TEAM_COLOR_MAP[teamName]) {
    return TEAM_COLOR_MAP[teamName];
  }

  const alias = TEAM_NAME_ALIASES.find(({ match }) => match.test(teamName));
  if (alias) {
    return TEAM_COLOR_MAP[alias.mapTo];
  }

  return DEFAULT_TEAM_COLORS;
};
