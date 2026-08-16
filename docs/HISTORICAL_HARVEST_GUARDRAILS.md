# Historiske Innhøstings-Guardrails

Dette dokumentet beskriver de automatiserte bevarings- og analyseverktøyene i AaFK-arkivet, innført i **PR #158** og utvidet i **PR #159** og den påfølgende innstrammingen.

Formålet med disse verktøyene er å gjøre de viktigste invariantene fra [`docs/HISTORISK_KILDEINNHOSTING_RUNBOOK.md`](HISTORISK_KILDEINNHOSTING_RUNBOOK.md) **maskinelt kontrollerbare og håndhevet i CI**.

Prinsippet er:
> **Automatiser kontrollen rundt historieskrivingen. Ikke automatiser historieskrivingen.**

---

## 1. Hovedkommandoer

| Kommando | Formål | Kjøres i CI? | Exit-kode ved feil |
|---|---|---|---|
| `pnpm data:historical-preservation` | Semantisk regresjonsvern for `data/people/` **og** strukturelt additivitetsvern for `data/sources/`, `data/source-results/`, `data/seasons/**/matches/`, `data/observations/` og `data/organization/snapshots/` | **Ja** (hard gate på alle PR-er) | `1` (hvis uautoriserte destruktive endringer eller selvgodkjente unntak) |
| `pnpm data:historical-harvest:check` | Cross-layer batch-audit mot `data/harvests/<id>.yaml`: inventar, sidedekning mot ekstraksjonene, funn ↔ arkiv i begge retninger, proveniens og bevaring | **Ja** (hard gate; PR-er som endrer kildedata må ha manifest) | `1` (hvis noen kontroll feiler) |
| `pnpm data:historical-audit` | Scope-basert audit uten manifest: Source Inventory, preflight, extraction coverage og review-validering av et markdown-dokument | Manuelt | `1` (hvis preflight feiler, scope er tomt eller review har mangler) |

### Hva som ikke kan omgås

Fire hull ble lukket etter gjennomgangen av PR #157–#159. De er verdt å kjenne, fordi de alle var måter å få grønt lys uten å ha gjort arbeidet:

1. **Bevaringsvernet dekket bare personer.** Sletting i kildekatalogen, kilderesultatene, kampene, observasjonene og snapshotene passerte grønt. Nå håndheves strukturell additivitet — BASE må være en delmengde av HEAD — for alle fem katalogene.
2. **Unntak kunne selvgodkjennes.** Samme commit kunne både slette historikk og legge inn dispensasjonen som godkjente slettingen. Et unntak gjelder nå bare dersom det fantes i BASE, og filen er dekket av `CODEOWNERS`.
3. **Sidedekning var en ren påstand.** `coverage.expected` utledes nå fra `extraction.pagesExpected` ved hver sjekk, og `reviewMethod.facsimile: unavailable` avvises når kilden har ALTO-skann og dermed tilgjengelig faksimile.
4. **Kontrollen gikk bare én vei.** Auditen sjekket at hvert funn pekte på noe ekte, men ikke at alt ekte kom fra et funn. Nå kreves det at alt som legges til i arkivet og siterer batchens kilder, gjøres rede for av et funn.

---

## 2. Kommando 1: `pnpm data:historical-preservation`

### Hva den sjekker
Kommandoen foretar en **strukturell og semantisk sammenligning** mellom `BASE` (f.eks. target-commit i PR) og `HEAD` (eller lokalt arbeidstre) for alle filer i `data/people/*.yaml`.

Den kontrollerer at følgende elementer **ikke kan forsvinne uten et godkjent unntak**:
1. **Personnavn (`name`):**
   - Eksisterende navn kan ikke endres eller forsvinne i stillhet (`DESTRUCTIVE_CHANGE`).
2. **Roller (`roles`):**
   - Identitet: `role.id`.
   - Gammel `role.id` må fortsatt eksistere.
   - Gammel `category`, `title`, `organizationId`, `body` og `note` kan ikke fjernes eller muteres uten unntak.
   - `sources` på rollen må bevares: `fields` kan ikke krympe, og `note` kan ikke fjernes.
   - Legitim presisering (f.eks. `to: null` → `to: "1960"`) klassifiseres som `SAFE_ENRICHMENT`.
3. **Kildereferanser (`sources`):**
   - Identitet: `sourceId` + `page`.
   - Eksisterende kildepåstander kan ikke fjernes.
   - `fields` på kildereferansen kan ikke krympe (`BASE.fields ⊆ HEAD.fields`).
   - `note` på kildereferansen kan ikke fjernes.
