import type { Match } from "@aafkstats/schema";
import type { Archive } from "@aafkstats/schema/load";
import { clubKey, clubNameForms } from "./ids.js";
import type { SourceMatch } from "./types.js";

export type FotmobCompetitionClass = "league" | "cup" | "europe" | "friendly" | "other";
export type FotmobGapStatus = "missing" | "existing" | "enrichable" | "uncertain";

const CLASS_BY_TOURNAMENT_ID: Record<string, FotmobCompetitionClass> = {
  "59": "league",
  "60": "league",
  "203": "league",
  "206": "cup",
  "10613": "europe",
  "489": "friendly",
};

export interface FotmobGapEntry {
  externalId: string;
  date: string;
  home: string;
  away: string;
  score: string | null;
  tournamentId: string;
  tournamentName: string;
  competitionClass: FotmobCompetitionClass;
  status: FotmobGapStatus;
  matchId?: string;
  reason: string;
  url?: string;
}

export interface FotmobGapReport {
  generatedAt: string;
  period: { from: string; to: string };
  candidates: number;
  coverageFloor: Partial<Record<FotmobCompetitionClass, string>>;
  summary: Record<FotmobGapStatus, number>;
  entries: FotmobGapEntry[];
}

export function classifyFotmobCompetition(match: SourceMatch): FotmobCompetitionClass {
  const stable = CLASS_BY_TOURNAMENT_ID[match.competitionExternalId];
  if (stable) return stable;
  const name = match.competitionName.toLowerCase();
  if (/europa|champions|conference/.test(name)) return "europe";
  if (/friendly|treningskamp/.test(name)) return "friendly";
  if (/cup|nm/.test(name)) return "cup";
  if (/division|eliteserien|tippeliga|league/.test(name)) return "league";
  return "other";
}

export function buildFotmobGapReport(
  archive: Archive,
  candidates: SourceMatch[],
  options: { from: string; to: string; generatedAt: string },
): FotmobGapReport {
  const entries = candidates.map((candidate) => matchCandidate(archive, candidate));
  const classes: FotmobCompetitionClass[] = ["league", "cup", "europe", "friendly", "other"];
  const statuses: FotmobGapStatus[] = ["missing", "existing", "enrichable", "uncertain"];
  return {
    generatedAt: options.generatedAt,
    period: { from: options.from, to: options.to },
    candidates: entries.length,
    coverageFloor: Object.fromEntries(classes.flatMap((kind) => {
      const first = entries.filter((entry) => entry.competitionClass === kind).map((entry) => entry.date).sort()[0];
      return first ? [[kind, first]] : [];
    })),
    summary: Object.fromEntries(statuses.map((status) => [status, entries.filter((entry) => entry.status === status).length])) as Record<FotmobGapStatus, number>,
    entries,
  };
}

function matchCandidate(archive: Archive, candidate: SourceMatch): FotmobGapEntry {
  const byAlias = archive.matches.find((match) => String(match.aliases.fotmob ?? "") === candidate.externalId);
  if (byAlias) {
    const missing = missingBasicFields(byAlias, candidate);
    return entry(candidate, missing.length ? "enrichable" : "existing", byAlias.id,
      missing.length ? `FotMob kan fylle: ${missing.join(", ")}` : "samme FotMob-ID finnes i arkivet");
  }

  const homeIds = resolveClubIds(archive, candidate.home.externalId, candidate.home.name);
  const awayIds = resolveClubIds(archive, candidate.away.externalId, candidate.away.name);
  const exact = archive.matches.filter((match) => match.date === candidate.date && sameSides(match, homeIds, awayIds));
  if (exact.length === 1) return entry(candidate, "enrichable", exact[0]!.id, "samme dato og lag; mangler FotMob-alias/provenance");
  if (exact.length > 1) return entry(candidate, "uncertain", undefined, "flere arkivkamper matcher samme dato og lag");

  const shifted = archive.matches.filter((match) => dayDistance(match.date, candidate.date) <= 1 && sameSides(match, homeIds, awayIds));
  if (shifted.length > 0) return entry(candidate, "uncertain", shifted.length === 1 ? shifted[0]!.id : undefined, "lagene matcher, men datoen avviker med inntil ett døgn");
  return entry(candidate, "missing", undefined, "ingen kamp med samme dato og lag i arkivet");
}

