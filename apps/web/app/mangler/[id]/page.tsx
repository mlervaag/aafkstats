import type { Metadata } from "next";
import { notFound } from "next/navigation";
import React from "react";
import { VerificationExperience } from "@/components/verifications/VerificationExperience";
import { VerificationCaseOutcome } from "@/components/verifications/VerificationCaseOutcome";
import { loadVerificationCase, loadVerificationCases } from "@/lib/verifications";

export const dynamicParams = false;

export function generateStaticParams() {
  return loadVerificationCases("all")
    .filter((item) => item.publishedAt !== null)
    .map((item) => ({ id: item.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const item = loadVerificationCase(id);
  if (!item || item.publishedAt === null) return {};
  const description = item.status === "open"
    ? `Kan du kontrollere denne påstanden for AaFK-arkivet? Tar omtrent ${item.estimatedMinutes} minutter.`
    : `Se arkivets konklusjon og dokumentasjon for: ${item.question}`;
  return {
    title: item.question,
    description,
    alternates: { canonical: `/mangler/${item.id}` },
    robots: { index: false, follow: true },
    openGraph: { title: item.question, description, type: "article", url: `/mangler/${item.id}` },
  };
}

export default async function VerificationCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const selected = loadVerificationCase(id);
  if (!selected || selected.publishedAt === null) notFound();
  if (selected.status !== "open") return <VerificationCaseOutcome item={selected} />;
  return <VerificationExperience cases={loadVerificationCases("open")} startCaseId={selected.id} />;
}
