import { ImageResponse } from "next/og";
import { one, open } from "@aafkstats/db";
import { formatDate } from "@/lib/date";
import { SOCIAL_IMAGE_SIZE, SocialCard } from "@/lib/social-card";

export const runtime = "nodejs";
export const alt = "Kamp i AaFK arkivet";
export const size = SOCIAL_IMAGE_SIZE;
export const contentType = "image/png";

interface MatchImageRow {
  id: string;
  match_date: string;
  status: string;
  competition_name: string;
  home_name: string;
  away_name: string;
  home_score: number | null;
  away_score: number | null;
  home_et_score: number | null;
  away_et_score: number | null;
  home_pens: number | null;
  away_pens: number | null;
  venue_name: string | null;
  attendance: number | null;
}

function loadMatch(id: string): MatchImageRow | undefined {
  const db = open();
  try {
    return one<MatchImageRow>(
      db,
      `SELECT m.id, m.match_date, m.status, m.competition_name,
              h.name AS home_name, a.name AS away_name,
              m.home_score, m.away_score, m.home_et_score, m.away_et_score,
              m.home_pens, m.away_pens, m.venue_name, m.attendance
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
        subtitle="Se kampoversikten i AaFK arkivet."
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

  const score = played && homeScore !== null && awayScore !== null
    ? `${homeScore}–${awayScore}`
    : "mot";

  const penaltyText =
    match.home_pens !== null && match.away_pens !== null
      ? `Straffer ${match.home_pens}–${match.away_pens}`
      : null;

  const subtitleParts = [
    match.competition_name,
    formatDate(match.match_date),
    match.venue_name,
  ].filter(Boolean);

  return new ImageResponse(
    <SocialCard
      eyebrow="Kamp i AaFK arkivet"
      title={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "18px",
          }}
        >
          <span>{match.home_name}</span>
          <span style={{ color: "#e2570f" }}>{score}</span>
          <span>{match.away_name}</span>
        </div>
      }
      subtitle={subtitleParts.join(" · ")}
      stats={[
        ...(penaltyText ? [{ label: "Avgjørelse", value: penaltyText }] : []),
        ...(match.attendance
          ? [{ label: "Tilskuere", value: match.attendance.toLocaleString("nb-NO") }]
          : []),
      ]}
      footer={`aafkarkivet.no/kamp/${id}`}
    />,
    size,
  );
}
