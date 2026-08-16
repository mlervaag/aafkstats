# Source Profile: Generisk historisk publikasjon (`generic_publication`)

Dette er fallback-profilen for fremtidige kildetyper og ukjente eller nyoppdagede publikasjoner (f.eks. særskilte jubileumsskrifter, lokale historiebøker, avisbilag eller turneringsoversikter).

> [!NOTE]
> Profiler er supplerende kildekunnskap om særtrekk. Den autoritative felles runbooken i [`docs/HISTORISK_KILDEINNHOSTING_RUNBOOK.md`](../HISTORISK_KILDEINNHOSTING_RUNBOOK.md) og manifestskjemaet er overordnet.

---

## 1. Formål
- Sikrer at enhver ny kilde kan innhøstes uten at det må opprettes en ny spesialprofil eller skrives kode.
- Gir standard arbeidsflyt med full visuell faksimilegjennomgang og kjernepasser.

---

## 2. Standardregler
- Gjennomfør alle standardpass mot faksimilen.
- Dersom et pass ikke avdekker relevante data (f.eks. ingen nye personer eller observasjoner), registreres passet som `status: complete` med `findings: 0`.
- Registrer funn strukturert med egnede `type`, `claim`, `disposition` og `targets`.

---

## 3. Påkrevde innhøstingspass
1. `facsimile_review`: Fullstendig visuell faksimilegjennomgang.
2. `explicit_results`: Kamper og resultater.
3. `people_and_roles`: Personer, roller og verv.
4. `organization`: Organisasjonsforhold og styrestruktur.
5. `retrospectives_and_claims`: Retrospektive omtaler og memoarer.
6. `observations`: Historiske fakta og observasjoner.
