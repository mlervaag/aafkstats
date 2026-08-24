# Datoankret avisberikelse

Denne løypa starter med en kanonisk kamp som har eksakt dato, motstander og resultat. Den er separat fra source-result-discovery, som fortsatt brukes når oppgaven er å finne hvilken kamp en udatert kildepåstand gjelder.

Den skalerte, kostnadsstyrte løypa for udaterte source-result-claims er dokumentert i [`NB_DATELESS_DISCOVERY_SCALE_PLAN.md`](NB_DATELESS_DISCOVERY_SCALE_PLAN.md).

## Produksjonsflyt

1. Regenerer køen med `pnpm data:newspaper-enrichment-status`.
2. Velg sesong eller kamp deterministisk fra `data/discovery/newspaper-enrichment-status.yaml`.
3. Kjør discovery, for eksempel `pnpm ingest:nb-newspaper-batch -- --from 1979 --to 1979`.
4. Kjør `pnpm data:nb-newspaper-review -- --report <rapport>`. NB OCR-API er godkjent reviewgrunnlag for denne datoankrede canonical-løypa.
5. Bruk `--write` for å knytte korrelerte avisutgaver og entydig ankrede kampboksfakta additivt til canonical data.
6. Kjør statusgeneratoren på nytt. Etter en sesongbatch regenereres også `pnpm data:discovery-status`, slik at PR #212-restkøen kan avstemmes mot nye kamper og avisbevis.

Standardvinduet er D-2 til D+2. Dersom første pass ikke har en sterk kandidat, utvides det til D-3 til D+3. Begge radiusene kan overstyres med `--window-days` og `--expanded-window-days`. Resultatet påvirker rangeringen, men filtrerer aldri bort en kandidat. Mandagsutgaven får høyest datoprioritet etter en søndagskamp.

Discoveryrapporten ligger under `.cache/ingest/nb-newspaper-batch/`. Den bevarer flere kandidatutgaver og flere evidensbiter fra samme utgave, men ingen OCR-tekst. Kandidatene klassifiseres som kampreferat, resultatnotis, forhåndsomtale, laguttak, resultatbørs, tabell, terminliste, annonse eller ukjent.

## Reviewregler

### Produksjonspolicy

En Sunnmørsposten-utgave kan kobles til en canonical kamp uten obligatorisk faksimilekontroll når kampen har eksakt dato, kjent sluttresultat og begge klubber, OCR binder klubbene lokalt i samme kampkontekst innen søkevinduet, sjanger og tidsplassering passer, og ingen samtidig kamp gjør koblingen tvetydig. Resultatet er et rangeringssignal; et avvik blir `conflict_candidate` og overskriver aldri canonical data.

Policyen registreres ærlig som `reviewMethod: ocr_api` og `facsimileReviewed: false`. Den bygger på et manuelt kontrollert utvalg av 1979-faksimilene som ga 100 prosent korrekt kampkobling. Det betyr ikke at alle 39 faksimiler ble kontrollert.

- `ocr_correlated` betyr at begge klubber står lokalt bundet i relevant avisstoff innen søkevinduet. `reviewMethod: ocr_api`, `facsimileReviewed: false` og null visuelt kontrollerte sider skal alltid følge funnet.
- `no_ocr_candidate` betyr at API-et ikke ga en lokalt bundet kandidat. Det er ikke det samme som et visuelt fastslått `not_found`.
- `candidate_found` og `candidate_review` er rå discoveryutfall og skal ikke skrives direkte til canonical data.
- `not_found` er et gyldig terminalt reviewutfall etter at det konfigurerte vinduet er undersøkt.
- En tabell, terminliste eller annonse bekrefter ikke at kampen ble spilt.
- Et avvikende resultat registreres som `conflict_candidate`. Canonical data overskrives ikke automatisk.
- Artikkelen gjennomgås komplett for dato, hjemme/borte, konkurranse, arena, avspark, publikum, dommer, pause, lag, mål, kort, bytter og kildeførte historiske observasjoner.
- Personer opprettes ikke fra tvetydig OCR.
- Skalarfakta kan skrives additivt når de kommer fra den samme lokalt forankrede kampboksen, har én plausibel tolkning og canonical felt mangler. Personnavn krever i tillegg en eksplisitt rollemarkør, som `Dommer: Navn`.
- Avis-OCR lagres ikke i repoet. Reviewledgeren kan lagre NB-id, URN, permanent lenke, utgivelsesdato, side, sikker tittel, strukturerte fakta og en kort note.

OCR-feltets sidenummer er det trykte sidenummeret. NB-viseren bruker nullbasert
`page`-parameter, slik at trykt side 1 lenkes med `?page=0`. Den visuelle
kalibreringen er dokumentert i `docs/NB_NEWSPAPER_FACSIMILE_PILOT.md`.

`canonicalLinked` betyr bare at avisutgaven er knyttet til kampen. Statusen skiller dette fra `hasSmpMention`, `hasMatchReport`, `hasPostMatchEvidence`, faktaskriv, konflikt og `enrichmentStatus`. Konflikter, preview-only, fixture-only, svake kandidater og manglende OCR-kandidat blir i residualkøen. Et sterkt, etterkampbasert kampreferat eller resultatnotis kan gjøre berikelsen komplett.

Denne policyen gjelder bare `canonical kamp -> datoankret samtidig avis -> OCR-berikelse`, fordi kampidentiteten allerede er etablert uavhengig. Den gjelder ikke udaterte source-results, ukjent kampidentitet, medlemsblad-OCR, retrospektive lister, personhistorikk uten kjent hendelse eller PR #212-hypoteser. De generelle kildekritiske guardrails gjelder uendret der.

1979-resultatene er dokumentert i `docs/NB_CANONICAL_NEWSPAPER_1979_PILOT.md` og fungerer som regresjonsgrunnlag for videre sesongbatcher.
