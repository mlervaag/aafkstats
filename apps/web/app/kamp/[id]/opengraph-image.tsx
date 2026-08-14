import React from "react";
import { ImageResponse } from "next/og";
import { one, open } from "@aafkstats/db";
import { formatDate } from "@/lib/date";
import { SOCIAL_IMAGE_SIZE, SocialCard } from "@/lib/social-card";

export const runtime = "nodejs";
export const alt = "Kamp i AaFK-arkivet";
export const size = SOCIAL_IMAGE_SIZE;
export const contentType = "image/png";

interface MatchImageRow {
  id: string;
  match_date: string;
  status: string;
  season: number;
  is_home: number;
  opponent_name: string;
  home_name: string;
  away_name: string;
  home_score: number | null;
  away_score: number | null;
  home_et_score: number | null;
  away_et_score: number | null;
  home_pens: number | null;
  away_pens: number | null;
}

function titleFontSize(home: string, away: string): number {
  const len = home.length + away.length;
  if (len <= 20) return 72;
  if (len <= 30) return 58;
  if (len <= 40) return 48;
  return 40;
}

function loadMatch(id: string): MatchImageRow | undefined {
  const db = open();
  try {
    return one<MatchImageRow>(
      db,
      `SELECT m.id, m.match_date, m.status, m.season,
              m.is_home, m.opponent_name,
              h.name AS home_name, a.name AS away_name,
              m.home_score, m.away_score,
              m.home_et_score, m.away_et_score, m.home_pens, m.away_pens
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
        eyebrow="Kamp"
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

  let scoreText = "mot";
  if (played && homeScore !== null && awayScore !== null) {
    scoreText = `${homeScore}–${awayScore}`;
  }

  let dateSubtitle = formatDate(match.match_date);
  if (match.home_pens !== null && match.away_pens !== null) {
    dateSubtitle = `${dateSubtitle} (${match.home_pens}–${match.away_pens} e.str.)`;
  } else if (match.status === "postponed") {
    dateSubtitle = `${dateSubtitle} · Utsatt`;
  } else if (match.status === "cancelled") {
    dateSubtitle = `${dateSubtitle} · Avlyst`;
  }

  return new ImageResponse(
    <SocialCard
      eyebrow={`Sesongen ${match.season}`}
      title={
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: "18px",
            fontSize: titleFontSize(homeName, awayName),
            lineHeight: 1.1,
          }}
        >
          <span>{homeName}</span>
          <span style={{ color: "#e2570f" }}>{scoreText}</span>
          <span>{awayName}</span>
        </div>
      }
      subtitle={dateSubtitle}
      footer={`aafkarkivet.no/kamp/${id}`}
    />,
    size,
  );
}
