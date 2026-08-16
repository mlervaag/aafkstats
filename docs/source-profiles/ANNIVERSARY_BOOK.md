# Source Profile: Jubileumsbok / Historiebok (`anniversary_book`)

Denne profilen gjelder jubileumsbøker, festskrift og historiske samleverk over klubbens historie (f.eks. AaFK 50 år (1964), AaFK 75 år (1989), AaFK 100 år (2014)).

> [!NOTE]
> Profiler er supplerende kildekunnskap om særtrekk. Den autoritative felles runbooken i [`docs/HISTORISK_KILDEINNHOSTING_RUNBOOK.md`](../HISTORISK_KILDEINNHOSTING_RUNBOOK.md) og manifestskjemaet er overordnet.

---

## 1. Kildetype og struktur
- **Retrospektiv kilde:** Boken skrives og utgis i ettertid (f.eks. 1964), men dekker mange tiår (f.eks. 1914–1964).
- **Innhold:**
  - Samlede historiske kampoversikter og jubileumsfortellinger.
  - Styreoversikter og formannsrekker gjennom tiårene.
  - Æresmedlemmer, hederstegn og utmerkelser.
  - Baner og anleggshistorikk (f.eks. bygging og utbedring av Kråmyra).
  - Memoarer, personanekdoter og sitater.

---

## 2. Kildespesifikke særtrekk og fallgruver

### KRITISK: Utgivelsesår ≠ Historisk faktum-år
- **Fallgruve:** Å knytte et funn til bokens utgivelsesår (f.eks. 1964) i stedet for året hendelsen fant sted (f.eks. 1931).
- **Regel:**
  - Resultater plasseres i historisk sesong (`source-results.seasons[1931]`).
  - Roller tidsfestes med historiske `from`/`to`-datoer (f.eks. `from: "1931"`).
  - Observasjoner tidsfestes til hendelsesåret (`date: "1931"`).

### Memoarer og kildekritikk
- Jubileumsbøker bygger delvis på erindringer og muntlige overleveringer som kan ha unøyaktigheter.
- Sjekk alltid mot samtidige kilder (medlemsblader, årbøker, aviser) ved uoverensstemmelser, og registrer `conflicts` der kildene spriker.

---

## 3. Påkrevde innhøstingspass
1. `facsimile_review`: Fullstendig visuell faksimilegjennomgang.
2. `chronology_audit`: Kronologiavstemming (historisk faktum-år vs. utgivelsesår).
3. `explicit_results`: Historiske kamper og jubileumskamper.
4. `people_and_roles`: Formannsrekker, æresmedlemmer og trenere.
5. `organization`: Organisasjonsutvikling, sammenslåinger og vedtekter.
6. `retrospectives_and_claims`: Memoarer og historiske påstander.
7. `observations`: Anlegg, stadionutvikling, jubileumsmarkeringer og bragder.
