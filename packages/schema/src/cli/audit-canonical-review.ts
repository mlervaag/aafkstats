import { readFile, writeFile } from "node:fs/promises";
import { stringify as stringifyYaml } from "yaml";
import { parseArchiveYaml as parseYaml } from "../yaml.js";
import { repoRoot } from "../load.js";

export interface FacsimileReaudit {
  visuallyReviewed: boolean;
  reviewBasis: "new_facsimile_reaudit" | "prior_ground_truth" | "prior_wave_review" | "deterministic_gate";
  provisional?: boolean;
  followupReason?:
    | "temporal_invalid"
    | "score_conflict_from_prior_review"
    | "date_uncertain"
    | "suspected_wrong_event";
  candidateOpponent: {
    name: string;
    clubId: string;
  };
  observedOpponent: {
    name: string;
    clubId: string;
    confidence: "high" | "medium" | "low";
  };
  sameEvent: boolean | "uncertain";
  seniorAteam: boolean | "uncertain";
  score: {
    aafk: number;
    opponent: number;
    confidence: "high" | "medium" | "low";
  };
  matchDate: {
    value: string;
    confidence: "high" | "medium" | "low";
  };
  homeAway: "home" | "away" | "neutral" | "unknown";
  competition: {
    value: string;
    competitionId: string | null;
    confidence: "high" | "medium" | "low";
  };
  evidenceType: "report" | "result_board" | "retrospective" | "preview" | "other";
  disposition:
    | "canonical_ready"
    | "wrong_event"
    | "non_senior"
    | "score_conflict"
    | "date_uncertain"
    | "competition_uncertain"
    | "insufficient";
  priorGroundTruthCheck: {
    hasConflict: boolean;
    status?: string;
    note?: string;
  };
  reason: string;
}

export interface CanonicalAuditCase {
  candidateId: string;
  sourceResult: {
    sourceId: string;
    year: number;
    no: number;
    opponent: string;
    opponentClubId: string;
    expectedScore: { aafk: number; opponent: number };
  };
  newspaper: {
    title: string;
    issueDate: string;
    page: string;
    pageUrl: string;
  };
  facsimileReaudit: FacsimileReaudit;
}

// Known merged ground truth from earlier PRs (PR #186, #188, #190)
const priorGroundTruthDatabase: Record<string, { disposition: "non_senior" | "wrong_event" | "identity_uncertain" | "score_conflict"; note: string }> = {
  "nb-cand-aalesunds-fotballklub-gjennem-1939-ec28-1939-022": {
    disposition: "non_senior",
    note: "Sunnmørsposten 09.10.1939 s. 8 viser Nørvekammeratene (Kløna) mot Roald (8-2), ikke AaFKs A-lag.",
  },
  "nb-cand-medlemsblad-for-aalesunds-fotb-1965-a2c9-1940-004": {
    disposition: "non_senior",
    note: "Sunnmørsposten 07.10.1940 s. 3 viser sammensatt A/B-lag som slo Spjelkavik 8-0. Kildepåstand oppga 5-3.",
  },
};

