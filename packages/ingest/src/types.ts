import type { Match, MatchEvent } from "@aafkstats/schema";

export interface SourceTeam {
  externalId: string;
  name: string;
}

export interface SourceLineup {
  formation?: string;
  starters: string[];
  subs: string[];
  coach?: string;
}

export interface SourceTeamStats {
  possession?: number;
  shots?: number;
  shotsOnTarget?: number;
  corners?: number;
  fouls?: number;
  offsides?: number;
  xg?: number;
}

/** Kildens flate mellomformat. Ingen arkiv-ID-er avgjøres i adapteren. */
export interface SourceMatch {
  externalId: string;
  date: string;
  kickoff?: string;
  status: Match["status"];
  rawStatus?: string;
  home: SourceTeam;
  away: SourceTeam;
  homeScore?: number;
  awayScore?: number;
  homeHalfTime?: number;
  awayHalfTime?: number;
  extraTime?: { home: number; away: number };
  penaltyShootout?: { home: number; away: number };
  competitionExternalId: string;
  competitionName: string;
  season: number;
  round?: number;
  stage?: Match["competition"]["stage"];
  venueName?: string;
  venueCity?: string;
  venueCapacity?: number;
  attendance?: number;
  referee?: string;
  events?: MatchEvent[];
  lineups?: { home?: SourceLineup; away?: SourceLineup };
  stats?: { home?: SourceTeamStats; away?: SourceTeamStats };
  url?: string;
  fields: string[];
}

export interface FetchFailure {
  scope: "season" | "match";
  externalId: string;
  message: string;
}

export interface FetchResult {
  matches: SourceMatch[];
  failures: FetchFailure[];
  requests: number;
}

export interface SeasonFetchOptions {
  leagueId: string;
  season: number;
  withDetails?: boolean;
  detailsLimit?: number;
  limit?: number;
  refresh?: boolean;
  onProgress?: (message: string) => void;
}
