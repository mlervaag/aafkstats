import { readFile, writeFile } from "node:fs/promises";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { repoRoot } from "../load.js";

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
  visualReview: {
    sameMatch: boolean;
    opponent: {
      name: string;
      clubId: string;
      confidence: "high" | "medium" | "low";
    };
    score: {
      aafk: number;
      opponent: number;
      status: "confirmed" | "conflict";
    };
    matchDate: {
      value: string;
      confidence: "high" | "medium" | "low";
    };
    homeAway: "home" | "away" | "neutral";
    competition: {
      value: string;
      competitionId: string | null;
      confidence: "high" | "medium" | "low";
    };
    evidenceType: "report" | "result_board" | "retrospective" | "preview" | "other";
    temporalValid: boolean;
  };
  opponentIdentityMatches: boolean;
  auditDisposition:
    | "canonical_ready"
    | "score_conflict"
    | "opponent_mismatch"
    | "temporal_invalid"
    | "date_uncertain"
    | "competition_uncertain"
    | "rejected";
  failureReasons: string[];
  incidentalMatch?: {
    date: string;
    homeClubId: string;
    awayClubId: string;
    score: [number, number];
  };
  reason: string;
}

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

export function extractReviewedOpponentFromReason(reason: string): { name: string; clubId: string } {
  if (!reason) return { name: "", clubId: "" };
  const lower = reason.toLowerCase();

  // Check known clubs in reverse length order
  const clubKeys = Object.keys(clubAliasMap).sort((a, b) => b.length - a.length);
  for (const key of clubKeys) {
    if (lower.includes(key.toLowerCase())) {
      return { name: key, clubId: clubAliasMap[key]! };
    }
  }
  return { name: "", clubId: "" };
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
  if (c.includes("serie") || c.includes("seriekamp")) {
    if (year >= 1948 && year <= 1962) return { competitionId: "forstedivisjon", confidence: "high" };
    if (year >= 1963 && year <= 1990) return { competitionId: "andredivisjon", confidence: "medium" };
  }
  return { competitionId: null, confidence: "low" };
}

