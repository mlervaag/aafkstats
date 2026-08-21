import type { Metadata } from "next";
import { VerificationExperience } from "@/components/verifications/VerificationExperience";
import { VerificationHistory } from "@/components/verifications/VerificationHistory";
import { pageMetadata } from "@/lib/metadata";
import { loadVerificationCases } from "@/lib/verifications";

export const metadata: Metadata = pageMetadata(
  "Hjelp AaFK-arkivet",
  "Kontroller ett konkret spørsmål i en historisk kilde. Ingen konto kreves, og alle funn vurderes før arkivet endres.",
  "/mangler",
  "website",
);

export default function VerificationPage() {
  const cases = loadVerificationCases("all").filter((item) => item.publishedAt !== null);
  return (
    <>
      <VerificationExperience cases={cases.filter((item) => item.status === "open")} />
      <VerificationHistory cases={cases} />
    </>
  );
}
