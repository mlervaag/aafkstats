import React from "react";
import { ImageResponse } from "next/og";
import { loadOpponent } from "@/lib/archive";
import { SOCIAL_IMAGE_SIZE, SocialCard } from "@/lib/social-card";

export const runtime = "nodejs";
export const alt = "Innbyrdes statistikk for AaFK";
export const size = SOCIAL_IMAGE_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = loadOpponent(id);

  if (!data) {
    return new ImageResponse(
      <SocialCard
        eyebrow="Innbyrdes oppgjør"
        title="AaFK mot ukjent motstander"
        subtitle="Se kampene i AaFK-arkivet."
      />,
      size,
    );
  }

  const { summary } = data;
  const span = summary.lastMeeting && summary.lastMeeting !== summary.firstMeeting
    ? `${summary.firstMeeting.slice(0, 4)} til ${summary.lastMeeting.slice(0, 4)}`
    : summary.firstMeeting.slice(0, 4);

  return new ImageResponse(
    <SocialCard
      eyebrow={`Innbyrdes oppgjør · ${span}`}
      title={
        <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap" }}>
          <span>AaFK mot&nbsp;</span>
          <span style={{ color: "#e2570f" }}>{summary.opponent}</span>
        </div>
      }
      subtitle={`${summary.played} registrerte ${summary.played === 1 ? "kamp" : "kamper"} i arkivet`}
      stats={[
        { label: "Seire", value: summary.wins },
        { label: "Uavgjort", value: summary.draws },
        { label: "Tap", value: summary.losses },
        { label: "Mål", value: `${summary.goalsFor}–${summary.goalsAgainst}` },
      ]}
      footer={`aafkarkivet.no/motstander/${id}`}
    />,
    size,
  );
}
