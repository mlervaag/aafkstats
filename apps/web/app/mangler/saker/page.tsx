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
        <p className="lede">Kontroller en kilde og svar JA, NEI eller KAN IKKE BESTEMMES. Start med et navn, år eller tema du kjenner.</p>
      </header>
      <CaseDirectory cases={cases} />
    </>
  );
}
