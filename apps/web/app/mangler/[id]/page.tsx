import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VerificationExperience } from "@/components/verifications/VerificationExperience";
import { loadVerificationCase, loadVerificationCases } from "@/lib/verifications";

export const dynamicParams = false;

export function generateStaticParams() {
  return loadVerificationCases("open").map((item) => ({ id: item.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const item = loadVerificationCase(id);
  if (!item || item.status !== "open") return {};
  return {
    title: item.question,
    description: `Kan du kontrollere denne påstanden for AaFK-arkivet? Tar omtrent ${item.estimatedMinutes} minutter.`,
    alternates: { canonical: `/mangler/${item.id}` },
    robots: { index: false, follow: true },
    openGraph: { title: item.question, description: item.context, type: "article", url: `/mangler/${item.id}` },
  };
}

export default async function VerificationCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const selected = loadVerificationCase(id);
  if (!selected || selected.status !== "open") notFound();
  return <VerificationExperience cases={loadVerificationCases("open")} startCaseId={selected.id} />;
}
