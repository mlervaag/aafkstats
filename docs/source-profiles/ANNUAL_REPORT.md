# Source Profile: Årsberetning / Årsrapport (`annual_report`)

Denne profilen gjelder årsrapporter og beretninger fra klubben, Sunnmøre Fotballkrets (SFK) eller særkretser.

> [!NOTE]
> Profiler er supplerende kildekunnskap om særtrekk. Den autoritative felles runbooken i [`docs/HISTORISK_KILDEINNHOSTING_RUNBOOK.md`](../HISTORISK_KILDEINNHOSTING_RUNBOOK.md) og manifestskjemaet er overordnet.

---

## 1. Kildetype og struktur
- **Sesongoppsummering:** Offisiell årsrapport utgitt ved årets slutt eller til årsmøtet.
- **Innhold:**
  - Fullstendige serietabeller og kretstabeller for alle nivåer.
  - Kretsadministrasjon, styremedlemmer, utvalgsledere og autoriserte kretsdommere.
  - Årsmøteprotokoller og kretsvedtak.
  - Hedersbevisninger, bragdstatuetter og ærespriser.
  - Oversikt over aldersbestemte turneringer, gutte-, junior- og B-lag.

---

## 2. Kildespesifikke særtrekk og fallgruver

### Skille mellom A-lag og aldersbestemt (Senior vs. Non-senior)
- Årsrapporter inneholder ofte kamper og tabeller for juniorlag, reservelag og småguttelag.
- **Regel:** Kun A-lagsdata normaliseres til kanoniske kamper og `source-results`. Junior-/B-lagsresultater disponeres som `disposition: non_senior` med `targets: []`.

### Kretsadministrasjon og personroller
- AaFK-medlemmer med verv i kretsstyret, anleggsutvalg eller dommerkomiteen føres som `roles` knyttet til organisasjonen (f.eks. SFK) med referanse til årsrapporten.

---

## 3. Påkrevde innhøstingspass
1. `facsimile_review`: Fullstendig visuell faksimilegjennomgang.
2. `explicit_results`: A-lagskamper og serietabeller.
3. `senior_level_separation`: Skille A-lag fra aldersbestemt (`non_senior`).
4. `people_and_roles`: Styrepersoner, kretsrepresentanter og dommere.
5. `organization`: Organisasjonsstruktur og snapshots.
6. `retrospectives_and_claims`: Kretsstatistikk og historiske oppsummeringer.
7. `observations`: Kretsvedtak, baneforhold og jubileer.
