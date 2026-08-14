import React from "react";
import { ImageResponse } from "next/og";
import { loadSeason } from "@/lib/archive";
import { SOCIAL_IMAGE_SIZE, SocialCard } from "@/lib/social-card";

export const runtime = "nodejs";
export const alt = "Sesong i AaFK-arkivet";
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

  if (!data) {
    return new ImageResponse(
      <SocialCard
        eyebrow="Sesong i AaFK-arkivet"
        title="Sesongen finnes ikke"
        subtitle="Se sesongoversikten i AaFK-arkivet."
        footer={`aafkarkivet.no/sesong/${rawYear}`}
      />,
      size,
    );
  }

  const { summaries, sourceResults } = data;
  const lead = summaries[0] ?? null;

  if (!lead) {
    return new ImageResponse(
      <SocialCard
        eyebrow="Historiske kilder · Sesongoversikt"
        title={
          <div style={{ display: "flex", alignItems: "baseline", gap: "20px" }}>
            <span style={{ fontSize: 72, fontWeight: 800, color: "#16130f" }}>Sesongen</span>
            <span style={{ fontSize: 72, fontWeight: 800, color: "#e2570f" }}>{year}</span>
          </div>
        }
        subtitle={`${sourceResults.length} kildedokumenterte oppgjør fra historiske publikasjoner.`}
        stats={[
          { label: "Kilderesultater", value: sourceResults.length },
          { label: "Status", value: "Ufullstendig" },
        ]}
        footer={`aafkarkivet.no/sesong/${year}`}
      />,
      size,
    );
  }

  const totalPlayed = summaries.reduce((sum, s) => sum + s.played, 0);
  const hasMultipleComps = summaries.length > 1;

  const eyebrowParts = [
    lead.competition,
    lead.competitionTier ? `Nivå ${lead.competitionTier}` : null,
    "Sesongoversikt",
  ].filter(Boolean);

  let subtitle = `${lead.competition} · ${lead.played} seriekamper`;
  if (hasMultipleComps) {
    const otherNames = summaries.slice(1).map((s) => s.competition).join(", ");
    subtitle = `${lead.competition} og ${otherNames} · ${totalPlayed} kamper totalt`;
  }

  const stats: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Kamper", value: lead.played },
    { label: "Seire", value: lead.wins },
    { label: "Uavgjort", value: lead.draws },
    { label: "Tap", value: lead.losses },
    { label: "Mål", value: `${lead.goalsFor}–${lead.goalsAgainst}` },
  ];

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
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: "20px" }}>
            <span style={{ fontSize: 72, fontWeight: 800, color: "#16130f" }}>Sesongen</span>
            <span style={{ fontSize: 72, fontWeight: 800, color: "#e2570f" }}>{year}</span>
          </div>
          {lead.finalPosition !== null && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 24px",
                borderRadius: 16,
                background: "rgba(226, 87, 15, 0.12)",
                border: "2px solid #e2570f",
                color: "#e2570f",
                fontSize: 34,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {lead.finalPosition}. plass
            </div>
          )}
        </div>
      }
      subtitle={subtitle}
      stats={stats}
      footer={`aafkarkivet.no/sesong/${year}`}
    />,
    size,
  );
}
