# NB community research – bølge 1

## Formål

PR 201 gjør de research-verdige restsakene etter den visuelle kontrollen og den strenge canonicaliseringen i PR 199–200 tilgjengelige i den eksisterende `/mangler`-flyten. Dette er en researchkø, ikke en ny canonicaliseringskanal.

Autoritativt utvalg kommer fra `data/discovery/nb-source-result-canonicalization-1945-1984.yaml`. Nødvendig, redaksjonelt kontrollert sakskontekst hentes fra PR 199-manifestet. Den publiserte køen ligger i `data/discovery/nb-community-research-wave-1.yaml`.

## Publisert utvalg

| Community-type | Antall |
|---|---:|
| Finn riktig møte (`sibling_resolution`) | 20 |
| Finn dato (`date_research`) | 1 |
| Resultatkonflikt (`score_conflict`) | 1 |
| Konkurransekonflikt (`competition_conflict`) | 1 |
| Finn riktig kildeoppføring (`source_reconciliation`) | 1 |
| **Totalt publisert** | **24** |
| Draft | 0 |

Køen ekskluderer med vilje 576 saker som ennå ikke er visuelt kontrollert, to ikke-seniorkamper og ti funn som gjelder en annen hendelse. Community får bare saker der maskinell behandling og visuell kildekontroll allerede har redusert søkerommet.

Den eksisterende enkle aviskøen ble samtidig avstemt mot PR 199–200. Av 50 åpne saker beholdes 46: 38 er fremdeles ureviewet i den nye populasjonen, og 8 ligger utenfor den. Fire saker er satt tilbake til draft uten å slette historikken: én allerede `ready`, to eksplisitte ikke-seniorkamper og én enkel JA/NEI-sak som er erstattet av den strukturerte resultatkonflikten i denne bølgen.

## Opplevelsen i `/mangler`

Research-saker bruker samme kø, detaljside, reservasjon, innsending og historikk som eksisterende saker. De har feltspesifikke svar i stedet for å presse alle spørsmål inn i JA/NEI:

- flere møter: velg en kildedokumentert oppføring, ingen av dem eller kan ikke bestemmes
- dato: eksakt dato, periode eller kan ikke bestemmes
- konflikter: velg hvilken påstand kildene støtter, forskjellige hendelser eller kan ikke bestemmes
- kildeavstemming: annen oppføring, manglende oppføring, irrelevant eller kan ikke bestemmes

`Kan ikke bestemmes` betyr at kilden faktisk er undersøkt. `Hopp over` avgir ingen faglig vurdering og forblir en separat handling.

UI-et viser avisnavn, utgivelsesdato, trykt sidenummer og direkte NB-lenke fra `actualVisualSource`. URL-en beholder riktig viewer-side selv når den er forskjellig fra trykt side. Kort sakskontekst er en selvstendig redaksjonell beskrivelse; rå OCR, ALTO og fulltekst lagres eller vises ikke.

Rollon 1955 viser alle seks relevante møter uten forhåndsvalg. Saken fra 1976 viser Skarbøvik 2–1 som kildepåstand og Clausenengen 2–0 som avisobservasjon, og presenteres derfor som kildeavstemming – ikke en vanlig bekreft/avkreft-sak.

## Innsending og redaksjonell kontroll

Den versjonerte submission-kontrakten `verificationSubmissionVersion: 2` legger kategori, svar, valgt source-result, strukturerte funn, `actualVisualSource`, hypothesis-ID og case-revisjon i eksisterende GitHub-issueflyt. Fritekst valideres og behandles som dokumentasjon, aldri som kode eller instruksjoner.

Flyten er:

1. community-bidragsyter undersøker og sender inn
2. svaret opprettes i GitHub-innboksen
3. en redaktør vurderer kilde og konklusjon
4. en eventuell senere data-PR kjører validering og krever menneskelig merge

Ingen stemmemengde eller enkeltinnsending oppretter kamp, endrer source-result eller løser konflikt automatisk.

## Generator og vern

`pnpm ingest:nb-community-research` er dry-run som standard. `--apply` skriver bare researchmanifestet. ID-er bygges av stabil source-ID, sesong, nummer og kategori. Case-revisjonen beregnes av hele det materielle innholdet, slik at endringer i spørsmål, alternativer eller avisside blir sporbare.

Eksisterende manuelle saker beskyttes etter case-ID, hypothesis og kategori eller identisk target. En andre kjøring etter apply ga:

| Generatorresultat | Antall |
|---|---:|
| Created | 0 |
| Updated | 0 |
| Unchanged | 24 |
| Skipped | 0 |
| Duplicates | 0 |

| Guardrail | Resultat |
|---|---:|
| Canonical matches endret | 0 |
| Source-results endret | 0 |
| Raw OCR lagret | 0 |
| Auto-resolved community answers | 0 |
| Generator second-run duplicates | 0 |

## Beslutningsport

De 24 sakene kan sendes til community når full validering og den visuelle nettleserkontrollen er grønn. Svarene skal videre til redaksjonell behandling; de er ikke canonical data.

READY_FOR_COMMUNITY_RESEARCH