// Canonical club normalization dictionary
const clubAliasMap: Record<string, string> = {
  "freidig, tr.heim": "freidig",
  "freidig, trondheim": "freidig",
  "freidig": "freidig",
  "nordlandet": "nordlandet",
  "aksla": "aksla",
  "ørsta": "orsta",
  "orsta": "orsta",
  "skarbøvik": "skarbovik",
  "skarbovik": "skarbovik",
  "molde": "molde-fk",
  "molde fk": "molde-fk",
  "kfk": "kfk",
  "k. f. k.": "kfk",
  "kristiansund fk": "kfk",
  "kristiansunds fk": "kfk",
  "kristiansund": "kfk",
  "hødd": "hodd",
  "hodd": "hodd",
  "rollon": "rollon",
  "clausenengen": "clausenengen",
  "cfk": "clausenengen",
  "braatt": "braatt",
  "brått": "braatt",
  "bratt": "braatt",
  "eid": "eid-il",
  "eid il": "eid-il",
  "dahle": "dahle",
  "spartak": "spartak",
  "viking": "viking",
  "viking, stavanger": "viking",
  "viking, st.vanger": "viking",
  "falk": "falk",
  "falk, horten": "falk",
  "odd": "odds-ballklubb",
  "odds bk": "odds-ballklubb",
  "odd, skien": "odds-ballklubb",
  "kvik": "kvik-trondheim",
  "kvik, trondheim": "kvik-trondheim",
  "moss": "moss",
  "træff": "traeff",
  "traeff": "traeff",
  "treff": "traeff",
  "træff, molde": "traeff",
  "treff, molde": "traeff",
  "sykkylven": "fk-sykkylven",
  "fk sykkylven": "fk-sykkylven",
  "spjelkavik": "spjelkavik",
  "fremad": "fremad",
  "fremad, l.hammer": "fremad",
  "fremad, lillehammer": "fremad",
  "brattvåg": "brattvag",
  "brattvag": "brattvag",
  "mjøndalen": "mjondalen",
  "mjondalen": "mjondalen",
  "stryn": "stryn",
  "årstad": "arstad-il",
  "arstad": "arstad-il",
  "stranda": "stranda",
  "måløy": "maloy-il",
  "maloy": "maloy-il",
  "sunndal": "sunndal",
  "bergsøy": "bergsoy",
  "bergsoy": "bergsoy",
  "herd": "herd",
  "guard": "guard",
  "langevåg": "langevag",
  "langevag": "langevag",
  "volda": "volda",
  "v.r.f.": "velledalen-ringen",
  "vrf": "velledalen-ringen",
  "velledalen og ringen": "velledalen-ringen",
  "velledalen-ringen": "velledalen-ringen",
  "national": "national",
  "national (kameratene)": "national",
  "glimt": "bodo-glimt",
  "glimt, bodø": "bodo-glimt",
  "bodø/glimt": "bodo-glimt",
  "lyn": "lyn",
  "lyn, oslo": "lyn",
  "dr. ballklubb": "drammens-bk",
  "drammens bk": "drammens-bk",
  "drammens ballklubb": "drammens-bk",
  "sandane": "sandane",
  "snøgg": "snogg",
  "snogg": "snogg",
  "djerv": "sk-djerv",
  "sk djerv": "sk-djerv",
  "djerv, bergen": "sk-djerv",
  "djerv (bergen)": "sk-djerv",
  "nydalen": "nydalen",
  "roald": "il-roald",
  "il roald": "il-roald",
  "reidulf": "sk-reidulf",
  "reidulf, oslo": "sk-reidulf",
  "sk reidulf": "sk-reidulf",
  "falken": "il-falken-hoyanger",
  "falken, høyanger": "il-falken-hoyanger",
  "halmia": "is-halmia",
  "is halmia": "is-halmia",
  "halmia, sverige": "is-halmia",
  "mesna": "mesna-fotball",
  "mesna if": "mesna-fotball",
  "mesna fotball": "mesna-fotball",
  "veblungsnes": "veblungsnes-fk",
  "veblungsnes fk": "veblungsnes-fk",
  "vigra": "vigra-il",
  "vigra il": "vigra-il",
  "voss": "fbk-voss",
  "fbk voss": "fbk-voss",
  "fredrikshavn": "frederikshavn-fi",
  "frederikshavn": "frederikshavn-fi",
  "køge": "koge-bk",
  "køge, danmark": "koge-bk",
  "horsens": "horsens-fs",
  "horsens, danmark": "horsens-fs",
  "ravn": "il-ravn",
  "il ravn": "il-ravn",
  "jednota": "jednota-trencin",
  "jednota trencin": "jednota-trencin",
  "jednota trenčín": "jednota-trencin",
  "stålkameratene": "stalkameratene",
  "stalkameratene": "stalkameratene",
  "gossen": "gossen-il",
  "gossen il": "gossen-il",
};

export function normalizeClubId(name: string): string {
  if (!name) return "";
  const clean = name.toLowerCase().trim().replace(/[.]/g, "");
  if (clubAliasMap[name.toLowerCase().trim()]) return clubAliasMap[name.toLowerCase().trim()]!;
  if (clubAliasMap[clean]) return clubAliasMap[clean]!;
  return clean;
}

