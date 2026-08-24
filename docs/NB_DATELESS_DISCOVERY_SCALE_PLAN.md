# Skalert NB-søk for udaterte kampresultater

## Mål og avgrensning

Målet er å finne datoevidens for flest mulig kildeførte AaFK-resultater som ennå ikke er koblet til en kanonisk kamp. Arbeidet starter i den autoritative discovery-ledgeren, ikke i alle historiske source-result-rader.

Utgangspunktet etter PR #226 er:

- 779 claims i discovery-universet
- 617 `needs_visual_review`
- 17 `requires_revalidation`
- 0 `ready_pending_canonicalization`
- 1 467 rå source-result-rader uten dato eller `matchId`
- 629 av de 634 aktive discovery-claimene kan representeres som datoløse NB-spørringer

Råtallet 1 467 kan ikke brukes som arbeidskø. Det inneholder eldre og overlappende representasjoner som discovery-ledgeren allerede har deduplisert. `sourceClaimId` er primærnøkkel; legacy-koordinatet beholdes bare for sporing.

Denne innhøstings-PR-en skriver ingen kanoniske kamper og ingen `matchId`. Den produserer datoevidens, kandidatlister og en eksplisitt restkø. Kanonisering skjer i en egen PR etter redaksjonell kontroll.

## Kostnadsrekkefølge

### Pass 0 – lokal avstemming

Ingen nettverkskall.

1. Fjern terminale claims og claims som ikke lenger finnes på gjeldende koordinat.
2. Dedupliser på `sourceClaimId` og behold sibling-grupper samlet.
3. Sammenlign sesong, motstander, resultat og konkurranse med eksisterende canonical matches.
4. Send bare entydige lokale treff til en separat lenkereview. Tvetydige treff går videre uten automatisk kobling.

### Pass 1 – gjenbruk av eksisterende NB-kandidater

PR #198-materialet har 2 438 kandidatsider for 636 historiske hypoteser. Rank 1 prøves først. Rank 2 og 3 brukes bare når rank 1 ikke gir lokalt forankret motstander- og resultatevidens.

Dette passet skal aldri starte et nytt bredt årssøk. Det henter bare begrensede OCR-fragmenter for allerede kjente NB-utgaver og stopper ved første entydige treff.

### Pass 2 – sannsynlige måneder

Når eksisterende kandidater ikke avgjør saken, søker resolveren bare månedene som følger av:

- nærmeste daterte kamp før og etter i kildens rekkefølge
- konkurranse og runde når dette er kjent
- historisk sesongmønster

Første skalerte kjøring bruker ett OCR-probe per måned og maksimalt fire kandidater i ledgershortlisten. Nye batcher starter med to søkevarianter per måned og øker bare når målt treffrate forsvarer det. Resultatboks eller tilsvarende lokalt anker må navngi begge lag og riktig resultat. Et slikt treff blir `datoevidens_funnet`; datoen er fortsatt et forslag med intervall frem til produksjonsreview.

### Pass 3 – kontrollert ekstrarunde

Bare `kandidatliste` med høy forventet verdi får en ny maskinell runde:

- probe nummer to i de allerede valgte månedene
- rank 2–3 fra eksisterende kandidater
- ingen global `--refresh`
- ingen utvidelse til hele årgangen uten dokumentert grunn

Kjøringen stoppes når marginal treffrate faller under 5 prosent i to påfølgende blokker på minst 25 claims.

### Pass 4 – selektiv faksimilekontroll

Visuell kontroll er en unntaksgate, ikke standardløypa. Den brukes for:

- sterke kandidater der OCR mangler ett nødvendig anker
- scorekonflikter og mulig pause-/sluttresultat-forveksling
- sibling-grupper som kan løses atomisk
- viktige før-1945-saker med én konkret, tilgjengelig side

Én visuell batch skal normalt være 10–20 atomiske review-enheter. En sak som ikke avgjøres raskt får eksplisitt reststatus og blokkerer ikke resten av køen.

## Stoppregler per claim

Et claim stoppes i inneværende runde når ett av disse vilkårene er oppfylt:

- lokalt entydig eksisterende canonical match
- lokalt forankret NB-resultat med datointervall
- fire relevante kandidater uten sikkert anker
- ingen treff i de sannsynlige månedene
- årgangen er ikke digitalisert
- sibling- eller identitetskonflikt krever samlet review

`ingen_treff` betyr bare at det avgrensede passet er tomt. Det er ikke en påstand om at avisa aldri omtalte kampen.

## Maskinlesbare leveranser

Den resumérbare rårapporten ligger i `.cache/` og kan inneholde korte OCR-fragmenter. Den skal ikke committes.

Versjonerte ledgere under `data/discovery/nb-dateless-discovery-*.yaml` inneholder bare:

- `sourceClaimId` og compatibility-ID
- sesong, motstander og resultat
- utgave-ID, dato, side og permanent NB-lenke
- strukturert utfall og rangeringsgrunner
- køene `dateEvidenceReview`, `candidateReview` og `exhausted`

OCR-tekst lagres ikke i Git.

## Produksjonsgate i neste PR

`datoevidens_funnet` er input til review, ikke direkte canonical sannhet. Før en kamp opprettes eller kobles skal neste PR kontrollere:

- claimets gjeldende `sourceClaimId` og koordinat
- motstander, score, konkurranse og hjemme/borte
- kampdato mot utgivelsesdato og eventuelle nabokamper
- eksisterende match-identitet og event collision
- sibling-gruppen atomisk
- om evidensen krever faksimilekontroll

Tillatte utfall er `matched_existing_canonical`, `canonicalized`, `requires_visual_review`, `community_research`, `candidate_exhausted` eller en eksplisitt rejection. Kjøringen skal være idempotent.

## Første skalerte måling

Før full kjøring ble fem udaterte 1965-resultater prøvd med sannsynlige måneder. To fikk maskinelt forankret datoevidens og tre fikk kandidatliste. Denne treffraten begrunner en større, men fortsatt begrenset batch. Resultatene fra den skalerte batchen føres inn her før PR-en ferdigstilles.

Den skalerte kjøringen behandlet deretter 60 claims mot NB og avstemte alle 629 maskinelt representerbare aktive claims lokalt. Resultatet ble 28 eksisterende match-kandidater, to datoevidenssaker og 54 avgrensede kandidatlister. Fire av de lokale treffene lå også i NB-utvalget, slik at 84 unike claims ble berørt. Detaljene og videre anbefaling står i [`NB_DATELESS_DISCOVERY_SCALE_REPORT.md`](NB_DATELESS_DISCOVERY_SCALE_REPORT.md).
