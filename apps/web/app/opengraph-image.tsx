import React from "react";
import { ImageResponse } from "next/og";
import { loadOverview } from "@/lib/archive";
import { SOCIAL_IMAGE_SIZE, SocialCard } from "@/lib/social-card";

export const runtime = "nodejs";
export const alt = "AaFK-arkivet, uoffisielt historisk arkiv";
export const size = SOCIAL_IMAGE_SIZE;
export const contentType = "image/png";

export default function Image() {
  const { totals } = loadOverview();

  return new ImageResponse(
    <SocialCard
      eyebrow="Uoffisielt historisk arkiv"
      title="AaFK-arkivet"
      subtitle="Kamper, sesonger, motstandere, personer og historiske kilder samlet på ett sted."
      stats={[
        { label: "Kamper", value: totals.matches.toLocaleString("nb-NO") },
        { label: "År", value: totals.seasons },
        { label: "Motstandere", value: totals.opponents },
      ]}
    />,
    size,
  );
}