export function normalizeCompetitionExplicit(compValue: string, year: number): { competitionId: string | null; confidence: "high" | "medium" | "low" } {
  const c = (compValue || "").toLowerCase().trim();
  if (c.includes("nm") || c.includes("cup") || c.includes("norgesmesterskap")) {
    return { competitionId: "nm", confidence: "high" };
  }
  if (c.includes("privatkamp") || c.includes("treningskamp") || c.includes("pokalkamp") || c.includes("oppvisningskamp") || c.includes("sunnmørscup")) {
    return { competitionId: "treningskamp", confidence: "high" };
  }
  if (year >= 1963 && year <= 1990) {
    if (c.includes("3. divisjon") || c.includes("3.divisjon")) return { competitionId: "andredivisjon", confidence: "high" };
    if (c.includes("2. divisjon") || c.includes("2.divisjon")) return { competitionId: "forstedivisjon", confidence: "high" };
    if (c.includes("1. divisjon") || c.includes("1.divisjon")) return { competitionId: "eliteserien", confidence: "high" };
  }
  if (year >= 1948 && year <= 1962) {
    if (c.includes("1. divisjon") || c.includes("landsdelsserien")) return { competitionId: "forstedivisjon", confidence: "high" };
    if (c.includes("hovedserien")) return { competitionId: "eliteserien", confidence: "high" };
  }
  if (year <= 1947) {
    if (c.includes("1. divisjon") || c.includes("kretsserie")) return { competitionId: "forstedivisjon", confidence: "high" };
  }
  return { competitionId: null, confidence: "low" };
}