4. **Leverandørkilder (`providers`):**
   - Identitet: `providerId`.
   - Eksisterende `ProviderRef` kan ikke fjernes.
   - `fields` kan ikke krympe, og `url`, `retrievedAt` og `note` kan ikke fjernes.
5. **Konflikter (`conflicts`):**
   - Identitet: `field`.
   - Eksisterende konflikt kan ikke fjernes.
   - Ingen kildeverdier i konflikten kan slettes (`BASE.values ⊆ HEAD.values`), og `payloadHash` / `note` på verdier kan ikke forsvinne.
   - Overgang fra `unresolved` til `resolved` med korrekte beslutningsfelter (`chosen`, `chosenProviderId`, `decidedAt`, `reason`) er `SAFE_ENRICHMENT`.
   - Reversering fra `resolved` til `unresolved` eller fjerning av beslutningsbegrunnelse er `DESTRUCTIVE_CHANGE`.
6. **Navnevarianter (`names`):**
   - Eksisterende navneformer må bestå (`BASE.names ⊆ HEAD.names`).
7. **Trenerperioder (`coachSpells`):**
   - Identitet: `fromSeason`.
   - Alle felter (`fromSeason`, `toSeason`, `fromDate`, `toDate`, `note`) er beskyttet.
   - Presisering fra null/undefined til dokumentert verdi er `SAFE_ENRICHMENT`. Tap av oppgitt verdi er `DESTRUCTIVE_CHANGE`.
8. **Draktnummer (`squadNumbers`):**
   - Eksisterende draktnummer per sesong må bevares.
9. **Skalare metadata:**
   - `wikidata`, `position`, `nationality` og `note` kan ikke fjernes i stillhet.
10. **Personfiler:**
    - En hel personfil kan aldri slettes uten et godkjent unntak.

### CLI-flagg
```sh
# Sammenlign lokalt arbeidstre mot standard base (merge-base mot origin/main)
pnpm data:historical-preservation

# Eksplisitt base og head SHA (brukes i CI)
pnpm data:historical-preservation --base "$BASE_SHA" --head "$GITHUB_SHA"

# Maskinlesbar JSON-output
pnpm data:historical-preservation --json
```

### Resultatklassifisering
- `ADDITION`: Ny person, ny rolle eller nytt element lagt til.
- `SAFE_ENRICHMENT`: Ikke-destruktiv berikelse (f.eks. dokumentert sluttår eller løst konflikt).
- `REVIEW_REQUIRED`: Endring som bør vurderes redaksjonelt (advarsel).
- `DESTRUCTIVE_CHANGE`: Uautorisert fjerning eller destruktiv mutasjon av historikk (**Blokkerer PR/CI med exit 1**).
- `APPROVED_EXCEPTION`: Destruktiv endring som matcher et dokumentert unntak i `data/preservation-exceptions.yaml`.

---

## 3. Unntakshåndtering (`data/preservation-exceptions.yaml`)

Når en historisk korreksjon krever at en feilaktig opplysning eller duplikatrolle fjernes, må dette dokumenteres eksplisitt i `data/preservation-exceptions.yaml`.

### Eksempel
```yaml
exceptions:
  - entity: person
    id: karsten-nedregard
    path: roles/formann-1950
    change: remove
    reason: "Duplikatrolle slått sammen etter eksplisitt kildeavstemming mot primærkilde."
    sources:
      - sourceId: medlemsblad-1950
        page: "12"
        fields:
          - roles
    approvedIn: 158
```

### Regler for unntak
- **Målrettet:** Må angi nøyaktig `entity`, `id`, `path` og `change`.
- **Ingen wildcards:** Brede mønstre som `*`, `roles/*` eller `people/*` **avvises av schemaet**.
- **Obligatorisk begrunnelse:** `reason` må inneholde en reell forklaring (minst 10 tegn).
- **Stale exception reporting:** Unntak som ikke matcher noen faktisk endring i diffen, rapporteres som advarsler i konsolloggen slik at gamle dispensasjoner ikke blir stående.

---

## 4. Kommando 2: `pnpm data:historical-audit`

Utfører en samlet historisk batch-audit med fire hovedområder:
1. **Source Inventory & Orphan Detection:**
   - Identifiserer alle kilder i det definerte årsscopet (`--parent-source`, `--year-from`, `--year-to` eller `--source`).
   - Skiller mellom `discovered`, `inScope` og faktisk dokumentert `reviewStatus` (`reviewed`, `duplicate_or_reprint`, `unavailable`, `out_of_scope`, `unknown`).
   - Kilder med ukjent review-status flagges som `unknownReviewStatus`.
   - **Strict audit som standard:** `historical-audit` krever komplett review (`requireCompleteReview = true`) og feiler dersom kilder har `unknownReviewStatus`. Bruk `--preflight-only` for tidlig innsjekk før review-dokumentet er ferdigstilt.
   - **Orphan-deteksjon:** Oppdager automatisk ekstraksjoner eller source-results som refererer til `sourceId`-er som ikke eksisterer i `data/sources/`, og feiler auditen med feilmelding.
