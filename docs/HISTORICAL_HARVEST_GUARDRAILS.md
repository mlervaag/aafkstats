# Historiske Innhøstings-Guardrails

Dette dokumentet beskriver de automatiserte bevarings- og analyseverktøyene i AaFK-arkivet innført i **PR #158**.

Formålet med disse verktøyene er å gjøre de viktigste invariantene fra [`docs/HISTORISK_KILDEINNHOSTING_RUNBOOK.md`](HISTORISK_KILDEINNHOSTING_RUNBOOK.md) **maskinelt kontrollerbare og håndhevet i CI**.

Prinsippet er:
> **Automatiser kontrollen rundt historieskrivingen. Ikke automatiser historieskrivingen.**

---

## 1. Hovedkommandoer

| Kommando | Formål | Kjøres i CI? | Exit-kode ved feil |
|---|---|---|---|
| `pnpm data:historical-preservation` | Semantisk regresjonsvern mot utilsiktet tap av personhistorikk, roller, kilder, konflikter og metadata | **Ja** (Hard gate på alle PR-er) | `1` (hvis uautoriserte destruktive endringer) |
| `pnpm data:historical-audit` | Samlet historisk batch-audit: Source Inventory, preflight, extraction coverage, semantisk harvest-diff og review-validering | Manuelt og i batch-PR-er | `1` (hvis preflight feiler eller uautoriserte slettinger) |

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