// 22 verified canonical cases with full structured visual facsimile findings
const visuallyVerifiedCasesData: Record<string, {
  observedOpponent: { name: string; clubId: string; confidence: "high" };
  sameEvent: true;
  seniorAteam: true;
  score: { aafk: number; opponent: number; confidence: "high" };
  matchDate: { value: string; confidence: "high" };
  homeAway: "home" | "away" | "neutral";
  competition: { value: string; competitionId: string; confidence: "high" };
  evidenceType: "report";
  reason: string;
}> = {
  "nb-cand-medlemsblad-for-aalesunds-fotb-1965-a2c9-1925-019": {
    observedOpponent: { name: "Viking, Stavanger", clubId: "viking", confidence: "high" },
    sameEvent: true,
    seniorAteam: true,
    score: { aafk: 1, opponent: 2, confidence: "high" },
    matchDate: { value: "1925-09-13", confidence: "high" },
    homeAway: "away",
    competition: { value: "NM", competitionId: "nm", confidence: "high" },
    evidenceType: "report",
    reason: "Sunnmørsposten 16.09.1925 s. 3: Utførlig kampreferat fra NM 4. runde på Stavanger Stadion der Viking slo AaFK 2-1 e.e.o.",
  },
  "nb-cand-aalesunds-fotballklub-gjennem-1939-ec28-1933-014": {
    observedOpponent: { name: "Moss", clubId: "moss", confidence: "high" },
    sameEvent: true,
    seniorAteam: true,
    score: { aafk: 3, opponent: 1, confidence: "high" },
    matchDate: { value: "1933-07-08", confidence: "high" },
    homeAway: "away",
    competition: { value: "privatkamp", competitionId: "treningskamp", confidence: "high" },
    evidenceType: "report",
    reason: "Sunnmørsposten 11.07.1933 s. 3: Referat fra AaFKs østlandsturné der AaFK slo Moss 3-1 lørdag 8. juli 1933.",
  },
  "nb-cand-aalesunds-fotballklub-gjennem-1939-ec28-1933-018": {
    observedOpponent: { name: "Nydalen", clubId: "nydalen", confidence: "high" },
    sameEvent: true,
    seniorAteam: true,
    score: { aafk: 4, opponent: 2, confidence: "high" },
    matchDate: { value: "1933-08-13", confidence: "high" },
    homeAway: "home",
    competition: { value: "privatkamp", competitionId: "treningskamp", confidence: "high" },
    evidenceType: "report",
    reason: "Sunnmørsposten 14.08.1933 s. 6: Referat fra privatkampen på Nørve søndag 13. august 1933 der AaFK slo Nydalen 4-2.",
  },
  "nb-cand-aalesunds-fotballklub-gjennem-1939-ec28-1938-017": {
    observedOpponent: { name: "Sykkylven", clubId: "fk-sykkylven", confidence: "high" },
    sameEvent: true,
    seniorAteam: true,
    score: { aafk: 8, opponent: 2, confidence: "high" },
    matchDate: { value: "1938-06-06", confidence: "high" },
    homeAway: "away",
    competition: { value: "privatkamp", competitionId: "treningskamp", confidence: "high" },
    evidenceType: "report",
    reason: "Sunnmørsposten 07.06.1938 s. 8: Omtale av 2. pinsedag-kampen i Sykkylven der AaFK slo Sykkylven IL 8-2.",
  },
  "nb-cand-aalesunds-fotballklub-gjennem-1939-ec28-1938-018": {
    observedOpponent: { name: "Hødd", clubId: "hodd", confidence: "high" },
    sameEvent: true,
    seniorAteam: true,
    score: { aafk: 3, opponent: 2, confidence: "high" },
    matchDate: { value: "1938-05-22", confidence: "high" },
    homeAway: "home",
    competition: { value: "privatkamp", competitionId: "treningskamp", confidence: "high" },
    evidenceType: "report",
    reason: "Sunnmørsposten 23.05.1938 s. 8: Omtale av privatkampen på Nørve søndag 22. mai 1938 der AaFK slo Hødd 3-2.",
  },
  "nb-cand-medlemsblad-for-aalesunds-fotb-1965-a2c9-1946-007": {
    observedOpponent: { name: "Reidulf", clubId: "sk-reidulf", confidence: "high" },
    sameEvent: true,
    seniorAteam: true,
    score: { aafk: 1, opponent: 1, confidence: "high" },
    matchDate: { value: "1946-07-11", confidence: "high" },
    homeAway: "home",
    competition: { value: "privatkamp", competitionId: "treningskamp", confidence: "high" },
    evidenceType: "report",
    reason: "Sunnmørsposten 12.07.1946 s. 2: Kampreferat fra Nørve torsdag 11. juli 1946 der AaFK og Reidulf (Oslo) spilte 1-1.",
  },
  "nb-cand-medlemsblad-for-aalesunds-fotb-1965-a2c9-1946-025": {
    observedOpponent: { name: "Falken, Høyanger", clubId: "il-falken-hoyanger", confidence: "high" },
    sameEvent: true,
    seniorAteam: true,
    score: { aafk: 2, opponent: 1, confidence: "high" },
    matchDate: { value: "1946-08-11", confidence: "high" },
    homeAway: "home",
    competition: { value: "NM", competitionId: "nm", confidence: "high" },
    evidenceType: "report",
    reason: "Sunnmørsposten 12.08.1946 s. 2: Fyldig referat fra NM 2. runde på Nørve søndag 11. august 1946 der AaFK slo Falken 2-1.",
  },
  "nb-cand-medlemsblad-for-aalesunds-fotb-1965-a2c9-1946-026": {
    observedOpponent: { name: "Freidig, Trondheim", clubId: "freidig", confidence: "high" },
    sameEvent: true,
    seniorAteam: true,
    score: { aafk: 2, opponent: 3, confidence: "high" },
    matchDate: { value: "1946-08-25", confidence: "high" },
    homeAway: "home",
    competition: { value: "NM", competitionId: "nm", confidence: "high" },
    evidenceType: "report",
    reason: "Sunnmørsposten 26.08.1946 s. 2: Referat fra NM 3. runde på Nørve søndag 25. august 1946 der Freidig slo AaFK 3-2.",
  },
  "nb-cand-medlemsblad-for-aalesunds-fotb-1965-a2c9-1947-003": {
    observedOpponent: { name: "Freidig, Tr.heim", clubId: "freidig", confidence: "high" },
    sameEvent: true,
    seniorAteam: true,
    score: { aafk: 0, opponent: 1, confidence: "high" },
    matchDate: { value: "1947-05-26", confidence: "high" },
    homeAway: "home",
    competition: { value: "privatkamp", competitionId: "treningskamp", confidence: "high" },
    evidenceType: "report",
    reason: "Sunnmørsposten 27.05.1947 s. 1: Omtale av pinsekampen mandag 26. mai 1947 på Nørve der Freidig slo AaFK 1-0.",
  },
  "nb-cand-medlemsblad-for-aalesunds-fotb-1965-a2c9-1947-011": {
    observedOpponent: { name: "Nordlandet", clubId: "nordlandet", confidence: "high" },
    sameEvent: true,
    seniorAteam: true,
    score: { aafk: 1, opponent: 1, confidence: "high" },
    matchDate: { value: "1947-08-24", confidence: "high" },
    homeAway: "home",
    competition: { value: "1. divisjon", competitionId: "forstedivisjon", confidence: "high" },
    evidenceType: "report",
    reason: "Sunnmørsposten 25.08.1947 s. 3: Fyldig referat fra 1. divisjonskampen på Nørve søndag 24. august 1947 der AaFK og Nordlandet spilte 1-1.",
  },
  "nb-cand-medlemsblad-for-aalesunds-fotb-1965-a2c9-1947-017": {
    observedOpponent: { name: "Aksla", clubId: "aksla", confidence: "high" },
    sameEvent: true,
    seniorAteam: true,
    score: { aafk: 2, opponent: 4, confidence: "high" },
    matchDate: { value: "1947-06-13", confidence: "high" },
    homeAway: "away",
    competition: { value: "pokalkamp", competitionId: "treningskamp", confidence: "high" },
    evidenceType: "report",
    reason: "Sunnmørsposten 17.06.1947 s. 2: Referat fra pokalkampen fredag 13. juni 1947 der Aksla slo AaFK 4-2.",
  },
  "nb-cand-medlemsblad-for-aalesunds-fotb-1965-a2c9-1947-019": {
    observedOpponent: { name: "Ørsta", clubId: "orsta", confidence: "high" },
    sameEvent: true,
    seniorAteam: true,
    score: { aafk: 2, opponent: 0, confidence: "high" },
    matchDate: { value: "1947-06-15", confidence: "high" },
    homeAway: "home",
    competition: { value: "NM", competitionId: "nm", confidence: "high" },
    evidenceType: "report",
    reason: "Sunnmørsposten 16.06.1947 s. 2: Fyldig referat fra NM 1. runde på Nørve søndag 15. juni 1947 der AaFK slo Ørsta 2-0.",
  },
  "nb-cand-medlemsblad-for-aalesunds-fotb-1950-62fa-1950-007": {
    observedOpponent: { name: "Freidig", clubId: "freidig", confidence: "high" },
    sameEvent: true,
    seniorAteam: true,
    score: { aafk: 0, opponent: 2, confidence: "high" },
    matchDate: { value: "1950-07-02", confidence: "high" },
    homeAway: "away",
    competition: { value: "NM", competitionId: "nm", confidence: "high" },
    evidenceType: "report",
    reason: "Sunnmørsposten 03.07.1950 s. 5: Referat fra NM 2. runde i Trondheim søndag 2. juli 1950 der Freidig slo AaFK 2-0.",
  },
  "nb-cand-medlemsblad-for-aalesunds-fotb-1965-a2c9-1951-001": {
    observedOpponent: { name: "Aksla", clubId: "aksla", confidence: "high" },
    sameEvent: true,
    seniorAteam: true,
    score: { aafk: 5, opponent: 1, confidence: "high" },
    matchDate: { value: "1951-04-15", confidence: "high" },
    homeAway: "neutral",
    competition: { value: "privatkamp", competitionId: "treningskamp", confidence: "high" },
    evidenceType: "report",
    reason: "Sunnmørsposten 16.04.1951 s. 2: Omtale av sesongåpningskampen på Nørve søndag 15. april 1951 der AaFK slo Aksla 5-1.",
  },
  "nb-cand-medlemsblad-for-aalesunds-fotb-1965-a2c9-1951-007": {
    observedOpponent: { name: "Fremad", clubId: "fremad", confidence: "high" },
    sameEvent: true,
    seniorAteam: true,
    score: { aafk: 2, opponent: 4, confidence: "high" },
    matchDate: { value: "1951-07-13", confidence: "high" },
    homeAway: "home",
    competition: { value: "privatkamp", competitionId: "treningskamp", confidence: "high" },
    evidenceType: "report",
    reason: "Sunnmørsposten 14.07.1951 s. 6: Referat fra privatkampen på Aksla stadion fredag 13. juli 1951 der Fremad slo AaFK 4-2.",
  },
  "nb-cand-medlemsblad-for-aalesunds-fotb-1965-a2c9-1960-007": {
    observedOpponent: { name: "Vigra", clubId: "vigra-il", confidence: "high" },
    sameEvent: true,
    seniorAteam: true,
    score: { aafk: 13, opponent: 1, confidence: "high" },
    matchDate: { value: "1960-07-24", confidence: "high" },
    homeAway: "away",
    competition: { value: "privatkamp", competitionId: "treningskamp", confidence: "high" },
    evidenceType: "report",
    reason: "Sunnmørsposten 25.07.1960 s. 6: Bilde og fyldig referat fra åpningskampen på Vigra-bana søndag 24. juli 1960 der AaFK slo Vigra 13-1.",
  },
  "nb-cand-sunnmore-fotballkrets-arsrapport-1961-1961-001": {
    observedOpponent: { name: "V.R.F.", clubId: "velledalen-ringen", confidence: "high" },
    sameEvent: true,
    seniorAteam: true,
    score: { aafk: 2, opponent: 1, confidence: "high" },
    matchDate: { value: "1961-04-30", confidence: "high" },
    homeAway: "away",
    competition: { value: "1. divisjon", competitionId: "forstedivisjon", confidence: "high" },
    evidenceType: "report",
    reason: "Sunnmørsposten 12.07.1961 s. 1: Kampomtale og tabelloppsummering fra seriekampen søndag 30. april 1961 der AaFK slo Velledalen/Ringen 2-1.",
  },
  "nb-cand-medlemsblad-for-aalesunds-fotb-1965-a2c9-1963-009": {
    observedOpponent: { name: "Spartak", clubId: "spartak", confidence: "high" },
    sameEvent: true,
    seniorAteam: true,
    score: { aafk: 1, opponent: 6, confidence: "high" },
    matchDate: { value: "1963-06-30", confidence: "high" },
    homeAway: "home",
    competition: { value: "privatkamp", competitionId: "treningskamp", confidence: "high" },
    evidenceType: "report",
    reason: "Sunnmørsposten 01.07.1963 s. 2: Fyldig referat fra oppvisningskampen på Aksla søndag 30. juni 1963 der Spartak vant 6-1 over AaFK.",
  },
  "nb-cand-sunnmore-fotballkrets-arsrapport-1964-1964-001": {
    observedOpponent: { name: "V.R.F.", clubId: "velledalen-ringen", confidence: "high" },
    sameEvent: true,
    seniorAteam: true,
    score: { aafk: 3, opponent: 1, confidence: "high" },
    matchDate: { value: "1964-04-19", confidence: "high" },
    homeAway: "away",
    competition: { value: "privatkamp", competitionId: "treningskamp", confidence: "high" },
    evidenceType: "report",
    reason: "Sunnmørsposten 20.04.1964 s. 2: Kampreferat fra privatkampen søndag 19. april 1964 der AaFK slo Velledalen/Ringen 3-1.",
  },
  "nb-cand-medlemsblad-for-aalesunds-fotb-1965-a2c9-1964-010": {
    observedOpponent: { name: "Vigra", clubId: "vigra-il", confidence: "high" },
    sameEvent: true,
    seniorAteam: true,
    score: { aafk: 15, opponent: 0, confidence: "high" },
    matchDate: { value: "1964-07-16", confidence: "high" },
    homeAway: "away",
    competition: { value: "treningskamp", competitionId: "treningskamp", confidence: "high" },
    evidenceType: "report",
    reason: "Sunnmørsposten 17.07.1964 s. 2: Kampreferat fra Roald torsdag 16. juli 1964 der AaFK som gjester slo Vigra 15-0 og satte klubbrekord.",
  },
  "nb-cand-medlemsblad-for-aalesunds-fotb-1965-a2c9-1965-032": {
    observedOpponent: { name: "Stålkameratene", clubId: "stalkameratene", confidence: "high" },
    sameEvent: true,
    seniorAteam: true,
    score: { aafk: 1, opponent: 7, confidence: "high" },
    matchDate: { value: "1965-07-12", confidence: "high" },
    homeAway: "away",
    competition: { value: "privatkamp", competitionId: "treningskamp", confidence: "high" },
    evidenceType: "report",
    reason: "Sunnmørsposten 13.07.1965 s. 6: Referat fra privatkampen i Mo i Rana mandag 12. juli 1965 der Stålkameratene slo AaFK 7-1.",
  },
  "nb-cand-sunnmore-fotballkrets-arsrapport-1977-1977-001": {
    observedOpponent: { name: "Bergsøy", clubId: "bergsoy", confidence: "high" },
    sameEvent: true,
    seniorAteam: true,
    score: { aafk: 1, opponent: 0, confidence: "high" },
    matchDate: { value: "1977-09-17", confidence: "high" },
    homeAway: "away",
    competition: { value: "3. divisjon", competitionId: "andredivisjon", confidence: "high" },
    evidenceType: "report",
    reason: "Sunnmørsposten 19.09.1977 s. 7: Referat fra 3. divisjonskampen i Fosnavåg lørdag 17. september 1977 der AaFK slo Bergsøy 1-0.",
  },
};

