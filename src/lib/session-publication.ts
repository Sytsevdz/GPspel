type GrandPrixScore = Record<string, number | null | undefined>;

export function isSessionPublished<T extends GrandPrixScore>(
  userScore: T | null | undefined,
  field: keyof T,
): boolean {
  return userScore != null && userScore[field] != null;
}
