import type { Match, MatchEvent } from "@aafkstats/schema";

export interface SourceTeam {
  externalId: string;
  name: string;
  country?: string;
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
  venueCountry?: string;
  /** Kilden viste et spillested, men det er kjent som en upålitelig standardverdi. */
  venueReliable?: boolean;
  attendance?: number;
  referee?: string;
  events?: MatchEvent[];
  lineups?: { home?: SourceLineup; away?: SourceLineup };
  stats?: { home?: SourceTeamStats; away?: SourceTeamStats };
  /** Diagnostikk fra statistikkadapteren; brukes i høsterapporten, ikke i arkivfilen. */
  statsReport?: {
    foundFields: (keyof SourceTeamStats)[];
    unknownTitles: string[];
    rejectedReason?: string;
  };
  url?: string;
  fields: string[];
  /** Forbehold som hører til kampen selv, ikke til kilden. */
  note?: string;
  /**
   * Ting adapteren så, men ikke turde tolke. Reconcile løfter disse til
   * kontrollpunkter, så en tvilsom kamp stopper skrivingen i stedet for å bli
   * skrevet feil. Typisk: en kamp som gikk til ekstraomganger uten at
   * hendelseslista kan forklare stillingen etter 90.
   */
  warnings?: string[];
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
  /** Sesongen kampene havner under i arkivet. Alltid et årstall. */
  season: number;
  /**
   * Sesongen slik kilden vil ha den, når den skiller seg fra årstallet.
   *
   * Norgesmesterskapet 2021 og 2022 ble spilt over to kalenderår og ligger hos
   * FotMob som «2021/2022» og «2022/2023». Ber man om «2021», finnes ikke
   * sesongen, og kilden svarer med inneværende sesong i stedet for en feil.
   */
  sourceSeason?: string;
  withDetails?: boolean;
  detailsLimit?: number;
  /** Hvor i kamplista detaljvinduet starter. Lar en sesong detaljeres over flere kjøringer. */
  detailsOffset?: number;
  limit?: number;
  refresh?: boolean;
  onProgress?: (message: string) => void;
}