function entry(candidate: SourceMatch, status: FotmobGapStatus, matchId: string | undefined, reason: string): FotmobGapEntry {
  return {
    externalId: candidate.externalId,
    date: candidate.date,
    home: candidate.home.name,
    away: candidate.away.name,
    score: candidate.homeScore === undefined || candidate.awayScore === undefined ? null : `${candidate.homeScore}–${candidate.awayScore}`,
    tournamentId: candidate.competitionExternalId,
    tournamentName: candidate.competitionName,
    competitionClass: classifyFotmobCompetition(candidate),
    status,
    ...(matchId ? { matchId } : {}),
    reason,
    ...(candidate.url ? { url: candidate.url } : {}),
  };
}

function resolveClubIds(archive: Archive, externalId: string, name: string): Set<string> {
  return new Set(archive.clubs.filter((club) =>
    String(club.aliases.fotmob ?? "") === externalId
    || clubNameForms(club).some((form) => clubKey(form) === clubKey(name)),
  ).map((club) => club.id));
}

function sameSides(match: Match, homeIds: Set<string>, awayIds: Set<string>): boolean {
  return homeIds.has(match.home.clubId) && awayIds.has(match.away.clubId);
}

function dayDistance(left: string, right: string): number {
  return Math.abs(new Date(`${left}T00:00:00Z`).getTime() - new Date(`${right}T00:00:00Z`).getTime()) / 86_400_000;
}

function missingBasicFields(match: Match, candidate: SourceMatch): string[] {
  const missing: string[] = [];
  if (!match.kickoff && candidate.kickoff) missing.push("avspark");
  if (match.home.score === null && candidate.homeScore !== undefined) missing.push("resultat");
  if (match.away.score === null && candidate.awayScore !== undefined && !missing.includes("resultat")) missing.push("resultat");
  return missing;
}

export function fotmobGapMarkdown(report: FotmobGapReport): string {
  const labels: Record<FotmobGapStatus, string> = {
    missing: "A. Mangler i arkivet",
    existing: "B. Finnes allerede",
    enrichable: "C. Finnes, men kan berikes",
    uncertain: "D. Usikre treff",
  };
  const lines = [
    "# FotMob-gap for AaFK",
    "",
    `Generert ${report.generatedAt} for perioden ${report.period.from}–${report.period.to}.`,
    "",
    `Fant ${report.candidates} FotMob-kandidater. Turneringstype bestemmes primært av stabil turnerings-ID, ikke visningsnavn.`,
    "",
    "## Tidligste observerte dekning",
    "",
    "| Type | Første kamp |",
    "| --- | --- |",
    ...Object.entries(report.coverageFloor).map(([kind, date]) => `| ${kind} | ${date} |`),
    "",
  ];
  for (const status of Object.keys(labels) as FotmobGapStatus[]) {
    lines.push(`## ${labels[status]} (${report.summary[status]})`, "");
    const rows = report.entries.filter((entry) => entry.status === status);
    if (rows.length === 0) lines.push("Ingen.", "");
    else {
      lines.push("| Dato | Kamp | Resultat | Turnering | FotMob-ID | Begrunnelse |", "| --- | --- | --- | --- | --- | --- |");
      for (const item of rows) {
        lines.push(`| ${item.date} | ${item.home}–${item.away} | ${item.score ?? "–"} | ${item.tournamentName} (${item.tournamentId}) | ${item.externalId} | ${item.reason} |`);
      }
      lines.push("");
    }
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
