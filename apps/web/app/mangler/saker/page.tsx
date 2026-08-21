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

export default function VerificationCasesPage() {
  const cases = loadVerificationCases("open");
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">Manuell kildekontroll</p>
        <h1>Velg en sak</h1>
        <p className="lede">
          Kontroller en kilde og svar JA, NEI eller KAN IKKE BESTEMMES. Velg mellom en
          konkret avisside om en kamp og direkte kildekontroll av en påstand eller konflikt.
        </p>
      </header>
      <CaseDirectory cases={cases} />
    </>
  );
}
