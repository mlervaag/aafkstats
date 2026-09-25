import type { Metadata } from "next";

/**
 * Egen tittel, så fanen og nettleserhistorikken ikke bare sier «AaFK-arkivet»
 * for en side som ikke finnes. `noindex` legger Next.js på selv.
 */
export const metadata: Metadata = { title: "Fant ikke siden" };

/**
 * En blindvei med bare «tilbake til forsiden» sender leseren til start. De fleste
 * som havner her, lette etter en kamp, en sesong eller en person — så de vanligste
 * inngangene står her, og søket i toppen dekker resten.
 */
export default function NotFound() {
  return (
    <section className="empty-state">
      <p className="eyebrow">404</p>
      <h1>Denne siden finnes ikke</h1>
      <p>Adressen kan være feil, eller siden kan ha blitt flyttet. Bruk søket øverst, eller gå rett til:</p>
      <p>
        <a href="/sesonger">Sesonger</a> · <a href="/motstandere">Motstandere</a> ·{" "}
        <a href="/personer">Personer</a> · <a href="/kilder">Kilder</a>
      </p>
      <a className="button-link" href="/">Tilbake til arkivet</a>
    </section>
  );
}
