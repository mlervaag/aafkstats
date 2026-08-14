import React from "react";
import { ImageResponse } from "next/og";
import type { VerificationCaseView } from "@/lib/verifications";
import { loadVerificationCase } from "@/lib/verifications";
import { SOCIAL_IMAGE_SIZE, SocialCard } from "@/lib/social-card";

export const runtime = "nodejs";
export const alt = "Kan du hjelpe AaFK-arkivet?";
export const size = SOCIAL_IMAGE_SIZE;
export const contentType = "image/png";

const CATEGORY_LABELS: Record<VerificationCaseView["category"], string> = {
  role: "KLUBBHISTORIE",
  identity: "PERSON",
  match: "KAMP",
  source_reading: "KILDE",
  club: "KLUBB",
};

function questionFontSize(question: string): number {
  if (question.length <= 58) return 70;
  if (question.length <= 92) return 59;
  if (question.length <= 132) return 50;
  return 42;
}

function verificationCaseYear(item: Pick<VerificationCaseView, "question" | "claim">): string | null {
  return `${item.question} ${item.claim}`.match(/\b(?:18|19|20)\d{2}\b/)?.[0] ?? null;
}

function resolvedAnswer(item: VerificationCaseView): string {
  if (item.resolution?.answer === "yes") return "Konklusjon: JA";
  if (item.resolution?.answer === "no") return "Konklusjon: NEI";
  return "Konklusjon: IKKE AVGJORT";
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = loadVerificationCase(id);

  if (!item || item.publishedAt === null) {
    return new ImageResponse(
      <SocialCard
        eyebrow="AaFK-arkivet"
        title="Arkivsaken finnes ikke"
        subtitle="Se de åpne spørsmålene og hjelp oss med en kilde."
        footer="Historien trenger en kilde"
      />,
      size,
    );
  }

  const year = verificationCaseYear(item);
  const isResolved = item.status === "resolved" || item.status === "rejected";
  const context = [CATEGORY_LABELS[item.category], year].filter(Boolean).join(" · ");

  return new ImageResponse(
    <SocialCard
      eyebrow={`${isResolved ? "LØST" : "KAN DU HJELPE ARKIVET?"} · ${context}`}
      title={
        <span style={{ fontSize: questionFontSize(item.question) }}>
          {item.question}
        </span>
      }
      subtitle={
        <span style={{ color: "#e2570f", fontSize: 38, fontWeight: 800 }}>
          {isResolved ? resolvedAnswer(item) : "JA eller NEI?"}
        </span>
      }
      footer={isResolved ? "Se kildene bak svaret" : "Historien trenger en kilde"}
    />,
    size,
  );
}