export async function runCanonicalAudit(): Promise<{
  manifest: any;
  canonicalReadyCases: CanonicalAuditCase[];
  followupCases: CanonicalAuditCase[];
}> {
  const root = repoRoot();

  const candidateQueueRaw = parseYaml(await readFile(`${root}/data/discovery/community-candidate-queue.yaml`, "utf8"));
  const wave1Raw = parseYaml(await readFile(`${root}/data/discovery/community-ai-review-wave-1.yaml`, "utf8"));
  const wave2Raw = parseYaml(await readFile(`${root}/data/discovery/community-ai-review-wave-2.yaml`, "utf8"));

  const candidates = candidateQueueRaw.candidates as any[];
  const candidateMap = new Map<string, any>();
  for (const c of candidates) {
    candidateMap.set(c.candidateId, c);
  }

  const allReviews = [...wave1Raw.reviews, ...wave2Raw.reviews] as any[];
  const yesReviews = allReviews.filter((r: any) => r.answer === "yes");

  const auditCases: CanonicalAuditCase[] = [];

  for (const rev of yesReviews) {
    const cand = candidateMap.get(rev.candidateId);
    const candOpponentClubId = normalizeClubId(cand.sourceResult.opponent);
    const issueDate = cand.newspaper.issueDate;
    const matchDate = rev.matchDate?.value;
    const isFutureReport = (issueDate && matchDate && issueDate < matchDate);

    // Check prior ground truth database
    const priorGt = priorGroundTruthDatabase[rev.candidateId];
    const hasPriorConflict = (priorGt !== undefined);

    // Check if explicitly visually verified
    const verifiedData = visuallyVerifiedCasesData[rev.candidateId];

    let facsimileReaudit: FacsimileReaudit;

    if (verifiedData && !hasPriorConflict) {
      facsimileReaudit = {
        visuallyReviewed: true,
        reviewBasis: "new_facsimile_reaudit",
        provisional: false,
        candidateOpponent: {
          name: cand.sourceResult.opponent,
          clubId: candOpponentClubId,
        },
        observedOpponent: verifiedData.observedOpponent,
        sameEvent: true,
        seniorAteam: true,
        score: verifiedData.score,
        matchDate: verifiedData.matchDate,
        homeAway: verifiedData.homeAway,
        competition: verifiedData.competition,
        evidenceType: verifiedData.evidenceType,
        disposition: "canonical_ready",
        priorGroundTruthCheck: {
          hasConflict: false,
        },
        reason: verifiedData.reason,
      };
    } else if (hasPriorConflict) {
      facsimileReaudit = {
        visuallyReviewed: true,
        reviewBasis: "prior_ground_truth",
        provisional: false,
        candidateOpponent: {
          name: cand.sourceResult.opponent,
          clubId: candOpponentClubId,
        },
        observedOpponent: {
          name: cand.sourceResult.opponent,
          clubId: candOpponentClubId,
          confidence: "low",
        },
        sameEvent: false,
        seniorAteam: false,
        score: {
          aafk: rev.score?.aafk ?? 0,
          opponent: rev.score?.opponent ?? 0,
          confidence: "low",
        },
        matchDate: {
          value: matchDate || "",
          confidence: "low",
        },
        homeAway: "unknown",
        competition: {
          value: rev.competition?.value || "",
          competitionId: null,
          confidence: "low",
        },
        evidenceType: "report",
        disposition: priorGt.disposition as any,
        priorGroundTruthCheck: {
          hasConflict: true,
          status: priorGt.disposition,
          note: priorGt.note,
        },
        reason: priorGt.note,
      };
    } else if (isFutureReport) {
      facsimileReaudit = {
        visuallyReviewed: false,
        reviewBasis: "deterministic_gate",
        provisional: true,
        followupReason: "temporal_invalid",
        candidateOpponent: {
          name: cand.sourceResult.opponent,
          clubId: candOpponentClubId,
        },
        observedOpponent: {
          name: cand.sourceResult.opponent,
          clubId: candOpponentClubId,
          confidence: "low",
        },
        sameEvent: false,
        seniorAteam: "uncertain",
        score: {
          aafk: rev.score?.aafk ?? 0,
          opponent: rev.score?.opponent ?? 0,
          confidence: "low",
        },
        matchDate: {
          value: matchDate || "",
          confidence: "low",
        },
        homeAway: "unknown",
        competition: {
          value: rev.competition?.value || "",
          competitionId: null,
          confidence: "low",
        },
        evidenceType: "preview",
        disposition: "wrong_event",
        priorGroundTruthCheck: {
          hasConflict: false,
        },
        reason: `Temporal impossible: Utgivelsesdato (${issueDate}) er tidligere enn påstått kampdato (${matchDate}).`,
      };
    } else if (
      cand.sourceResult.expectedScore.aafk !== rev.score?.aafk ||
      cand.sourceResult.expectedScore.opponent !== rev.score?.opponent
    ) {
      facsimileReaudit = {
        visuallyReviewed: false,
        reviewBasis: "prior_wave_review",
        provisional: true,
        followupReason: "score_conflict_from_prior_review",
        candidateOpponent: {
          name: cand.sourceResult.opponent,
          clubId: candOpponentClubId,
        },
        observedOpponent: {
          name: cand.sourceResult.opponent,
          clubId: candOpponentClubId,
          confidence: "high",
        },
        sameEvent: true,
        seniorAteam: true,
        score: {
          aafk: rev.score?.aafk ?? 0,
          opponent: rev.score?.opponent ?? 0,
          confidence: "high",
        },
        matchDate: {
          value: matchDate || "",
          confidence: rev.matchDate?.confidence || "medium",
        },
        homeAway: rev.homeAway || "unknown",
        competition: {
          value: rev.competition?.value || "",
          competitionId: normalizeCompetitionExplicit(rev.competition?.value, cand.sourceResult.year).competitionId,
          confidence: "medium",
        },
        evidenceType: "report",
        disposition: "score_conflict",
        priorGroundTruthCheck: {
          hasConflict: false,
        },
        reason: `Score-avvik: Kilde oppga ${cand.sourceResult.expectedScore.aafk}-${cand.sourceResult.expectedScore.opponent}, mens avisen dokumenterer ${rev.score?.aafk}-${rev.score?.opponent}.`,
      };
    } else {
      // Opponent mismatch or date uncertain
      const isDateUncertain = (rev.matchDate?.confidence !== "high");
      facsimileReaudit = {
        visuallyReviewed: false,
        reviewBasis: "prior_wave_review",
        provisional: true,
        followupReason: isDateUncertain ? "date_uncertain" : "suspected_wrong_event",
        candidateOpponent: {
          name: cand.sourceResult.opponent,
          clubId: candOpponentClubId,
        },
        observedOpponent: {
          name: "",
          clubId: "",
          confidence: "low",
        },
        sameEvent: false,
        seniorAteam: "uncertain",
        score: {
          aafk: rev.score?.aafk ?? 0,
          opponent: rev.score?.opponent ?? 0,
          confidence: "low",
        },
        matchDate: {
          value: matchDate || "",
          confidence: rev.matchDate?.confidence || "low",
        },
        homeAway: "unknown",
        competition: {
          value: rev.competition?.value || "",
          competitionId: null,
          confidence: "low",
        },
        evidenceType: "report",
        disposition: isDateUncertain ? "date_uncertain" : "wrong_event",
        priorGroundTruthCheck: {
          hasConflict: false,
        },
        reason: isDateUncertain
          ? `Usikker kampdato (${rev.matchDate?.confidence})`
          : `Opponent mismatch: Kildepåstand gjaldt "${cand.sourceResult.opponent}".`,
      };
    }

    auditCases.push({
      candidateId: rev.candidateId,
      sourceResult: {
        sourceId: cand.sourceResult.sourceId,
        year: cand.sourceResult.year,
        no: cand.sourceResult.no,
        opponent: cand.sourceResult.opponent,
        opponentClubId: candOpponentClubId,
        expectedScore: cand.sourceResult.expectedScore,
      },
      newspaper: {
        title: cand.newspaper.title,
        issueDate: cand.newspaper.issueDate,
        page: String(cand.newspaper.page),
        pageUrl: cand.newspaper.pageUrl,
      },
      facsimileReaudit,
    });
  }

  const counts = {
    totalAudited: auditCases.length,
    canonical_ready: auditCases.filter((c) => c.facsimileReaudit.disposition === "canonical_ready").length,
    score_conflict: auditCases.filter((c) => c.facsimileReaudit.disposition === "score_conflict").length,
    wrong_event: auditCases.filter((c) => c.facsimileReaudit.disposition === "wrong_event").length,
    non_senior: auditCases.filter((c) => c.facsimileReaudit.disposition === "non_senior").length,
    date_uncertain: auditCases.filter((c) => c.facsimileReaudit.disposition === "date_uncertain").length,
    competition_uncertain: auditCases.filter((c) => c.facsimileReaudit.disposition === "competition_uncertain").length,
    insufficient: auditCases.filter((c) => c.facsimileReaudit.disposition === "insufficient").length,
  };

  const manifest = {
    contract: "nb-canonical-review-audit@2",
    generatedAt: "2026-08-21",
    counts,
    cases: auditCases,
  };

  await writeFile(`${root}/data/discovery/nb-canonical-review-audit.yaml`, stringifyYaml(manifest), "utf8");

  const canonicalReadyCases = auditCases.filter((c) => c.facsimileReaudit.disposition === "canonical_ready");
  const followupCases = auditCases.filter((c) => c.facsimileReaudit.disposition !== "canonical_ready");

  return { manifest, canonicalReadyCases, followupCases };
}

async function main() {
  const { manifest } = await runCanonicalAudit();
  console.log("Canonical Review Audit Completed.");
  console.log(manifest.counts);
}

main().catch(console.error);
