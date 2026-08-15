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
1. **Roller (`roles`):**
   - Identitet: `role.id`.
   - Gammel `role.id` må fortsatt eksistere.
   - Gammel `category` og `title` kan ikke muteres uten dokumentert unntak.
   - `sources` på rollen må bevares, og `fields` kan ikke krympe.
   - Legitim presisering (f.eks. `to: null` → `to: "1960"`) klassifiseres som `SAFE_ENRICHMENT`.
2. **Kildereferanser (`sources`):**
   - Identitet: `sourceId` + `page`.
   - Eksisterende kildepåstander kan ikke fjernes.
   - `fields` på kildereferansen kan ikke krympe (`BASE.fields ⊆ HEAD.fields`).
3. **Konflikter (`conflicts`):**
   - Identitet: `field`.
   - Eksisterende konflikt kan ikke fjernes.
   - Ingen kildeverdier i konflikten kan slettes (`BASE.values ⊆ HEAD.values`).
   - Overgang fra `unresolved` til `resolved` med korrekte beslutningsfelter (`chosen`, `chosenProviderId`, `decidedAt`, `reason`) er `SAFE_ENRICHMENT`.
4. **Navnevarianter (`names`):**
   - Eksisterende navneformer må bestå (`BASE.names ⊆ HEAD.names`).
5. **Trenerperioder (`coachSpells`):**
   - Eksisterende perioder kan ikke fjernes; presisering av datoer/sluttår er `SAFE_ENRICHMENT`.
6. **Draktnummer (`squadNumbers`):**
   - Eksisterende draktnummer per sesong må bevares.
7. **Skalare metadata:**
   - `wikidata`, `position`, `nationality` og `note` kan ikke fjernes i stillhet.
8. **Personfiler:**
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
1. **Source Inventory:** Identifiserer alle kilder i det definerte årsscopet (`--parent-source`, `--year-from`, `--year-to` eller `--source`).
2. **Source preflight & extraction coverage:** Skiller mellom `ALTO` (maskinell lesing), `manual` (ingen ALTO) og `unavailable`. Sjekker for feilede sider.
3. **Semantisk harvest-diff:** Sammenligner `BASE` og `HEAD` og beregner faktiske batchmetrikker (nye personer, berikede personer, kilderesultater, kanoniske kamper, snapshots, observasjoner, konflikter).
4. **Review-dokumentvalidering (`markdown-v1`):** Sjekker at review-dokumenter ikke inneholder gjenglemte mal-placeholders (`<PLACEHOLDER>`, `TODO`, `XXX`), at visuell sidekontroll er 100 % fullført, at Definition of Done er avkrysset, og at brukte disposisjoner tilhører godkjent vokabular.

### CLI-eksempler
```sh
# Kjøring på en konkret årgang / kilde
pnpm data:historical-audit \
  --parent-source aafk-medlemsblad \
  --year-from 1953 \
  --year-to 1956

# Med tilhørende review-fil
pnpm data:historical-audit \
  --parent-source aafk-medlemsblad \
  --year-from 1953 \
  --year-to 1956 \
  --review-file docs/data/MEDLEMSBLAD_1953_1956_REVIEW.md

# Maskinlesbar JSON-rapport
pnpm data:historical-audit --parent-source aafk-medlemsblad --year-from 1953 --year-to 1956 --json
```

---

## 5. Hva verktøyene IKKE gjør

Verktøyene er **utelukkende read-only** kontrollmekanismer. De skal **aldri**:
- Automatisk endre eller overskrive YAML-filer.
- Automatisk fatte historiske eller kildekritiske beslutninger.
- Automatisk koble usikre kamper eller personer.
- Fjerne eller ignorere historiske uenigheter.

Kildekritikken og historieskrivingen forblir et redaksjonelt og menneskelig ansvar etter runbooken i [`docs/HISTORISK_KILDEINNHOSTING_RUNBOOK.md`](HISTORISK_KILDEINNHOSTING_RUNBOOK.md).
