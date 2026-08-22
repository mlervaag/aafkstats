# Stabil identitet og lineage for source-results (PR #207)

## 1. Bakgrunn og problemstilling

Tidligere var identiteten til kildedokumenterte enkeltresultater (`source-results`) tett koblet til mutable koordinater:
`sourceId + season + no` (f.eks. `medlemsblad-for-aalesunds-fotb-1965-a2c9#1955-001`).

PR #205 avdekket at legitime kildekorrigeringer (som årsskiftet i Medlemsblad 1965 hvor 1955 #1 ble flyttet til 1954 #10) førte til at en historisk kildepåstand endret identifikator. Når hypoteser, visuelle vurderinger og bevaringsvern baserte seg på disse mutable koordinatene, krevde en ren koordinatendring manuell migrasjon gjennom hele evidenskjeden.

I PR #207 innføres et fundamentalt skille:
- **Stabil claim-identitet (`claimId`)**: Opaque, permanent og globalt unik ID (`srcclaim-...` med 32 hex-tegn / 128 bit) som tildeles én gang og persisteres i YAML. Den er bevisst ikke avledet fra kildens mutable innhold (år, nr, motstander, score), og endres aldri ved kildekorrigeringer.
- **Mutable kildekoordinat**: Posisjon i kilden (`season`, `no`, `page`), som kan endres ved kildekorrigeringer.

---

## 2. Arkitektur og datamodell

### 2.1 Format for `claimId`
Hvert kilderesultat har en eksplisitt felt `claimId` i YAML-filene i `data/source-results/`:
```yaml
sourceId: medlemsblad-for-aalesunds-fotb-1965-a2c9
scorePerspective: aafk
seasons:
  - year: 1954
    page: 14
    results:
      - claimId: srcclaim-23445be3d443b54b5b478052a21aa982
        no: 10
        opponent: Guard
        score: [2, 0]
        note: "ÅFK's jubileumsturnering. trykt «ÅFK—Guard 2—0»."
```

Regex-kontrakt for `claimId`: `/^srcclaim-[a-f0-9]{32}$/`.

I alle downstream-referanser (discovery, candidates, verification cases, community research) benyttes feltnavnet **`sourceClaimId`**.

### 2.2 Source Claim Lineage (`data/migrations/source-claim-lineage.yaml`)
For å spore koordinathistorikk og opprettholde bakoverkompatibilitet med eldre hypoteser og review-logger, lagres lineage under `data/migrations/source-claim-lineage.yaml` med Zod-kontrakten `source-claim-lineage@1`:
```yaml
contract: source-claim-lineage@1
claims:
  - claimId: srcclaim-23445be3d443b54b5b478052a21aa982
    sourceId: medlemsblad-for-aalesunds-fotb-1965-a2c9
    currentCoordinate:
      season: 1954
      no: 10
      hypothesisId: medlemsblad-for-aalesunds-fotb-1965-a2c9#1954-010
    coordinateHistory:
      - season: 1955
        no: 1
        validUntil: 2026-08-22
        supersededBy:
          reason: source_year_shift
          pr: 205
    legacyHypothesisIds:
      - medlemsblad-for-aalesunds-fotb-1965-a2c9#1955-001
```

### 2.3 Formelle garantier (Invarianter)
1. **Unisiat**: Hver `claimId` er unik på tvers av alle kilder og sesonger i hele arkivet (1777 unike IDs).
2. **Bijeksjon**: Én claimId har nøyaktig én nåværende koordinat, og hver koordinathistorikk er entydig knyttet til sin claimId.
3. **Sykkelfrihet og tvetydighetsdeteksjon**: En claim kan ikke ha samme koordinat både som sin egen nåværende og historiske koordinat. En historisk koordinat kan senere gjenbrukes av en annen claim; dette fanges opp og markeres som tvetydighet ved legacy-oppslag (`ambiguous_reused_coordinate`), uten at systemet gjetter.
4. **Bevaringsvern (`archive-preservation.ts`)**: Bevaringsvernet pares på `claimId` (første prioritet i `LIST_ITEM_KEYS`). Koordinatmigrering og renummerering godkjennes så lenge historiske fakta (`opponent`, `score`, osv.) ikke muteres.

---

## 3. Verktøy og CLI

### 3.1 Backfill og Idempotens
```sh
pnpm data:backfill-source-claim-ids [--apply]
```
- Dry-run som standard.
- Tildeler én opaque tilfeldig `claimId` (128-bit / 32 hex-siffer) ved opprettelse. ID-en persisteres deretter uendret i YAML-filene.
- Idempotent: Ny kjøring gir 0 endringer og 0 filskrivinger (testet i temp-katalog).

### 3.2 Integritetskontroll
```sh
pnpm data:source-claim-integrity
```
- Verifiserer at alle 1777 kilderesultater har gyldig 32-hex `claimId`.
- Kontrollerer global unisiat, lineage-konsistens og fravær av sykluser.
- Skanner samtlige downstream-referanser (`sourceClaimId`) i `data/discovery/`, `data/verification-cases/` og `data/harvests/`.

### 3.3 Enkeltinspeksjon
```sh
pnpm data:source-claim -- <claimId | legacyHypothesisId | sourceId#season-no>
```
Eksempel:
```sh
pnpm data:source-claim -- medlemsblad-for-aalesunds-fotb-1965-a2c9#1955-001
```
Viser advarsel ved gjenbrukte tvetydige koordinater, og oppslag via entydig `claimId`:
```sh
pnpm data:source-claim -- srcclaim-23445be3d443b54b5b478052a21aa982
```

---

## 4. SQLite og Spørrelag

- **Tabell**: `core_source_results` har kolonnen `claim_id TEXT NOT NULL UNIQUE` med indeks `source_results_claim_id_idx`.
- **View**: `source_results` eksponerer `claim_id` som første kolonne.
- **Dokumentasjon**: `packages/query/src/dataset.ts` dokumenterer `claim_id` i `source_results`-viewet.