2. **Source preflight & extraction coverage:**
   - Skiller `extractionMode` (`alto`, `search_only`, `ocr_unavailable`, `manual`) fra `reviewStatus` (OCR-tilgjengelighet forveksles ikke med fysisk kildetilgjengelighet).
   - Rapporterer `ALTO complete`, `ALTO incomplete` og `Manual/no-ALTO` separat.
   - Validerer at extractionens egen `providerId` finnes i leverandørkatalogen.
   - For ALTO kreves `pagesProcessed === pagesExpected && pagesFailed.length === 0` for å være `altoComplete`. Ufullstendig ALTO gir feil under batch-audit.
3. **Semantisk harvest-diff:**
   - Sammenligner `BASE` og `HEAD` med robust semantisk claim-identitet (tåler innsetting/renummerering av resultater) og beregner faktiske batchmetrikker (nye personer, berikede personer, kilderesultater, kanoniske kamper, snapshots, observasjoner, konflikter).
4. **Review-dokumentvalidering (`markdown-v1`):**
   - Henter kildestatuser direkte fra **Source Inventory-tabellen** og matcher eksakte `sourceId`-er (f.eks. `medlemsblad-for-aalesunds-fotb-1954-cd1c`). En ren tekstomtale markerer ikke en kilde som `reviewed`.
   - Validerer tabellverdier mot autoritativt runbook-vokabular (`honor_created`, `milestone_created`, `mention_linked`, `observation_created`, `non_senior` m.fl.).
   - Sjekker at review-dokumenter ikke inneholder uferdige mal-placeholders (`<Antall>`, `<År>`, `<sourceId>`, `<YYYY-MM-DD>`, `TODO`, `XXX`, `[TBD]`).
   - Sjekker at visuell sidekontroll (`Sider visuelt kontrollert: X/X`) er 100 % fullført (forveksles ikke med kildeantall) og at Definition of Done-sjekkpunkter er avkrysset.

### CLI-eksempler
```sh
# Endelig batch-audit (krever review-fil og fullført review)
pnpm data:historical-audit \
  --parent-source aafk-medlemsblad \
  --year-from 1953 \
  --year-to 1956 \
  --review-file docs/data/MEDLEMSBLAD_1953_1956_REVIEW.md

# Tidlig preflight-audit underveis i innhøstingen (tillater unknown review status)
pnpm data:historical-audit \
  --parent-source aafk-medlemsblad \
  --year-from 1953 \
  --year-to 1956 \
  --preflight-only

# Maskinlesbar JSON-rapport
pnpm data:historical-audit --parent-source aafk-medlemsblad --year-from 1953 --year-to 1956 --preflight-only --json
```

---

## 5. Hva verktøyene IKKE gjør

Verktøyene er **utelukkende read-only** kontrollmekanismer. De skal **aldri**:
- Automatisk endre eller overskrive YAML-filer.
- Automatisk fatte historiske eller kildekritiske beslutninger.
- Automatisk koble usikre kamper eller personer.
- Fjerne eller ignorere historiske uenigheter.

Kildekritikken og historieskrivingen forblir et redaksjonelt og menneskelig ansvar etter runbooken i [`docs/HISTORISK_KILDEINNHOSTING_RUNBOOK.md`](HISTORISK_KILDEINNHOSTING_RUNBOOK.md).

---

## 7. Preservation Exceptions

`data/preservation-exceptions.yaml` er den eneste veien rundt kravet om streng historisk additivitet.

### To-trinns godkjenning

Et unntak virker **først når det finnes i BASE-commit**. Det betyr at en endring som trenger et unntak må deles i to:

1. En egen PR som legger inn unntaket i `data/preservation-exceptions.yaml`, med begrunnelse og kildehenvisning. Filen er dekket av `CODEOWNERS`, så et menneske må se den.
2. PR-en som utfører selve endringen.

Legges unntaket og endringen inn samtidig, rapporteres unntaket som **selvgodkjent**, det gjelder ikke, og kjøringen feller.

