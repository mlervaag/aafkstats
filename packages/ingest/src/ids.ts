/** Norske bokstaver translittereres før Unicode-normalisering. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replaceAll("æ", "ae")
    .replaceAll("ø", "o")
    .replaceAll("å", "a")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function matchId(date: string, homeClubId: string, awayClubId: string): string {
  return `${date}-${homeClubId}-${awayClubId}`;
}
