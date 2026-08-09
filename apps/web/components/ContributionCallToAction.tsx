/**
 * Oppfordringen nederst i kildearkivet.
 *
 * Den peker til GitHub og ikke til bidragsskjemaet, og det er et bevisst valg.
 * Skjemaet sender inn et bidrag om «en kamp eller en sesong» — det er de to
 * verdiene `scope` har. Et tips om en bok eller et medlemsblad er ingen av
 * delene, og da fantes det ikke noe riktig `targetId` å sende med. Løsningen var
 * å sende inneværende årstall, som gjorde et tips om et blad fra 1972 til et
 * bidrag merket «Sesong 2026» i innboksen, og som skiftet mening ved nyttår.
 *
 * Kildearkivet vokser dessuten med rettighetsstatus per kilde, ikke med fritekst.
 * Et tips herfra må gjennom en vurdering skjemaet ikke spør om, og da er en sak
 * med en mal som spør om det, den korteste veien.
 */
export function ContributionCallToAction() {
  return (
    <section className="source-tip">
      <h2>Mangler vi noe?</h2>
      <p>
        Tips oss om en bok, et medlemsblad, et jubileumsskrift eller annet AaFK-materiale du
        mener burde vært i kildearkivet. Vet du hvem som har rettighetene, ta det med — det
        er den delen som tar lengst tid å finne ut av.
      </p>
      <a
        className="button-link"
        href="https://github.com/mlervaag/aafkstats/issues/new?template=forslag.yml"
      >
        Tips oss om en kilde
      </a>
      <p className="small muted">
        Sitter du på noe om en <em>enkeltkamp</em> — målscorere, lagoppstilling, tilskuertall
        — er det raskere å bruke «Bidra om kampen» på selve kampsiden.
      </p>
    </section>
  );
}