export async function runCanonicalAudit(): Promise<{
  manifest: any;
  canonicalReadyCases: CanonicalAuditCase[];
  followupCases: CanonicalAuditCase[];
}> {
  const root = repoRoot();

  const candidateQueueRaw = parseYaml(await readFile(`${root}/data/discovery/community-candidate-queue.yaml`, "utf8"), { schema: "core" });
  const wave1Raw = parseYaml(await readFile(`${root}/data/discovery/community-ai-review-wave-1.yaml`, "utf8"), { schema: "core" });
  const wave2Raw = parseYaml(await readFile(`${root}/data/discovery/community-ai-review-wave-2.yaml`, "utf8"), { schema: "core" });

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
    const reviewedOpponent = extractReviewedOpponentFromReason(rev.reason);
    const issueDate = cand.newspaper.issueDate;
    const matchDate = rev.matchDate?.value;
    const dateConfidence = rev.matchDate?.confidence || "low";
    const compNormalized = normalizeCompetitionExplicit(rev.competition?.value, cand.sourceResult.year);

    const isFutureReport = (issueDate && matchDate && issueDate < matchDate);
    const opponentIdentityMatches = (candOpponentClubId === reviewedOpponent.clubId && candOpponentClubId !== "");
    const scoreMatches = (
      cand.sourceResult.expectedScore.aafk === rev.score?.aafk &&
      cand.sourceResult.expectedScore.opponent === rev.score?.opponent
    );
    const dateExact = (dateConfidence === "high");
    const compValid = (compNormalized.competitionId !== null);

    const failureReasons: string[] = [];
    let auditDisposition: CanonicalAuditCase["auditDisposition"] = "canonical_ready";

    if (!opponentIdentityMatches) {
      auditDisposition = "opponent_mismatch";
      failureReasons.push(`Opponent mismatch: candidate claimed "${cand.sourceResult.opponent}" (${candOpponentClubId}), but visual review found "${reviewedOpponent.name}" (${reviewedOpponent.clubId})`);
    }

    if (isFutureReport) {
      auditDisposition = "temporal_invalid";
      failureReasons.push(`Temporal impossible: issueDate ${issueDate} is earlier than matchDate ${matchDate}`);
    }

    if (opponentIdentityMatches && !isFutureReport && !scoreMatches) {
      auditDisposition = "score_conflict";
      failureReasons.push(`Score conflict: candidate claimed ${cand.sourceResult.expectedScore.aafk}-${cand.sourceResult.expectedScore.opponent}, but visual review documented ${rev.score?.aafk}-${rev.score?.opponent}`);
    }

    if (opponentIdentityMatches && !isFutureReport && scoreMatches && !dateExact) {
      auditDisposition = "date_uncertain";
      failureReasons.push(`Date confidence is '${dateConfidence}' (requires exact/high)`);
    }

    if (opponentIdentityMatches && !isFutureReport && scoreMatches && dateExact && !compValid) {
      auditDisposition = "competition_uncertain";
      failureReasons.push(`Competition '${rev.competition?.value}' could not be unambiguously mapped without broad fallbacks`);
    }

    // Check evidence type
    let evidenceType: CanonicalAuditCase["visualReview"]["evidenceType"] = "report";
    if (rev.flags?.includes("result_board")) evidenceType = "result_board";
    else if (rev.flags?.includes("preview")) evidenceType = "preview";
    else if (rev.flags?.includes("retrospective")) evidenceType = "retrospective";

    // Build incidental match record if real match against different opponent
    let incidentalMatch: CanonicalAuditCase["incidentalMatch"] = undefined;
    if (!opponentIdentityMatches && reviewedOpponent.clubId && matchDate && !isFutureReport && dateExact) {
      const homeAway = rev.homeAway || "home";
      const aafkScore = rev.score?.aafk ?? 0;
      const oppScore = rev.score?.opponent ?? 0;
      incidentalMatch = {
        date: matchDate,
        homeClubId: homeAway === "away" ? reviewedOpponent.clubId : "aalesunds-fk",
        awayClubId: homeAway === "away" ? "aalesunds-fk" : reviewedOpponent.clubId,
        score: homeAway === "away" ? [oppScore, aafkScore] : [aafkScore, oppScore],
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
      visualReview: {
        sameMatch: opponentIdentityMatches && !isFutureReport,
        opponent: {
          name: reviewedOpponent.name,
          clubId: reviewedOpponent.clubId,
          confidence: reviewedOpponent.clubId ? "high" : "low",
        },
        score: {
          aafk: rev.score?.aafk,
          opponent: rev.score?.opponent,
          status: scoreMatches ? "confirmed" : "conflict",
        },
        matchDate: {
          value: matchDate,
          confidence: dateConfidence,
        },
        homeAway: rev.homeAway || "home",
        competition: {
          value: rev.competition?.value || "",
          competitionId: compNormalized.competitionId,
          confidence: compNormalized.confidence,
        },
        evidenceType,
        temporalValid: !isFutureReport,
      },
      opponentIdentityMatches,
      auditDisposition,
      failureReasons,
      incidentalMatch,
      reason: rev.reason,
    });
  }

  const counts: Record<string, number> = {
    totalAudited: auditCases.length,
    canonical_ready: auditCases.filter((c) => c.auditDisposition === "canonical_ready").length,
    score_conflict: auditCases.filter((c) => c.auditDisposition === "score_conflict").length,
    opponent_mismatch: auditCases.filter((c) => c.auditDisposition === "opponent_mismatch").length,
    temporal_invalid: auditCases.filter((c) => c.auditDisposition === "temporal_invalid").length,
    date_uncertain: auditCases.filter((c) => c.auditDisposition === "date_uncertain").length,
    competition_uncertain: auditCases.filter((c) => c.auditDisposition === "competition_uncertain").length,
    rejected: auditCases.filter((c) => c.auditDisposition === "rejected").length,
  };

  const manifest = {
    contract: "nb-canonical-review-audit@1",
    generatedAt: "2026-08-21",
    counts,
    cases: auditCases,
  };

  await writeFile(`${root}/data/discovery/nb-canonical-review-audit.yaml`, stringifyYaml(manifest), "utf8");

  const canonicalReadyCases = auditCases.filter((c) => c.auditDisposition === "canonical_ready");
  const followupCases = auditCases.filter((c) => c.auditDisposition !== "canonical_ready");

  return { manifest, canonicalReadyCases, followupCases };
}

async function main() {
  const { manifest } = await runCanonicalAudit();
  console.log("Canonical Review Audit Completed.");
  console.log(manifest.counts);
}

main().catch(console.error);