```yaml
exceptions:
  - entity: source_result          # person | source | source_result | match | observation | organization_snapshot
    id: aalesunds-fotballklub-gjennem-1939-ec28
    path: seasons/1915/results/2   # konkret sti; brede wildcards er forbudt
    change: remove                 # remove | mutate | delete_file
    reason: Oppføringen var en dublett av nr. 1, bekreftet mot faksimile side 83.
    sources:
      - sourceId: aalesunds-fotballklub-gjennem-1939-ec28
        page: "83"
    approvedIn: 200                # PR-nummer
```

### Hva som regnes som samme unntak

Identiteten er `entity + id + path + change`. Begrunnelse og kildehenvisninger kan omformuleres uten at dispensasjonen regnes som ny — men endrer du sti eller endringstype, er det et nytt unntak som må godkjennes på nytt.

### Ubrukte unntak

Et unntak som ikke matcher noen faktisk endring rapporteres som `stale`. Det feller ikke bygget, men bør ryddes bort: et unntak som ligger igjen er en åpen dør ingen lenger holder øye med.

---

## 8. Lærdommer og permanente regler fra produksjonskjøringer (Golden Example: Medlemsblad 1950)

Første fullskala innhøsting av *AaFK Medlemsblad 1950* etablerte følgende normative guardrails og kontroller:

### 8.1 Sidedekning og katalogduplikater
- Katalogduplikater skal ikke doble kravet til visuell sidegjennomgang når duplikatforholdet er eksplisitt dokumentert og validert.
- `duplicate_or_reprint` ekskluderes kun fra `coverage.expected` dersom:
  1. `duplicateOf` finnes.
  2. `duplicateOf` finnes i batchens `sourceInventory`.
  3. Originalen har `reviewStatus: reviewed`.
  4. Det er oppgitt en eksplisitt `reason`.
- **Regel:** `Source Inventory count != unik visuell sidedekning`.

### 8.2 Semantisk disposisjonsvalidering (Created vs Enriched)
- `person_created`: Feiler ved `status: complete` dersom personen allerede fantes i BASE (bruk `person_enriched`).
- `person_enriched`: Feiler dersom personen ikke fantes i BASE (bruk `person_created`).
- `role_created`: Feiler dersom rollen allerede fantes i BASE på personen (bruk `role_enriched`).
- `role_enriched`: Feiler dersom rollen ikke fantes i BASE på personen (bruk `role_created`).
- `canonical_created`: Feiler dersom kampen fantes i BASE (bruk `canonical_enriched`).
- `canonical_enriched`: Feiler dersom kampen ikke fantes i BASE (bruk `canonical_created`).

### 8.3 Omvendt attribuering for kildekonflikter
- Nye `person.conflicts[]` som refererer til batchens kilder krever et tilhørende finding med `disposition: conflict_registered`.
- Konflikter er førsteklasses innhøstingsdata og skal aldri skjules i notater eller feilaktig overskrives.

### 8.4 Retrospektive kildepåstander og faktumår
- Kilderesultater fra historiske artikler (f.eks. en 1950-artikkel om 1927) skal lagres under sesongen for **faktumåret** (`seasons: [{ year: 1927 }]`), aldri publikasjonsåret.
- Hver kilde beholder sitt eget kilderesultat uavhengig av om kampen allerede er kanonisk eller omtalt i andre kilder (*multi-source provenance*).

### 8.5 Organisasjonsvalg og arbeidsår
- Valgdato $\neq$ automatisk snapshot-år. Årsmøtevalg sent på året for kommende sesong (f.eks. 29. november 1950 for arbeidsåret 1951) skal lagres på arbeidsårets snapshot (`1951-aafk.yaml`) og personroller for 1951.
- Oppgitte komiteer og lister i et snapshot skal være fullstendige iht. kilden innenfor det definerte claimet.

### 8.6 Ingen personperiode-interpolering
- Diskrete dokumenterte år (f.eks. styremedlem 1925, 1927, 1930, 1931) skal aldri interpoleres til en sammenhengende periode (`1925–1931`) uten eksplisitt kildebelegg for kontinuitet.

### 8.7 Turneringsprogresjon og ScorePerspective
- I utslagsturneringer (NM cup) kan ikke et lag ha et utslagsgivende tap i runde $N$ dersom kilden dokumenterer deltagelse i runde $N+1$.
- `scorePerspective: aafk` skal alltid dobbeltsjekkes mot trykt rekkefølge (hjemme/borte vs AaFK-perspektiv).

### 8.8 Firelags-avstemming (Four-Layer Reconciliation)
Før en batch settes til `status: complete`, skal fire lag fortelle nøyaktig samme historie:
$$\text{Faksimile} \longrightarrow \text{Review-logg} \longrightarrow \text{Manifest Findings} \longrightarrow \text{Target Data}$$

