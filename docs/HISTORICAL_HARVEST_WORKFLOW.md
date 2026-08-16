# Strukturert Historisk Innhøstingsarbeidsflyt (Structured Historical Harvest Workflow)

Dette dokumentet beskriver den maskinelt støttede innhøstingsarbeidsflyten innført i **PR #159**.

Den bygger på metodikken fra [`docs/HISTORISK_KILDEINNHOSTING_RUNBOOK.md`](HISTORISK_KILDEINNHOSTING_RUNBOOK.md) og invariantene fra [`docs/HISTORICAL_HARVEST_GUARDRAILS.md`](HISTORICAL_HARVEST_GUARDRAILS.md).

---

## 1. Hovedprinsipper

1. **Kildeagnostisk kjerne:** Kjernearbeidsflyten er identisk for alle publikasjoner (medlemsblader, NFF-årbøker, SFK-årsrapporter, jubileumsbøker, kampprogrammer og generiske kilder).
2. **Kildespesifikke profiler:** Særegenheter håndteres gjennom [`docs/source-profiles/`](source-profiles/).
3. **Ingen automatisert kildekritikk:** Maskinen håndhever struktur, invariants, dekning og sporbarhet; mennesket/agenten gjør kildevurderingen mot faksimilen.
4. **Frosset Source Inventory:** Hver batch definerer og fryser nøyaktig hvilke `sourceId`-er som inngår, slik at fremtidige kilder ikke gjør en eldre batch ugyldig i ettertid.
5. **Re-harvest som førsteklasses workflow:** Tidligere innhøstet materiale kan gjennomgås på nytt med `mode: reharvest`, der eksisterende data bevares og berikes.

---

## 2. Arbeidsflyt for en innhøsting

```text
1. INIT
   pnpm data:historical-harvest:init --profile yearbook --parent-source nff-yearbook --year-from 1921 --year-to 1925
   ↓ (Oppretter data/harvests/<batch-id>.yaml og review-skjelett)

2. VISUELL REVIEW MOT FAKSIMILE
   Gjennomfør alle required passes mot faksimilen.
   Registrer maskinlesbare findings i batchmanifestet med disposition og claim.

3. NORMALISERING
   Oppdater repoets datafiler (data/people/, data/source-results/, data/seasons/, etc.) additivt.
   Knytt targets på funnene til de faktiske filene og stiene.

4. CHECK & AUDIT
   pnpm data:historical-harvest:check --batch <batch-id>
   (Kjører schema-sjekk, target existence, proveniens, bevaringsvern og livssyklusregler)

5. REPORT
   pnpm data:historical-harvest:report --batch <batch-id>
   (Genererer ferdig Markdown PR-rapport basert på semantisk diff)

6. COMPLETE & PR
   Sett status: complete i manifestet når check passerer med 0 feil.
```

---

## 3. Harvest Batch Manifest (`data/harvests/<batch-id>.yaml`)

Manifestet er den maskinlesbare sannheten om batcharbeidet.

### Eksempel:
```yaml
version: 1
id: nff-yearbooks-1921-1925
title: NFF-årbøker 1921–1925
profile: yearbook
mode: initial
status: complete

scope:
  years:
    from: 1921
    to: 1925
  sourceIds:
    - nff-arbok-1921
    - nff-arbok-1922
    - nff-arbok-1923
    - nff-arbok-1924
    - nff-arbok-1925

sourceInventory:
  - sourceId: nff-arbok-1921
    reviewStatus: reviewed
  - sourceId: nff-arbok-1922
    reviewStatus: reviewed

coverage:
  mode: pages
  expected: 1284
  reviewed: 1284

passes:
  facsimile_review:
    status: complete
    findings: 87
  explicit_results:
    status: complete
    findings: 22
  people_and_roles:
    status: complete
    findings: 31
  organization:
    status: complete
    findings: 3
  retrospectives_and_claims:
    status: complete
    findings: 4
  observations:
    status: complete
    findings: 4

findings:
  - id: f-1923-042
    source:
      sourceId: nff-arbok-1923
      page: 117
    type: person_role
    subject:
      text: Nils Jangaard
      id: nils-jangaard
    claim:
      text: Representerte AaFK som delegat på forbundstinget 1923.
    confidence: certain
    disposition: role_created
    targets:
      - entity: person
        id: nils-jangaard
        path: roles/nff-delegat-1923
    status: normalized

unresolved: []
```

---

## 4. Disposisjoner og Targets

### Disposisjoner som krever target (`TARGET_REQUIRED_DISPOSITIONS`)
- `person_created`, `person_enriched` (`entity: person`)
- `role_created`, `role_enriched`, `honor_created`, `honor_enriched`, `honorary_role_created` (`entity: person`, `path: roles/<id>`)
- `source_result_created` (`entity: source_result`)
- `canonical_created`, `canonical_enriched` (`entity: match`)
- `observation_created`, `historical_observation_created` (`entity: observation`)
- `organization_snapshot_created` (`entity: organization_snapshot`)
- `conflict_registered`, `conflict_resolved` (`entity: person`/`match`)

### Disposisjoner som tillater 0 targets (`ZERO_TARGET_DISPOSITIONS`)
- `identity_uncertain`
- `non_senior`
- `not_a_team`
- `out_of_scope`
- `no_structured_action`
- `duplicate_publication`
- `reprint`
- `already_documented`
- `verified_correct`
- `fixture_only`

---

## 5. CLI-kommandoer

| Kommando | Beskrivelse |
|---|---|
| `pnpm data:historical-harvest:init` | Initialiserer en ny batch fra kildekatalogen med frosset inventar og required passes |
| `pnpm data:historical-harvest:check --batch <id>` | Utfører cross-layer audit (manifest, inventar, dekning, findings, targets, proveniens, bevaring) |
| `pnpm data:historical-harvest:report --batch <id>` | Genererer ferdig Markdown PR-rapport med 12 standardseksjoner |
