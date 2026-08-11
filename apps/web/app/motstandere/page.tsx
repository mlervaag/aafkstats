import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { JsonLd } from "@/components/JsonLd";
import { collectionJsonLd } from "@/lib/jsonld";
import { OpponentList } from "@/components/OpponentList";
import { loadOpponents } from "@/lib/archive";

export const metadata: Metadata = pageMetadata(
  "Motstandere",
  "Innbyrdes statistikk mot alle AaFKs motstandere gjennom arkivet.",
  "/motstandere",
  "website",
);

export default function OpponentsPage() {
  const opponents = loadOpponents();
  const played = opponents.reduce((sum, o) => sum + o.played, 0);

  return (
    <>
      <JsonLd
        data={collectionJsonLd({
          name: "Motstandere",
          description: "Innbyrdes statistikk mot alle AaFKs motstandere gjennom arkivet.",
          path: "/motstandere",
          size: opponents.length,
        })}
      />
      <header className="page-intro">
        <p className="eyebrow">{opponents.length} lag</p>
        <h1>Motstandere</h1>
        {/* Sto som «i de ligakampene som foreløpig finnes i arkivet». Viewet
            teller alt: cup, europacup og treningskamper også — APOEL Nicosia sto
            i lista og hadde aldri spilt en seriekamp mot AaFK. */}
        <p className="lede">
          Innbyrdes statistikk fra alle {played} kampene i arkivet, uansett konkurranse.
          Målene er sett fra AaFKs side.
        </p>
      </header>
      <OpponentList opponents={opponents} />
    </>
  );
}
