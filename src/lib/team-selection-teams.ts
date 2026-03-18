export type TeamSelectionTeam = {
  id: string;
  name: string;
  image: string;
};

export const TEAM_SELECTION_TEAMS: TeamSelectionTeam[] = [
  {
    id: "alpine",
    name: "Alpine",
    image: "/images/teams/Alpine - car-side.png",
  },
  {
    id: "astonmartin",
    name: "Aston Martin",
    image: "/images/teams/Aston Martin - car-side.png",
  },
  {
    id: "audi",
    name: "Audi",
    image: "/images/teams/Audi - car-side.png",
  },
  {
    id: "cadillac",
    name: "Cadillac",
    image: "/images/teams/Cadillac - car-side.png",
  },
  {
    id: "ferrari",
    name: "Ferrari",
    image: "/images/teams/Ferrari - car-side.png",
  },
  {
    id: "haas",
    name: "Haas",
    image: "/images/teams/Haas - car-side.png",
  },
  {
    id: "mclaren",
    name: "Mclaren",
    image: "/images/teams/Mclaren - car-side.png",
  },
  {
    id: "mercedes",
    name: "Mercedes",
    image: "/images/teams/Mercedes - car-side.png",
  },
  {
    id: "racingbulls",
    name: "Racing Bulls",
    image: "/images/teams/Racing Bulls - car-side.png",
  },
  {
    id: "redbull",
    name: "Red Bull",
    image: "/images/teams/Red Bull - car-side.png",
  },
  {
    id: "williams",
    name: "Williams",
    image: "/images/teams/Williams - car-side.png",
  },
];

const TEAM_SELECTION_TEAM_ALIASES: Array<{
  match: RegExp;
  teamId: TeamSelectionTeam["id"];
}> = [
  { match: /alpine/i, teamId: "alpine" },
  { match: /aston\s*martin/i, teamId: "astonmartin" },
  { match: /audi|sauber|kick/i, teamId: "audi" },
  { match: /cadillac/i, teamId: "cadillac" },
  { match: /ferrari/i, teamId: "ferrari" },
  { match: /haas/i, teamId: "haas" },
  { match: /mclaren/i, teamId: "mclaren" },
  { match: /mercedes/i, teamId: "mercedes" },
  { match: /racing\s*bulls|rb\s*f1|alphatauri/i, teamId: "racingbulls" },
  { match: /red\s*bull/i, teamId: "redbull" },
  { match: /williams/i, teamId: "williams" },
];

export const getTeamSelectionTeam = (teamName: string): TeamSelectionTeam | null => {
  const exactMatch = TEAM_SELECTION_TEAMS.find((team) => team.name === teamName);

  if (exactMatch) {
    return exactMatch;
  }

  const alias = TEAM_SELECTION_TEAM_ALIASES.find(({ match }) => match.test(teamName));
  if (!alias) {
    return null;
  }

  return TEAM_SELECTION_TEAMS.find((team) => team.id === alias.teamId) ?? null;
};
