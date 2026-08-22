import type { Metadata } from "next";
import { CaseDirectory } from "@/components/verifications/CaseDirectory";
import { pageMetadata } from "@/lib/metadata";
import { loadVerificationCases } from "@/lib/verifications";

export const metadata: Metadata = pageMetadata(
  "Saker å kontrollere",
  "Velg et konkret spørsmål og hjelp AaFK-arkivet med manuell kildekontroll.",
  "/mangler/saker",
  "website",
);

export default async function VerificationCasesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const params = await searchParams;
  const type = Array.isArray(params.type) ? params.type[0] : params.type;
  const initialCategory = type === "avisresearch"
    ? "research"
    : type === "avis"
      ? "newspaper_match"
      : type === "direkte"
        ? "direct"
        : "all";
  const cases = loadVerificationCases("open");
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Manuell kildekontroll</p>
        <h1>Velg en sak</h1>
        <p className="lede">
          Velg mellom avisresearch, en konkret JA/NEI-sak fra en avisside og direkte
          kildekontroll. Research-sakene hjelper deg å velge riktig kamp, dato eller
          kildepåstand uten å late som kilden er sikrere enn den er.
        </p>
      </header>
      <CaseDirectory cases={cases} initialCategory={initialCategory} />
    </>
  );
}
