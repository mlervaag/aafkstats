import React from "react";
import { ImageResponse } from "next/og";
import { loadSeason } from "@/lib/archive";
import { SOCIAL_IMAGE_SIZE, SocialCard } from "@/lib/social-card";

export const runtime = "nodejs";
export const alt = "AaFK sesong i AaFK-arkivet";
export const size = SOCIAL_IMAGE_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year: rawYear } = await params;
  const year = Number(rawYear);
  const data = Number.isInteger(year) ? loadSeason(year) : undefined;
  const lead = data?.summaries[0];

  if (!data || !lead) {
    return new ImageResponse(
      <SocialCard
        eyebrow="Sesong"
        title={`AaFK ${rawYear}`}
        subtitle="Historiske resultater og kilder i AaFK-arkivet."
        footer={`aafkarkivet.no/sesong/${rawYear}`}
      />,
      size,
    );
  }

  const stats = [
    { label: "Kamper", value: lead.played },
    { label: "Seire", value: lead.wins },
    { label: "Uavgjort", value: lead.draws },
    { label: "Tap", value: lead.losses },
    { label: "Mål", value: `${lead.goalsFor}–${lead.goalsAgainst}` },
  ];

  if (lead.finalPosition !== null) {
    stats.push({ label: "Plass", value: `${lead.finalPosition}.` });
  }

  return new ImageResponse(
    <SocialCard
      eyebrow={lead.competition}
      title={
        <div style={{ display: "flex", alignItems: "baseline", gap: "24px" }}>
          <span>AaFK</span>
          <span style={{ color: "#e2570f" }}>{year}</span>
        </div>
      }
      subtitle={`${lead.played} kamper i ${lead.competition}`}
      stats={stats.slice(0, 5)}
      footer={`aafkarkivet.no/sesong/${year}`}
    />,
    size,
  );
}
