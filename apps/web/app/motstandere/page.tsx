import type { Metadata } from "next";
import { OpponentList } from "@/components/OpponentList";
import { contributionIssueUrl } from "@/lib/contribution-links";
import { loadOpponents } from "@/lib/archive";

export const metadata: Metadata = {
  title: "Motstandere",
  description: "Innbyrdes statistikk mot alle AaFKs motstandere gjennom arkivet.",
};

export default function OpponentsPage() {
  const opponents = loadOpponents();
  const played = opponents.reduce((sum, o) => sum + o.played, 0);

  return (
    <>
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

      {/* Dubletten ses her, ikke på klubbsida: to rader med nesten samme navn står
          rett under hverandre i en alfabetisk liste. «FK Haugesund» og «Haugesund»
          sto slik i månedsvis. */}
      <section className="content-section prose-stack">
        <h2>Står en klubb to ganger?</h2>
        <p>
          Kildene skriver klubbnavn ulikt, og noen ganger blir samme klubb til to rader i
          denne lista. Klubber som har byttet navn, skal derimot stå som én rad med flere
          navneperioder. Ser du noe som ser galt ut, er det verdt å melde fra.
        </p>
        <a className="button-link" href={contributionIssueUrl("klubbidentitet")}>
          Meld dublett eller historisk navn
        </a>
      </section>
    </>
  );
}
