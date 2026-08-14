import React from "react";
import { ImageResponse } from "next/og";
import { one, open } from "@aafkstats/db";
import { formatDate, formatDateShort } from "@/lib/date";
import { SOCIAL_IMAGE_SIZE, SocialCard } from "@/lib/social-card";

export const runtime = "nodejs";
export const alt = "Kamp i AaFK-arkivet";
export const size = SOCIAL_IMAGE_SIZE;
export const contentType = "image/png";

interface MatchImageRow {
  id: string;
  match_date: string;
  status: string;
  competition_name: string;
  season: number;
  stage: string;
  round: number | null;
  is_home: number;
  opponent_name: string;
  home_name: string;
  away_name: string;
  home_score: number | null;
  away_score: number | null;
  home_ht_score: number | null;
  away_ht_score: number | null;
  home_et_score: number | null;
  away_et_score: number | null;
  home_pens: number | null;
  away_pens: number | null;
  result: "S" | "U" | "T" | null;
  venue_name: string | null;
  attendance: number | null;
}

const STAGE_LABELS: Record<string, string> = {
  group: "Gruppespill",
  qualifying: "Kvalifisering",
  round_of_32: "16-delsfinale",
  round_of_16: "Åttedelsfinale",
  quarter_final: "Kvartfinale",
  semi_final: "Semifinale",
  third_place: "Bronsefinale",
  final: "Finale",
  promotion_playoff: "Opprykkskvalifisering",
  relegation_playoff: "Nedrykkskvalifisering",
  friendly: "Treningskamp",
};

function formatStageOrRound(stage: string, round: number | null): string | null {
  if (stage !== "regular_season" && stage !== "friendly" && STAGE_LABELS[stage]) {
    return STAGE_LABELS[stage];
  }
  if (round !== null && round > 0) {
    return `${round}. runde`;
  }
  if (stage === "friendly") {
    return "Treningskamp";
  }
  return null;
}

function teamFontSize(name: string): number {
  if (name.length <= 12) return 56;
  if (name.length <= 18) return 46;
  if (name.length <= 26) return 38;
  return 32;
}

function loadMatch(id: string): MatchImageRow | undefined {
  const db = open();
  try {
    return one<MatchImageRow>(
      db,
      `SELECT m.id, m.match_date, m.status, m.competition_name, m.season, m.stage, m.round,
              m.is_home, m.opponent_name,
              h.name AS home_name, a.name AS away_name,
              m.home_score, m.away_score, m.home_ht_score, m.away_ht_score,
              m.home_et_score, m.away_et_score, m.home_pens, m.away_pens,
              m.result, m.venue_name, m.attendance
       FROM core_matches m
       JOIN core_clubs h ON h.id = m.home_club_id
       JOIN core_clubs a ON a.id = m.away_club_id
       WHERE m.id = ?`,
      id,
    );
  } finally {
    db.close();
  }
}

function isPlayed(status: string): boolean {
  return status === "played" || status === "awarded";
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = loadMatch(id);

  if (!match) {
    return new ImageResponse(
      <SocialCard
        eyebrow="Kamp i AaFK-arkivet"
        title="Kampen finnes ikke"
        subtitle="Se kampoversikten i AaFK-arkivet."
        footer={`aafkarkivet.no/kamp/${id}`}
      />,
      size,
    );
  }

  const played = isPlayed(match.status);
  const homeScore = match.home_score === null
    ? null
    : match.home_score + (match.home_et_score ?? 0);
  const awayScore = match.away_score === null
    ? null
    : match.away_score + (match.away_et_score ?? 0);

  const homeName = match.is_home === 1 ? match.home_name : match.opponent_name;
  const awayName = match.is_home === 1 ? match.opponent_name : match.away_name;

  let scoreText = "MOT";
  if (played && homeScore !== null && awayScore !== null) {
    scoreText = `${homeScore}–${awayScore}`;
  } else if (match.status === "postponed") {
    scoreText = "UTSATT";
  } else if (match.status === "cancelled") {
    scoreText = "AVLYST";
  }

  const stageOrRound = formatStageOrRound(match.stage, match.round);
  const eyebrowParts = [
    match.competition_name,
    stageOrRound,
    String(match.season),
  ].filter(Boolean);

  const dateStr = formatDate(match.match_date);
  const venueStr = match.venue_name;
  const htStr = (match.home_ht_score !== null && match.away_ht_score !== null)
    ? `Pause: ${match.home_ht_score}–${match.away_ht_score}`
    : null;
  const penStr = (match.home_pens !== null && match.away_pens !== null)
    ? `Straffer: ${match.home_pens}–${match.away_pens}`
    : null;

  const subtitleParts = [
    dateStr,
    venueStr,
    penStr ?? htStr,
  ].filter(Boolean);

  const stats: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Dato", value: formatDateShort(match.match_date) },
  ];

  if (played && homeScore !== null && awayScore !== null) {
    let outcome = "Spilt";
    if (match.result === "S") outcome = "AaFK-seier";
    else if (match.result === "U") outcome = "Uavgjort";
    else if (match.result === "T") outcome = "AaFK-tap";

    stats.push({ label: "Utfall", value: outcome });
  } else if (match.status === "scheduled") {
    stats.push({ label: "Status", value: "Terminfestet" });
  } else if (match.status === "postponed") {
    stats.push({ label: "Status", value: "Utsatt" });
  } else if (match.status === "cancelled") {
    stats.push({ label: "Status", value: "Avlyst" });
  }

  if (match.attendance !== null && match.attendance > 0) {
    stats.push({
      label: "Tilskuere",
      value: match.attendance.toLocaleString("nb-NO"),
    });
  } else if (htStr) {
    stats.push({
      label: "Pause",
      value: `${match.home_ht_score}–${match.away_ht_score}`,
    });
  }

  if (match.venue_name) {
    stats.push({
      label: "Bane",
      value: match.venue_name.replace(" stadion", "").replace(" Stadion", ""),
    });
  }

  return new ImageResponse(
    <SocialCard
      eyebrow={eyebrowParts.join(" · ")}
      title={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            gap: "20px",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              justifyContent: "flex-end",
              textAlign: "right",
              fontSize: teamFontSize(homeName),
              lineHeight: 1.05,
              fontWeight: 800,
            }}
          >
            {homeName}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: played ? "8px 24px" : "6px 20px",
              borderRadius: 16,
              background: played ? "rgba(226, 87, 15, 0.12)" : "rgba(0, 0, 0, 0.05)",
              border: `2px solid ${played ? "#e2570f" : "#d8cfc2"}`,
              color: played ? "#e2570f" : "#6b6259",
              fontSize: played ? 56 : 34,
              fontWeight: 800,
              letterSpacing: played ? "-0.02em" : "0.05em",
              flexShrink: 0,
            }}
          >
            {scoreText}
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              justifyContent: "flex-start",
              textAlign: "left",
              fontSize: teamFontSize(awayName),
              lineHeight: 1.05,
              fontWeight: 800,
            }}
          >
            {awayName}
          </div>
        </div>
      }
      subtitle={subtitleParts.join(" · ")}
      stats={stats.slice(0, 4)}
      footer={`aafkarkivet.no/kamp/${id}`}
    />,
    size,
  );
}
