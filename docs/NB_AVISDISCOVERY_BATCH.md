# Første NB-batch

Denne instruksen er fasiten for v1. Ikke endre ranking, enrichment-budsjett eller
evidence-vekter under batchkjøringen.

## 1. Mål populasjonen

```sh
pnpm ingest:nb-newspaper-discover -- \
  --source-result data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml \
  --from-year 1945 --to-year 1964 --unlinked-only --dry-run
```

Lagre tallene under `population`. Denne kommandoen gjør ingen NB-kall.

## 2. Kjør første faktiske batch

```sh
pnpm ingest:nb-newspaper-discover -- \
  --source-result data/source-results/medlemsblad-for-aalesunds-fotb-1965-a2c9.yaml \
  --from-year 1945 --to-year 1964 --unlinked-only --limit 50 \
  --output tmp/nb-discovery-1945-1964-batch-01.yaml
```

Ikke bruk `--resolve-siblings`. Singletons behandles automatisk. Sibling-grupper
skrives til rapporten som `ambiguous` / `sibling_group` uten NB-kall.

## 3. Kontroller rapporten

Kontroller at rapporten ikke inneholder OCR-tekst og at alle manuelle saker har
source-result-referanser, motstander, forventet resultat og gruppestørrelse.
Noter minst:

- confirmed, conflict, probable, ambiguous og not_found
- candidateIssuesFound, issuesEnriched og nbRequests
- hypoteser med tidsbevis, resultatsamsvar og resultatkonflikt
- siblingGroupsSkipped

Les manuelt et utvalg av `confirmed` og alle `conflict` via NB-lenkene. Ikke
skriv datoer eller resultater til kanoniske data fra denne rapporten.

## 4. Fortsett med data, ikke heuristikker

Kjør neste batch med et nytt, ikke-overlappende utvalg. Evaluer først etter
25–50 og deretter 100+ automatiske singleton-hypoteser. Ikke implementer
snippetQuality, sterkere snippet-filtre, større OCR-budsjett eller ny
sibling-ranking før målingene viser hvilken flaskehals som faktisk dominerer.

Kontrollsakene ligger maskinlesbart i
`packages/ingest/test/fixtures/nb-newspaper-acceptance.yaml`.

Evaluering og resultater fra første batch (100 saker) er dokumentert i:
- [`docs/NB_AVISDISCOVERY_BATCH_01.md`](NB_AVISDISCOVERY_BATCH_01.md) (opprinnelig historisk kjøring)
- [`docs/NB_AVISDISCOVERY_BATCH_01_V2.md`](NB_AVISDISCOVERY_BATCH_01_V2.md) (hendelseskoherent re-evaluering)

