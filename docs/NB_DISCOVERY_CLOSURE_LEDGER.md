# Autoritativ discovery closure-ledger

## Formål

Denne planen lukker discovery-materialet som allerede finnes. Den gjør ingen nye NB-søk,
ingen visuell review og ingen kanoniske writes. Resultatet er én maskinlesbar status og én
autoritativ arbeidskø for senere closure-PR-er.

## Plan

1. Inventarer PR194–PR209-artifaktene, source-results, lineage, community-saker og
   canonicalization-manifester.
2. Rekonstruer hver hypotese fra dagens source-result. Bruk `sourceClaimId` som ledgernøkkel;
   bruk gammel `hypothesisId` bare til kompatibilitetsoppslag.
3. Evaluer true visual review mot `sourceCoordinateAtReview` og dagens claim med den felles
   review-validitetsfunksjonen. En sesongendring krever revalidering; en ren renummerering
   innen samme sesong beholder semantisk gyldighet.
4. Skill legacy AI-review fra true visual review. Legacy-resultater kan prioritere arbeid,
   men kan ikke alene bli visuell ground truth.
5. Utled terminal status eller nøyaktig én aktiv kø for hver hypotese. Avstem PR198-baselinen
   matematisk og rapporter periodene 1915–1984.
6. Kjør ledgeren fra scratch og valider at den er deterministisk, uten orphan-referanser,
   tvetydige identiteter eller dupliserte review-oppdrag.

## Autoritet og presedens

Status utledes i denne rekkefølgen:

1. dagens source-result og stabile claim-lineage
2. anvendt canonicalization og eksisterende `matchId`
3. gyldig true visual review med faktisk faksimilekilde
4. publisert community/research-sak
5. kandidatdekning og frossen selection
6. legacy AI-review som ikke-autoritativ historikk

Ved tvetydig gjenbruk av en koordinat er det forbudt å velge en claim uten at den gamle
source-result-payloaden gir én entydig match. Ellers registreres saken som intern tvetydighet.

## Artifact og beslutningsport

Kjør:

```sh
pnpm data:discovery-status
```

Kommandoen skriver `data/discovery/discovery-closure-status.yaml`. Artifactet inneholder
PR198-baseline, dagens totaler, perioderegnskap, integritetsfunn, hver claim/hypotese og de
autoritative køene `needsVisualReview`, `requiresRevalidation`,
`readyForCanonicalization`, `communityResearch`, `exhausted` og `terminal`.

Beslutningsporten er:

`DISCOVERY_CLOSURE_QUEUE_ESTABLISHED`
