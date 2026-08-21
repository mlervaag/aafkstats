# Spesifikasjon: community-drevet JA/NEI-verifisering under `/mangler`

Status: pilot implementert i PR #126; videre mål er eksplisitt merket i dokumentet

Datagrunnlag: `main` ved commit `ae542b9` (PR #122 inkludert)

Sist kontrollert: 2026-08-13

## Aviskandidater fra NB (PR #192)

Den samme verifiseringsflyten kan nå publisere redaksjonelt godkjente kampkandidater fra
NB-discovery. Dette er fortsatt verifiseringsinnspill, ikke kampdata. Svarene er **JA**,
**NEI** og **KAN IKKE BESTEMMES**; hopp over er en egen lokal handling.

- **JA:** Siden støtter den konkrete kampidentiteten og resultatpåstanden.
- **NEI:** Siden dokumenterer at kandidaten gjelder en annen kamp eller et annet resultat.
- **KAN IKKE BESTEMMES:** Siden er kontrollert, men avgjør ikke påstanden sikkert.
- **Hopp over:** Saken er ikke faglig vurdert og sender ikke inn noe svar.

Generatoren tar kontrakten `nb-newspaper-community-candidates@1`. Den publiserer bare
kandidater med `communityReviewable: true` og `visibility: community_reviewable`.
Standardstatus er `draft`; `open` krever en eksplisitt `approvedAt`. Kandidat-ID og stabil
kilderesultatnøkkel dedupliseres, og eksisterende manuelle saker overskrives aldri.

En avissak viser bare metadata som trengs for kontrollen: sesong, motstander, forventet
resultat, konkurranse, avis, utgavedato, side og direkte NB-lenke. OCR eller avisfulltekst
lagres ikke. Et JA kan suppleres med resultat, kampdato, hjemme/borte og konkurranse. NEI
og KAN IKKE BESTEMMES kan få strukturerte årsaker. Innsendingen blir et GitHub-issue med
`verificationCaseId`, revisjon, kilderesultat, hypotese, aviskandidat og community-funn.
Ingen av delene endrer canonical matches eller source-results automatisk.

Kjør generatoren som tørrkjøring:

```sh
pnpm data:newspaper-verification-candidates -- --input <manifest.json>
```

Legg til `--write` og eventuelt `--output <mappe>` først etter redaksjonell gjennomgang.
Vanlige tester bruker bare fixtures og gjør ingen kall til NB.

### 0.1 Leveransegrense for PR #126

Denne spesifikasjonen beskriver både den kjørbare førstegangsleveransen og retningen etter
at community har brukt den. Følgende er **implementert pilot** og er krav til PR #126:

- 25 håndredigerte, validerte og prioriterte YAML-saker med stabile revisjoner;
- schema, loader, SQLite-tabell/view og web-lesemodell;
- `/mangler`, `/mangler/saker`, permanente `/mangler/[id]`-lenker og den tidligere
  oversikten på `/mangler/oversikt`;
- egne sluttsider for løste, avviste, pausede og erstattede publiserte saker;
- responsiv JA/NEI-flyt, kildevalg, lokalt utkast og best-effort checkout;
- anonym, servervalidert innsending til GitHub med egen rate-limit og stabil retry-ID;
- en konservativ kandidatrapport fra eksplisitte person- og kampkonflikter;
- fixture-baserte tester som ikke er avhengige av produksjonsdatabasen.

Følgende er **videre mål**, ikke skjulte mergekrav for piloten:

- generatorer for alle usikkerhets-, OCR-, duplikat- og lagoppstillingssignalene;
- den fullstendige vektede rangeringsformelen og automatisk fingerprint-deduplisering;
- delt checkout-lagring på tvers av serverless-instanser;
- produktanalyse for åpning, kildeklikk, frafall og redaksjonell behandling;
- full nettleser-E2E og automatisk redaksjonell arbeidsflyt fra issue til data-PR.

Der senere avsnitt beskriver mer enn den implementerte listen over, er de målarkitektur.
Community-svar skal heller ikke i en senere versjon endre arkivfakta uten menneskelig review.

## 1. Sammendrag

`/mangler` skal bygges om fra en bred oversikt over arkivets hull til en konkret,
lavterskel arbeidsflate for menneskelig verifisering. En besøkende får én presis,
etterprøvbar påstand om gangen, nødvendig kontekst og direkte vei til relevante kilder.
Vedkommende svarer **JA** eller **NEI**, oppgir hvor påstanden ble kontrollert og sender
svaret til redaksjonell behandling uten krav om GitHub-konto.

Systemet skal være komplett fra første versjon:

- en eksplisitt datamodell for verifiseringssaker;
- en konservativ generator og en forklarbar rangeringsmodell;
- håndredigerte saker når automatikk ikke kan formulere dem forsvarlig;
- en mobil-først arbeidsflyt med én sak per skjerm;
- anonym innsending via den eksisterende GitHub-innboksen;
- GitHub som modererings- og revisjonsspor, ikke som brukergrensesnitt;
- ingen automatisk endring av historiske fakta basert på community-svar;
- klare redaksjonelle terskler, livsløp, tester, logging og misbruksvern;
- et ferdig startsett på 25 pilotsaker fra dagens `main`.

Den gamle oversikten over antall manglende kampfelt, ufullstendige sesonger og historiske
resultater beholdes på `/mangler/oversikt`. Den er nyttig som status, men oppfyller ikke
kravet om konkrete JA/NEI-oppgaver.

## 2. Bakgrunn og funn i dagens repo

### 2.1 Det som allerede finnes

Repoet har allerede det meste av infrastrukturen løsningen trenger:

- `apps/web/app/mangler/page.tsx` og `apps/web/lib/missing.ts` bygger en offentlig
  arbeidskø fra SQLite-viewene.
- `packages/schema/src/cli/contradictions.ts`, `uncertain.ts` og `duplicates.ts`
  oppdager mønstre som trenger menneskelig skjønn.
- `conflicts[]` i datamodellen bevarer uenigheter og krever en etterprøvbar beslutning
  før en konflikt kan markeres løst.
- `apps/web/app/api/contributions/route.ts` tar allerede imot anonyme bidrag, validerer
  dem, begrenser størrelse og frekvens og oppretter en GitHub-sak.
- GitHub Issue Forms dekker mer omfattende bidrag fra innloggede brukere.
- historiske kilder har stabile `sourceId`, sidetall og som regel en åpne-lenke via
  kildearkivet.

Dette er derfor en utvidelse av etablert arkitektur, ikke et nytt CMS eller en ny
dataplattform.

### 2.2 Lærdom fra de siste PR-ene

De siste data-PR-ene viser hvorfor systemet må finnes, og hvilke sikkerhetsregler det må
bygge på.

#### [PR #122](https://github.com/mlervaag/aafkstats/pull/122) – manuell verifisering må knyttes til riktig kildehenvisning

PR-en markerer `Manuelt verifisert.` på den konkrete `sourceRef`-en som faktisk er sett,
ikke på personen eller rollen som helhet. Den innfører trenerhistorikk, hedersroller og
flere historiske verv, men lar reelle konflikter stå åpne, blant annet Jan With 1981 mot
1982.

Konsekvens for systemet:

- En community-bekreftelse gjelder én påstand, én kilde og helst én side.
- «Jeg så siden» må ikke tolkes som at alle opplysninger på personen er kontrollert.
- Saken må bære revisjonen av påstanden brukeren svarte på.

#### [PR #121](https://github.com/mlervaag/aafkstats/pull/121) – en tredje kilde kan løse en konflikt, men ikke ved flertallsavstemning

PR-en sammenholder vervslister fra 1954 og 1989, rydder identiteter og løser blant annet
Finn Tollås/Reidar Skarbøvik med begrunnelse. Dette er et godt eksempel på at kildenes
nærhet og uavhengighet betyr mer enn antall like svar.

Konsekvens for systemet:

- Community-svar er dokumentasjon til en redaktør, ikke stemmer som velger sannheten.
- Én samtidig og presis kilde kan veie tyngre enn flere senere jubileumsoversikter.
- Innsendingen må skille «kontrollerte den foreslåtte siden» fra «fant en uavhengig kilde».

#### [PR #113](https://github.com/mlervaag/aafkstats/pull/113), [#114](https://github.com/mlervaag/aafkstats/pull/114) og [#116](https://github.com/mlervaag/aafkstats/pull/116) – identitet må foreslås konservativt

Navneformer ble tidligere sammenlignet bare én vei. Senere innhøsting viste både store
gevinster og reelle falske kandidater. En FotMob-profil med eksakt navnetreff ble avvist
når den ikke hadde AaFK-periode.

Konsekvens for systemet:

- Identitetssaker må vise begge navn, relevante sesonger og hvorfor de kan høre sammen.
- Navnelikhet alene kvalifiserer ikke en offentlig sak.
- En NEI-besvarelse må kunne dokumentere at personene er forskjellige; «jeg fant ikke»
  er ikke nok.

#### [PR #115](https://github.com/mlervaag/aafkstats/pull/115) – kontekst skal fylles ut av systemet

Bidragslenkene ble forbedret fordi brukeren ellers måtte skrive inn siden vedkommende
nettopp sto på.

Konsekvens for systemet:

- Saks-ID, påstand, target, kilde og side skal aldri være fritekst fra brukeren.
- Brukeren skal bare velge JA/NEI og beskrive dokumentasjonen.

#### [PR #117](https://github.com/mlervaag/aafkstats/pull/117) – strukturelt gyldige data kan fortsatt være historisk urimelige

120 FotMob-kamper ble importert med sterke tekniske sperrer. Likevel står eksempelvis
Bryne–AaFK 0–14 i 1996 som en uttrykkelig tvilsom opplysning som trenger uavhengig kilde.

Konsekvens for systemet:

- Anomalier må kunne bli saker selv om ingen to kilder allerede motsier hverandre.
- Høy sportslig usannsynlighet og stor statistisk konsekvens gir høy prioritet.

### 2.3 Målt kø på `main`

Ved spesifikasjonstidspunktet finnes:

- 21 eksplisitte uløste `conflicts[]` hos 19 personer;
- 6 funn i motsigelsesrapporten;
- 6 uvanlige kampresultater i usikkerhetsrapporten, hvor ett står som `probable` og
  uttrykkelig trenger uavhengig kontroll;
- 1 uløst personnavnkandidat og 5 klubbnavnkandidater i duplikatrapporten;
- 66 maskinelt leste lagoppstillingskandidater fra 26 publikasjoner;
- 98 roller hos 43 personer med minst én maskinelt lest kildehenvisning som ikke er
  merket manuelt verifisert, totalt 174 kildehenvisninger;
- 422 kildedokumenterte resultater som mangler nok identitet til å bli kanoniske kamper;
- 4 avsluttede seriesesonger med isolert dekning;
- 19 utledede spillere uten personfil og 3 spillerfiler uten kampkobling.

Ikke alle tallene er offentlige JA/NEI-saker. De viser likevel at det finnes en varig
tilførsel av kandidater etter pilotens 25 saker.

## 3. Mål og ikke-mål

### 3.1 Produktmål

1. Gjøre en nyttig historisk kontroll mulig på to til femten minutter.
2. La en bidragsyter forstå oppgaven uten kjennskap til YAML, Git eller datamodellen.
3. Samle dokumentasjon i en form som kan behandles uten en ny oppklaringsrunde.
4. Prioritere usikkerhet som har høy betydning og faktisk kan løses.
5. Bevare full sporbarhet fra publisert påstand via innsending og redaksjonell beslutning
   til data-PR.
6. La anonyme bidra uten at anonyme svar automatisk påvirker arkivets fakta.
7. Gjøre nye sakstyper mulig uten å bygge om brukergrensesnittet.

### 3.2 Ikke-mål

- Systemet er ikke en avstemning om historiske fakta.
- Systemet skal ikke auto-merge data eller auto-løse `conflicts[]`.
- Rå OCR-treff skal ikke publiseres direkte.
- Alle manglende felter skal ikke gjøres om til kunstige JA/NEI-spørsmål.
- Det skal ikke bygges et generelt CMS eller en skrivbar produksjonsdatabase.
- Det skal ikke lagres bok- eller avistekst som brukeren limer inn.
- Det skal ikke innføres poengtavle eller konkurranse som belønner mange raske svar på
  bekostning av kvalitet i første versjon.

## 4. Grunnprinsipper

### 4.1 Én sak er én atomisk påstand

Godt:

> Var Jan With æresmedlem fra 1981?

Dårlig:

> Var Jan With æresmedlem i 1981 eller 1982, og var han også formann i 1974?

En sak kan bare påvirke ett faglig spørsmål. Hvis én side inneholder fem usikre roller,
skal det opprettes fem saker.

### 4.2 JA og NEI skal ha eksplisitt semantikk

Hver sak lagrer `yesMeaning` og `noMeaning`.

- JA betyr at dokumentasjonen støtter den eksakte påstanden.
- NEI betyr at dokumentasjonen positivt motsier påstanden eller dokumenterer et konkret
  alternativ.
- Manglende funn er ikke NEI.
- Usikker bruker velger «Hopp over», som er navigasjon og ikke et faglig svar.

### 4.3 Dokumentasjon er påkrevd

Et JA/NEI uten dokumentasjon har ingen arkivverdi. Brukeren må minst oppgi én av:

- at en oppgitt digital kilde og side er kontrollert;
- URL til en ny kilde;
- en etterprøvbar bibliografisk henvisning, eksempelvis «Sunnmørsposten 9.9.1996 s. 18»;
- identifikasjon av et fysisk medlemsblad, program eller protokoll med side/oppslag.

«Jeg husker» hører fortsatt hjemme i den eksisterende minneinnboksen, ikke her.

### 4.4 Maskinen foreslår, redaktøren publiserer

Generatorene produserer kandidater. En kandidat blir først offentlig når en kvalifiserings-
port og eventuelt en redaktør har kontrollert at:

- påstanden er grammatisk og historisk entydig;
- både JA og NEI er meningsfulle;
- kildene og sidene kan åpnes eller beskrives;
- saken ikke allerede er løst;
- target og felt fortsatt finnes;
- saken ikke krever spesialistkunnskap som ikke forklares.

### 4.5 Community-svar er observasjoner, ikke beslutninger

En innsendt verifikasjon kan:

- bekrefte en kildeavlesning;
- tilføre en ny kilde;
- gjøre en sak klar for redaksjonell avgjørelse;
- avdekke at saken er feil formulert.

Den kan ikke alene endre kanoniske data. Endringen skjer i en vanlig PR med validering,
tester og begrunnelse.

## 5. Informasjonsarkitektur

### 5.1 Ruter

| Rute | Formål |
|---|---|
| `/mangler` | Aktiv arbeidsflate, én anbefalt JA/NEI-sak om gangen |
| `/mangler/saker` | Bla i aktive saker med filtre og sortering |
| `/mangler/[id]` | Stabil permanentlenke til én sak |
| `/mangler/oversikt` | Dagens brede arbeidskø og dekningsstatus |
| `/mangler/ferdig` | Takkeside og valg av neste sak |

Løste saksadresser skal bestå og vise konklusjon, kilder og eventuell data-PR. De skal ikke
returnere 404, fordi de inngår i GitHub-sporet. Individuelle saker får `noindex,follow`;
`/mangler` og `/mangler/oversikt` kan indekseres.

### 5.2 Hovedflyt

1. Brukeren åpner `/mangler`.
2. Systemet velger høyest rangerte kvalifiserte sak brukeren ikke har hoppet over eller
   svart på i denne nettleseren.
3. Kortet viser påstand, bakgrunn, hva som er uenig og konkrete kildeknapper.
4. Brukeren undersøker materialet.
5. Brukeren velger JA eller NEI.
6. Et kompakt dokumentasjonstrinn åpnes i samme kort.
7. Brukeren oppgir hvor svaret ble kontrollert og eventuelt en kommentar/navn.
8. En eksplisitt bekreftelsesknapp sender inn. Selve JA/NEI-klikket sender aldri direkte.
9. Takkesiden viser kvittering, hva som skjer videre og «Ta en sak til».

### 5.3 Alternativ flyt for GitHub-brukere

Under skjemaet finnes «Send via GitHub i stedet». Lenken åpner en egen Issue Form med
saks-ID, revisjon og påstand ferdig utfylt. Denne veien er sekundær og skal ikke være
påkrevd.

## 6. UI/UX-spesifikasjon

### 6.1 Sakskortet

Kortet skal inneholde, i denne rekkefølgen:

1. kategori og estimert arbeidsmengde, eksempelvis «Historisk verv · ca. 5 min»;
2. progresjon uten konkurransepreg, eksempelvis «25 åpne saker»;
3. selve påstanden som `<h1>` på enkeltsiden og `<h2>` i lister;
4. en kort forklaring på hvorfor arkivet er usikkert;
5. «Dette må du finne ut», i én setning;
6. kildeknapper med tittel og sidetall;
7. eventuelt «Søk etter en uavhengig kilde» med konkrete søketips;
8. tydelig tekst: «NEI betyr at en kilde viser at påstanden er feil – ikke bare at du
   ikke fant den»;
9. likeverdige JA- og NEI-knapper;
10. «Hopp over» som dempet, men tydelig navigasjon.

Ingen farge skal alene uttrykke JA eller NEI. Knappene skal ha tekst, fokusmarkering og
minst 44 × 44 px trefflate.

### 6.2 Dokumentasjonstrinnet

Etter valg vises:

- valgt svar i klartekst med «Endre»;
- radiovalg for dokumentasjonstype:
  - Jeg kontrollerte en av kildene over;
  - Jeg fant en annen digital kilde;
  - Jeg kontrollerte en fysisk/ikke-lenket kilde;
- kildevelger når en oppgitt kilde ble kontrollert;
- URL-felt bare for digital ny kilde;
- kort henvisningsfelt for fysisk kilde;
- valgfri kommentar, maks 1000 tegn;
- valgfritt navn/alias, maks 100 tegn;
- bekreftelse på at brukeren beskriver egen kontroll og ikke limer inn opphavsrettslig
  tekst;
- «Send verifisering».

Kildehenvisning er påkrevd. Kommentar og navn er valgfritt.

### 6.3 Kildevisning

Hver kildeknapp viser:

- kort tittel;
- side/oppslag;
- om kilden allerede er manuelt kontrollert, maskinelt lest eller bare er et alternativ;
- «Åpne original» når `accessUrl` finnes;
- «Om kilden» til `/kilder/[id]`;
- en forklaring hvis originalen krever norsk bibliotektilgang eller fysisk materiale.

Systemet skal ikke deeplinke til en side i Nasjonalbiblioteket med en antatt URL-form hvis
repoet ikke allerede har en stabil peker. I så fall åpnes verkets registrerte `accessUrl`,
og sidetallet står ved siden av.

### 6.4 Filtrering og valg

`/mangler/saker` tilbyr:

- kategori: verv, identitet, kamp, kildeavlesning, klubb;
- tidsbruk: under 5 min, 5–15 min, fordypning;
- kildetilgang: tilgjengelig på nett, bibliotek/fysisk, krever ny kilde;
- periode;
- sortering: anbefalt, nyeste, raskeste.

Anbefalt er standard og bruker rangeringsmodellen. Filtrene lagres i URL-en.

### 6.5 Mobil og tilgjengelighet

- Én kolonne opp til minst 900 px.
- Kildeknapper kan åpnes i ny fane uten å miste utfylt svar.
- Uferdig skjema lagres i `sessionStorage` per saks-ID og revisjon.
- Tilbakeknappen skal bevare valgt svar og tekst.
- Statusmeldinger bruker `aria-live`; feil kobles til riktig felt.
- Full tastaturnavigasjon og synlig fokus.
- Respekter `prefers-reduced-motion`.
- Ingen tidsfrist, automatisk bytte eller swipe som kan sende et svar ved et uhell.

### 6.6 Språk og tillit

Grunntonen er «hjelp arkivet å kontrollere», ikke «test kunnskapen din».

Fast forklaring på alle saker:

> Svaret ditt endrer ikke arkivet automatisk. Det sendes til redaksjonell kontroll sammen
> med kilden du oppgir.

Anonyme bidrag beskrives som anonyme i den offentlige GitHub-saken. Ikke lov at IP eller
tekniske driftsdata aldri behandles; si i stedet at navn ikke kreves og at IP ikke legges
i selve bidraget eller GitHub-saken.

## 7. Datamodell for verifiseringssaker

### 7.1 Lagring

Publiserte og historiske saker lagres i Git under:

```text
data/verification-cases/<case-id>.yaml
```

Dette gir samme review-, diff- og valideringsmodell som resten av arkivet. Generatorens
upubliserte kandidater skal ikke ligge i `data/`; de er rapportutdata.

### 7.2 Foreslått Zod-modell

Ny fil: `packages/schema/src/verification-case.ts`.

```ts
type VerificationCase = {
  id: string;
  status: "draft" | "open" | "paused" | "resolved" | "rejected" | "superseded";
  category: "role" | "identity" | "match" | "source_reading" | "club";
  claim: string;
  question: string;
  context: string;
  whyItMatters: string;
  yesMeaning: string;
  noMeaning: string;
  instructions: string[];
  target: {
    type: "person" | "match" | "season" | "club" | "source";
    id: string;
    field: string;
  };
  alternatives: Array<{ value: string | number; label: string }>;
  sources: Array<{
    sourceId?: string;
    providerId?: string;
    page?: string;
    role: "supports" | "contradicts" | "context" | "independent_wanted";
    note: string;
  }>;
  evidencePolicy: {
    requireCitation: true;
    independentSourcePreferred: boolean;
    allowed: Array<"listed_source" | "new_url" | "bibliographic">;
  };
  ranking: {
    impact: number;
    specificity: number;
    solvability: number;
    access: number;
    machineRisk: number;
    freshness: number;
    ambiguityPenalty: number;
    editorialBoost: number;
  };
  estimatedMinutes: number;
  generatedFrom?: {
    kind: "conflict" | "contradiction" | "uncertain" | "duplicate" | "extraction";
    fingerprint: string;
  };
  revision: string;
  publishedAt?: string;
  resolvedAt?: string;
  resolution?: {
    answer: "yes" | "no" | "inconclusive";
    reason: string;
    pullRequest?: string;
    issue?: string;
  };
};
```

### 7.3 Revisjon og foreldelse

`revision` er `sha256:` av alle felter som påvirker hva brukeren blir bedt om å
verifisere: claim, target, alternativer, kilder, JA-/NEI-betydning og instruksjoner.

Et svar må inneholde både `caseId` og `revision`. Hvis saken er endret etter at siden ble
åpnet, svarer API-et `409` og ber klienten laste saken på nytt. Et gammelt svar skal ikke
stille seg bak en ny formulering.

### 7.4 Valideringsregler

Bygget skal feile når:

- en åpen sak mangler kilde eller etterprøvbar søkeinstruks;
- `question` ikke ender som et JA/NEI-spørsmål;
- `yesMeaning` eller `noMeaning` er tom;
- claim eller question inneholder to mål-felt;
- target ikke finnes;
- `sourceId` eller `providerId` ikke finnes;
- kilde med sidekrav mangler side;
- to aktive saker har samme target, felt og claim-fingerprint;
- en løst sak mangler resolution og begrunnelse;
- `revision` ikke stemmer med innholdet;
- rangeringstall er utenfor sine intervaller.

Det er ikke mulig å avgjøre grammatisk atomisitet perfekt. Valideringen kombineres derfor
med snapshot-test av pilotkatalogen og redaksjonell review.

## 8. Kandidatgenerator og smart rangering

**Leveransestatus:** Piloten implementerer kommandoen og en deterministisk, konservativ
rapport for eksplisitte uløste konflikter på personer og kamper. Punkt 3–7 i listen under,
den komplette poengformelen og fingerprinting er videre mål når pilotdata viser at dette
gir presise nok JA/NEI-saker.

### 8.1 Generatorer

Ny kommando:

```text
pnpm data:verification-candidates
```

Den leser arkivet og skriver en deterministisk rapport, aldri datafiler.

Kilder:

1. uløste `conflicts[]`;
2. motsigelsesrapporten;
3. usikkerhetsrapporten;
4. identitets- og duplikatrapporten;
5. `sourceRef` med maskinell, ikke manuell verifisering;
6. lagoppstillingskandidater med én konkret mulig kamp;
7. kildedokumenterte resultater med én konkret mulig kanonisk kamp.

### 8.2 Hard kvalifiseringsport

En kandidat får ikke poeng og blir ikke foreslått hvis ett av disse er sant:

- mer enn ett felt må avgjøres;
- det finnes ikke et konkret target;
- JA og NEI kan ikke defineres positivt;
- påstanden er bare «noe mangler»;
- kandidaten bygger bare på navnelikhet uten sesong-, rolle- eller kildeoverlapp;
- en kilde kan ikke identifiseres eller søkeinstruksen ikke kan etterprøves;
- samme usikkerhet er allerede representert av en åpen sak;
- datagrunnlaget er allerede manuelt avgjort og låst;
- en negativ konklusjon bare kan bygge på fravær i søk.

### 8.3 Rangeringsformel

```text
score = impact
      + specificity
      + solvability
      + access
      + machineRisk
      + freshness
      + editorialBoost
      - ambiguityPenalty
```

| Faktor | Intervall | Betydning |
|---|---:|---|
| impact | 0–25 | Synlighet, statistisk påvirkning, antall berørte objekter |
| specificity | 0–20 | Eksakt target, felt, verdi, alternativ og side |
| solvability | 0–20 | Realistisk å løse for community på kort tid |
| access | 0–15 | Kilden er digital og direkte tilgjengelig |
| machineRisk | 0–10 | OCR, tabellkolonne, navnesammenslåing eller ekstremverdi |
| freshness | 0–5 | Ny eller nylig endret usikkerhet |
| editorialBoost | −20–20 | Begrunnet manuell justering |
| ambiguityPenalty | 0–30 | Flere mulige tolkninger, utilgjengelig kilde, sammensatt spørsmål |

Bare kandidater med score minst 55 foreslås. Score minst 75 merkes «høy prioritet».
Rangering avgjør rekkefølge, aldri sannhet.

### 8.4 Fingerprint og deduplisering

Generatoren lager fingerprint av:

```text
kind + target.type + target.id + target.field + sorted alternatives + source payload hashes
```

Endres en kildeobservasjon, blir kandidaten ny og en gammel sak kan markeres `superseded`.
Uendret kjøring skal gi byte-identisk rapport.

## 9. Svardata og API

### 9.1 Endepunkt

Ny rute:

```text
POST /api/verifications
```

Den skal gjenbruke sikkerhetsmønstrene fra `/api/contributions`, men ha en separat schema,
rate-limit-bøtte og GitHub-format.

### 9.2 Payload

```json
{
  "caseId": "jan-with-aeresmedlem-1981",
  "revision": "sha256:...",
  "answer": "yes",
  "evidence": {
    "type": "listed_source",
    "sourceId": "tango-siden-1914-2013-806b",
    "page": "350",
    "citation": "Kontrollert tabellen på side 350."
  },
  "comment": "Årstallet står i høyre kolonne.",
  "contributor": "Valgfritt alias",
  "clientSubmissionId": "uuid"
}
```

### 9.3 Servervalidering

Serveren skal:

1. avvise cross-site-forespørsler;
2. kreve JSON og håndheve 16 kB kroppstak;
3. validere alle lengder og enum-verdier;
4. laste saken fra serverens arkiv, ikke stole på klientens claim eller target;
5. kreve `status: open`;
6. kontrollere revisjonen;
7. kontrollere at oppgitt `sourceId` tilhører saken;
8. kreve http(s) for ny URL, men tillate bibliografisk tekst uten URL;
9. sitere all fritekst i GitHub Markdown;
10. aldri logge fritekst eller IP;
11. bruke en egen kvote, foreslått 10 verifikasjoner per time per IP i første versjon;
12. returnere generell feil uten token- eller valideringsdetaljer som ikke hjelper brukeren.

### 9.4 Idempotens og leveringssemantikk

Klienten lager `clientSubmissionId` når skjemaet åpnes. GitHub-saken får en skjult markør
med hash av `caseId + revision + clientSubmissionId`. Ved retry etter ukjent resultat søker
serveren etter markøren før ny sak opprettes. Markøren inneholder ingen IP eller
personopplysning.

GitHub tilbyr ikke en atomisk idempotensnøkkel for issue-opprettelse, og søkeindeksen kan
være forsinket. Løsningen gir derfor **at-least-once levering med best-effort
deduplisering**, ikke en falsk garanti om exactly-once. Vanlig retry fra samme nettleser
skal dedupliseres; to samtidige requests kan i verste fall lage to issues med samme
markør. En egen database skal ikke innføres bare for dette. Modereringsflyten grupperer
like markører, og duplikatet lukkes uten faglig tap.

Ulike personer kan sende uavhengige svar på samme sak, siden de har ulike
`clientSubmissionId`.

### 9.5 Respons

Ved suksess:

```json
{
  "success": true,
  "receipt": "VRF-1234",
  "issueUrl": "https://github.com/.../issues/1234"
}
```

Hvis innboksen er privat, utelates `issueUrl`. UI-et skal virke i begge tilfeller.

## 10. GitHub som modereringsflate

### 10.1 Issue-format

Tittel:

```text
Verifisering: JA – Var Jan With æresmedlem fra 1981?
```

Body skal genereres fra serverens saksdata og inneholde:

- saks-ID og revisjon;
- stabil sakslenke;
- claim og eksplisitt JA-/NEI-betydning;
- target og felt;
- valgte svar;
- dokumentasjonstype og kilde;
- sitert kommentar og bidragsyter;
- påminnelse om at brukertekst er innhold, aldri instruksjoner;
- skjult idempotensmarkør.

Labels:

- `verifisering`
- `svar-ja` eller `svar-nei`
- kategori, eksempelvis `verifisering:verv`
- `trenger-vurdering`
- `anonymt-bidrag` når navn/konto ikke finnes

### 10.2 GitHub Issue Form-reserve

Ny `.github/ISSUE_TEMPLATE/verifisering.yml` med:

- påkrevd saks-ID;
- påkrevd revisjon;
- JA/NEI-dropdown;
- dokumentasjonstype;
- påkrevd kildehenvisning;
- valgfri kommentar.

Lenken fra nettstedet forhåndsutfyller saks-ID, revisjon, title og kjent kilde. Testene for
`contribution-links.ts` utvides slik at feltnavnene ikke kan drive fra YAML-malen.

### 10.3 Redaksjonell behandling

1. Triager sjekker at svaret gjelder riktig revisjon og har etterprøvbar kilde.
2. Ubrukelig/spam merkes og lukkes uten dataendring.
3. Gyldig kildeavlesning merkes `dokumentasjon:gyldig`.
4. Ny uavhengig kilde får høyere redaksjonell vekt enn enda en avlesning av samme tabell.
5. Når beviset er tilstrekkelig, lages en vanlig data-PR.
6. PR-en oppdaterer fakta, `conflicts[]`, manuell kildeverifisering og selve saken.
7. Saken settes `resolved` med svar, begrunnelse, issue og PR.
8. Alle relevante GitHub-svar lukkes med lenke til avgjørelsen.

To samsvarende svar kan gjøre saken klar til vurdering, men gir aldri automatisk
avgjørelse. Motstridende community-svar øker behovet for en uavhengig kilde.

## 11. Misbruksvern, personvern og rettigheter

### 11.1 Første forsvarslinje

- Vercel Firewall-ratebegrensning foran endepunktet.
- Separat in-memory reservekvote, som eksisterende bidragsrute.
- Same-origin, JSON-only, kroppstak og streng Zod-schema.
- Honeypot-felt som må være tomt.
- Minimumstid mellom skjemaåpning og innsending på to sekunder; dette er et signal, ikke
  eneste sperre.
- Maks én ny GitHub-sak per vellykket request.
- Ingen filopplasting i første versjon.

Hvis spam oppstår, aktiveres Turnstile eller tilsvarende som trinn to. Det skal ikke være
en startbarriere uten dokumentert behov.

### 11.2 Anonymitet

- GitHub-konto kreves ikke på nettstedet.
- Navn/alias er valgfritt.
- IP brukes bare flyktig til rate-limit og skrives ikke i issue-body eller applikasjonslogg.
- Fritekst logges ikke.
- Saksbidrag kan bli offentlig synlig hvis GitHub-innboksen er offentlig; dette må stå før
  innsending.
- Brukeren skal ikke skrive kontaktinformasjon eller opplysninger om nålevende personer
  som ikke er relevante for AaFK-rollen.

### 11.3 Opphavsrett

Brukeren skal sitere kilde, side og egen observasjon, ikke lime inn artikkel- eller
boktekst. UI-et sier:

> Beskriv hva du kontrollerte med egne ord. Ikke lim inn avistekst eller lengre utdrag fra
> bøker og medlemsblad.

## 12. Databaselag og lesemodell

Byggesteget utvides med:

- `core_verification_cases` for hele saksobjektet, status, prioritet, kildereferanser og
  endelig resolution;
- view `verification_cases`, sortert slik at åpne saker kan leses i prioritert rekkefølge;
- kilde- og provideroppslag i web-lesemodellen, som hydrerer referansene med tittel og URL.

Piloten oppretter ikke egne normaliserte source- eller open-view. Kildereferansene ligger
som validert JSON i saksraden, og åpen status filtreres parameterisert i lesemodellen. Egne
views kan innføres senere dersom søk eller rapportering faktisk trenger dem.

Svar lagres ikke i SQLite, fordi produksjonsfilen er skrivebeskyttet og GitHub er
innboksen. Saksstatus og endelig konklusjon kommer inn i SQLite etter en data-PR.

Lesemodellen er delt slik:

- dagens brede funksjon beholdes for `/mangler/oversikt`;
- `loadVerificationCases(status)` returnerer saker for ønsket status eller hele historikken;
- ny `loadVerificationCase(id)` brukes av enkeltsiden og API-et.

## 13. Cache, rendering og robusthet

- Sakssidene kan forhåndsbygges sammen med resten av arkivet.
- API-et bruker samme bygde SQLite-fil og serververifiserer status/revisjon.
- Aktiv sak på `/mangler` kan velges på serveren etter score; klienten hopper over lokalt
  besvarte ID-er.
- `sessionStorage` inneholder bare saks-ID, revisjon, valgt svar og uferdig skjema.
- En løst sak som ligger i en gammel nettleserfanen avvises med `409` eller `410` og viser
  løsningen hvis tilgjengelig.
- GitHub-feil gir beholdt skjema og en retry-knapp; brukerens tekst må ikke forsvinne.

### 13.1 Myk reservasjon i piloten

For å redusere dobbeltarbeid reserverer klienten saken med
`POST /api/verifications/checkout` når den åpnes:

- reservasjonen identifiseres av en tilfeldig UUID i `sessionStorage`, ikke navn eller IP;
- samme nettleser kan fornye sin egen reservasjon;
- en annen besøkende sendes videre til neste ledige sak;
- `/mangler/saker` skjuler reserverte saker og oppdaterer listen hvert 30. sekund;
- klienten fornyer reservasjonen hvert fjerde minutt og frigjør den ved innsending eller
  «hopp over»;
- reservasjonen utløper automatisk etter 12 minutter dersom fanen lukkes eller forbindelsen
  forsvinner.

Piloten bruker et prosesslokalt minnekart. Det er en best-effort kollisjonsbrems, ikke en
distribuert lås: to forskjellige serverless-instanser kan i sjeldne tilfeller dele ut samme
sak. Dette er et bevisst kompromiss uten ny infrastruktur. Dersom faktisk dobbeltarbeid blir
et problem, kan samme API-kontrakt flyttes til delt korttidslagring uten å endre UI-et.

## 14. Pilotkatalog: 25 saker

Disse sakene skal seedes som håndredigerte YAML-filer. De 21 første kommer direkte fra
uløste `conflicts[]`. Påstanden er bevisst formulert om den første verdien i konflikten;
NEI krever dokumentasjon på det konkrete alternativet, ikke bare fravær.

Prioritetene under er produktprioritet, ikke antatt sannsynlighet for JA.

### 14.1 Kilde-ID-er brukt i pilotkatalogen

Saksfilene skal bruke stabile ID-er, ikke de forkortede titlene i teksten under. URL til
originalen løses fra kildeobjektets `accessUrl` under bygging.

| Kortnavn i katalogen | `sourceId` |
|---|---|
| 1939-boka | `aalesunds-fotballklub-gjennem-1939-ec28` |
| 35-årsberetningen | `aalesunds-fotballklubb-35-ar-e-1950-2e6c` |
| 50-årsboka | `aalesunds-fotballklubb-1914-50-1964-3815` |
| 75-årsboka | `vi-er-75-ar-1989-aff6` |
| 80-årsboka | `vi-er-80-ar-1914-1994-1994-5e91` |
| 90-årsboka | `aalesunds-fotballklubb-90-ar-1-2004-ad1d` |
| Tango 2013 | `tango-siden-1914-2013-806b` |
| Medlemsblad 1951, side 63 | `medlemsblad-for-aalesunds-fotb-1951-b0e6` |
| Medlemsblad 1954, side 74 | `medlemsblad-for-aalesunds-fotb-1954-cd1c` |
| Medlemsblad 1961, side 36 | `medlemsblad-for-aalesunds-fotb-1961-a9f8` |
| Medlemsblad 1968, side 5 | `medlemsblad-for-aalesunds-fotb-1968-db10` og `medlemsblad-for-aalesunds-fotb-1968-c2b6` |
| Medlemsblad 1969, side 3 | `medlemsblad-for-aalesunds-fotb-1969-da4a` |
| Medlemsblad 1971, side 5 | `medlemsblad-for-aalesunds-fotb-1971-e55d` |
| Medlemsblad 1971, side 10 | `medlemsblad-for-aalesunds-fotb-1971-dc4a` |
| Medlemsblad 1974, side 3 | `medlemsblad-for-aalesunds-fotb-1974-6d28` og `medlemsblad-for-aalesunds-fotb-1974-ab1b` |
| Medlemsblad 1974, side 6 | `medlemsblad-for-aalesunds-fotb-1974-5775` |
| Medlemsblad 1977, side 13 | `medlemsblad-for-aalesunds-fotb-1977-fbae` |
| AaFKs lederhistorikk | `aafk-historie-ledere` |
| AaFKs stiftelseshistorie | `aafk-historie-stiftelsen` |
| AaFKs side om Nørvebana | `aafk-historie-norvebana` |

Når to `sourceId` viser til samme utgave fra ulike NB-registreringer, skal begge beholdes
som kontekst, men UI-et kan gruppere dem som én publikasjon. Et community-svar må peke på
den konkrete registreringen brukeren faktisk åpnet.

### P01 – Anders Mogstad, formann 1921

- ID: `anders-mogstad-formann-1921`
- Spørsmål: **Var Anders Mogstad formann i AaFK i 1921?**
- Alternativ: Rasmus Eck Olsen.
- Kilder å kontrollere: 50-årsboka side 81; 1939-boka side 18; Tango 2013 side 348.
- Hvorfor: En årsrad ser ut til å kollidere med en manuelt kontrollert flerårsperiode.
- JA: En kilde identifiserer Anders Mogstad som klubbformann i 1921.
- NEI: En kilde identifiserer en annen person som klubbformann i 1921.
- Prioritet: 92.

### P02 – Edvard Skugvik, formann 1920

- ID: `edvard-skugvik-formann-1920`
- Spørsmål: **Var Edvard Skugvik formann i AaFK i 1920?**
- Alternativ: Rasmus Eck Olsen.
- Kilder: 50-årsboka side 81; 1939-boka side 18; Tango 2013 side 348.
- Hvorfor: Samme år inngår i en manuelt kontrollert periode for Rasmus Eck Olsen.
- Prioritet: 92.

### P03 – Edvard Skugvik, oppmann 1920

- ID: `edvard-skugvik-oppmann-1920`
- Spørsmål: **Var Edvard Skugvik oppmann i AaFK i 1920?**
- Alternativ: Rasmus Eck Olsen.
- Kilder: 75-årsboka side 8; 90-årsboka side 27; 80-årsboka side 7.
- Hvorfor: Senere oversiktstabeller og OCR-lesningen av 80-årsboka peker på ulike navn.
- Prioritet: 88.

### P04 – Einar Aas, formann 1961

- ID: `einar-aas-formann-1961`
- Spørsmål: **Var Einar Aas formann i AaFK i 1961?**
- Alternativ: Kjell Berentzen.
- Kilder: 50-årsboka side 81; medlemsblad 1961 side 36; Tango 2013 side 348;
  75-årsboka side 8.
- Hvorfor: En maskinelt lest årsrad motsier flere senere lederoversikter.
- Prioritet: 87.

### P05 – Einar With, formann 1949

- ID: `einar-with-formann-1949`
- Spørsmål: **Var Einar With formann i AaFK i 1949?**
- Alternativ: Sigurd Nørve; samme side kan i stedet omtale Einar With som nestformann.
- Kilder: medlemsblad 1977 side 13; Tango 2013 side 348; 75-årsboka side 8;
  90-årsboka side 27.
- Hvorfor: Dette kan være en OCR-/kolonnefeil mellom formann, nestformann og oppmann.
- Prioritet: 96.

### P06 – Einar With, formann 1974

- ID: `einar-with-formann-1974`
- Spørsmål: **Var Einar With formann i AaFK i 1974?**
- Alternativ: Jan With.
- Kilder: medlemsblad 1974 side 6; 75-årsboka side 8; Tango 2013 side 348;
  90-årsboka side 27.
- Hvorfor: Lik etternavn gjør maskinell personkobling særlig risikabel.
- Prioritet: 94.

### P07 – Finn Tollås, formann 1946

- ID: `finn-tollas-formann-1946`
- Spørsmål: **Var Finn Tollås formann i AaFK i 1946?**
- Alternativ: Peder Puck; andre lederlister peker også på Sigurd Nørve rundt grenseåret.
- Kilder: 50-årsboka side 81; medlemsblad 1954 side 74; 75-årsboka side 8;
  90-årsboka side 27.
- Hvorfor: PR #121 løste en annen Tollås-konflikt, men denne står fortsatt åpen.
- Prioritet: 91.

### P08 – Hans J. Henriksen, formann 1968

- ID: `hans-j-henriksen-formann-1968`
- Spørsmål: **Var Hans J. Henriksen formann i AaFK i 1968?**
- Alternativ: Erling Bjørge.
- Kilder: medlemsblad 1969 side 3; medlemsblad 1968 side 5; Tango 2013 side 348;
  75-årsboka side 8.
- Hvorfor: Samtidige medlemsblad kan avklare om 1968 er et skifteår eller OCR-feil.
- Prioritet: 93.

### P09 – Harald Hagen, formann 1916

- ID: `harald-hagen-formann-1916`
- Spørsmål: **Var Harald Hagen formann i AaFK i 1916?**
- Alternativ: Olaf Ingebrigtsen.
- Kilder: 50-årsboka side 81; 1939-boka side 18; Tango 2013 side 348;
  90-årsboka side 27.
- Hvorfor: Flere manuelt kontrollerte oversikter kan testes mot den avvikende årslisten.
- Prioritet: 90.

### P10 – Jan With, æresmedlem fra 1981

- ID: `jan-with-aeresmedlem-1981`
- Spørsmål: **Ble Jan With æresmedlem i 1981?**
- Alternativ: 1982.
- Kilder: Tango 2013 side 350; 90-årsboka side 27.
- Søkeoppgave: Finn helst en samtidig årsmelding, avis eller medlemsblad fra 1981–1982.
- Hvorfor: To manuelt kontrollerte jubileumsbøker er eksplisitt uenige.
- Prioritet: 100.

### P11 – Jarle Kristoffersen, formann 1967

- ID: `jarle-kristoffersen-formann-1967`
- Spørsmål: **Var Jarle Kristoffersen formann i AaFK i 1967?**
- Alternativ: Erling Bjørge.
- Kilder: medlemsblad 1974 side 3; Tango 2013 side 348; 75-årsboka side 8;
  90-årsboka side 27.
- Prioritet: 88.

### P12 – Kjell Berentzen, formann 1962

- ID: `kjell-berentzen-formann-1962`
- Spørsmål: **Var Kjell Berentzen formann i AaFK i 1962?**
- Alternativ: Hans J. Henriksen.
- Kilder: Tango 2013 side 293 og 348; 75-årsboka side 8; 90-årsboka side 27.
- Hvorfor: Ett fortellende oppslag og flere ledertabeller må sammenholdes.
- Prioritet: 86.

### P13 – Konrad Korsnes, formann 1938

- ID: `konrad-korsnes-formann-1938`
- Spørsmål: **Var Konrad Korsnes formann i AaFK i 1938?**
- Alternativ: Peder Puck.
- Kilder: 50-årsboka side 81; 1939-boka side 18; Tango 2013 side 348;
  90-årsboka side 27.
- Prioritet: 93.

### P14 – Nils Jangaard, oppmann 1917

- ID: `nils-jangaard-oppmann-1917`
- Spørsmål: **Var Nils Jangaard oppmann i AaFK i 1917?**
- Alternativ: Harald Riise-Hansen.
- Kilder: 80-årsboka side 7; 1939-boka side 18; 75-årsboka side 8;
  90-årsboka side 27.
- Hvorfor: Fulltekstkontekst og tabellavlesning peker på ulike personer.
- Prioritet: 91.

### P15 – Øivind Haagensen, formann 1940

- ID: `oivind-haagensen-formann-1940`
- Spørsmål: **Var Øivind Haagensen formann i AaFK i 1940?**
- Alternativ: Peder Puck.
- Kilder: 50-årsboka side 81; 35-årsberetningen side 5; 75-årsboka side 8;
  90-årsboka side 27.
- Hvorfor: En avvikende årsrad møter en sammenhengende lederperiode 1940–1945.
- Prioritet: 92.

### P16 – Olaf Ingebrigtsen, oppmann 1916

- ID: `olaf-ingebrigtsen-oppmann-1916`
- Spørsmål: **Var Olaf Ingebrigtsen oppmann i AaFK i 1916?**
- Alternativ: Harald Hagen.
- Kilder: 80-årsboka side 7; 1939-boka side 18; medlemsblad 1954 side 74;
  75-årsboka side 8.
- Prioritet: 90.

### P17 – Ole Jangaard, formann 1915

- ID: `ole-jangaard-formann-1915`
- Spørsmål: **Var Ole Jangaard formann i AaFK i 1915?**
- Alternativ: Georg Haller.
- Kilder: 50-årsboka side 81; 1939-boka side 18; 75-årsboka side 8;
  90-årsboka side 27.
- Hvorfor: Georg Haller har en manuelt dokumentert formannsperiode 1914–1915, mens Ole
  Jangaard er dokumentert som oppmann.
- Prioritet: 97.

### P18 – Peder Puck, formann 1932

- ID: `peder-puck-formann-1932`
- Spørsmål: **Var Peder Puck formann i AaFK i 1932?**
- Alternativ: Sverre Volstad.
- Kilder: 50-årsboka side 81; 1939-boka side 18; Tango 2013 side 348;
  75-årsboka side 8.
- Prioritet: 93.

### P19 – Per Anker Eriksen, formann 1948

- ID: `per-anker-eriksen-formann-1948`
- Spørsmål: **Var Per Anker Eriksen formann i AaFK i 1948?**
- Alternativ: Sigurd Nørve.
- Kilder: medlemsblad 1951 side 63; Tango 2013 side 235 og 348; 75-årsboka side 8;
  90-årsboka side 27.
- Hvorfor: Ett OCR-treff kan ha lest et annet verv eller en fortellende kontekst som en
  årsrad.
- Prioritet: 95.

### P20 – Per Mogstad, formann 1925

- ID: `per-mogstad-formann-1925`
- Spørsmål: **Var Per Mogstad formann i AaFK i 1925?**
- Alternativ: Sverre Mogstad.
- Kilder: 50-årsboka side 81; 1939-boka side 18; Tango 2013 side 348;
  75-årsboka side 8.
- Hvorfor: Samme etternavn gjør en OCR-/identitetsforveksling sannsynlig og lett å overse.
- Prioritet: 96.

### P21 – Petter Birkevold, formann 1971

- ID: `petter-birkevold-formann-1971`
- Spørsmål: **Var Petter Birkevold formann i AaFK i 1971?**
- Alternativ: Ola Hodder.
- Kilder: medlemsblad 1974 side 3; medlemsblad 1971 side 5 og 10;
  Tango 2013 side 348; 90-årsboka side 27.
- Hvorfor: Samtidige medlemsblad finnes og bør kunne løse saken presist.
- Prioritet: 98.

### P22 – Bryne–AaFK 0–14 i 1996

- ID: `bryne-aafk-resultat-1996-09-08`
- Spørsmål: **Vant AaFK 14–0 borte mot Bryne 8. september 1996?**
- Target: `1996-09-08-bryne-aalesunds-fk`, `home.score` og `away.score` behandles som
  ett atomisk resultatfelt.
- Kjent grunnlag: fotball.no/NFF-data og tabellen som er avledet av samme data.
- Søkeoppgave: Sunnmørsposten 9. september 1996, Stavanger Aftenblad, Brynes kamparkiv
  eller en annen uavhengig samtidig kilde.
- Hvorfor: Resultatet er ekstremt, kilden og tabellen er ikke uavhengige, og kampen står
  `probable`.
- JA: En uavhengig kilde dokumenterer 0–14.
- NEI: En uavhengig kilde dokumenterer et annet sluttresultat.
- Prioritet: 100.

### P23 – Philip Emblem Storaas og Philip Storås

- ID: `philip-emblem-storaas-samme-som-philip-storas`
- Spørsmål: **Er «Philip Emblem Storaas» i lagoppstillingen samme person som Philip Storås?**
- Target: personidentitet og én registrert kamp i 2025.
- Dokumentasjon: kamptropp, klubbprofil, spillerstall eller annen kilde som knytter fullt
  navn til samme AaFK-spiller.
- JA: Kilden knytter begge navneformene til samme spiller.
- NEI: Kilden dokumenterer to forskjellige personer.
- Hvorfor: Dette er eneste aktuelle personfunn i duplikatrapporten.
- Prioritet: 84.

### P24 – Kjell Vestre og Kjell Westre

- ID: `kjell-vestre-samme-som-kjell-westre`
- Spørsmål: **Er Kjell Vestre og Kjell Westre samme person?**
- Kontekst: Begge står som klubbformann i 1977 i hver sin personfil.
- Kilder: AaFKs lederhistorikk; 75-årsboka side 8; 90-årsboka side 27; helst et samtidig
  medlemsblad eller årsmøteprotokoll.
- JA: Kilden viser at Vestre/Westre er to skrivemåter av samme formann.
- NEI: Kilden dokumenterer to forskjellige personer.
- Hvorfor: Dubletten skaper to samtidige innehavere av et entydig verv.
- Prioritet: 99.

### P25 – Georg Hallers to formannsroller i 1914

- ID: `georg-haller-to-formannsroller-1914`
- Spørsmål: **Var Georg Haller både klubbformann og formann i banekomiteen i 1914?**
- Kilder: 1939-boka side 18; AaFKs stiftelseshistorie; AaFKs side om Nørvebana.
- JA: Kildene skiller eksplisitt mellom to samtidige roller.
- NEI: En kilde viser at den ene tittelen er en upresis gjentakelse av den andre.
- Hvorfor: Motsigelsesrapporten varsler «mindre presis», men dette kan være et legitimt
  historisk dobbeltverv. Saken tester om rapportregelen gir falsk positiv.
- Prioritet: 78.

### Pilotmerknad

P25 er den eneste piloten der påstanden inneholder ordet «både». Den er fortsatt atomisk
fordi feltet som skal avgjøres er relasjonen mellom to eksisterende roller: om de er to
separate verv eller samme verv dobbeltført. Hvis implementasjonens atomisitetsvakt ikke
kan uttrykke dette rent, skal den modelleres som en `identity`-sak mellom rolle-ID-ene,
ikke som to separate faktaspørsmål.

## 15. Kandidater som bevisst ikke er med i piloten

- De seks styremedlemmene i 1939 er ikke en konflikt: `styremedlem` er ikke et entydig
  verv, så flere samtidige innehavere er normalt. Rapportregelen må rettes før slike funn
  kan generere saker.
- De fem øvrige store resultater i usikkerhetsrapporten er allerede `confirmed`; behovet
  gjelder manglende bane/klokkeslett, og det finnes foreløpig ingen konkret verdi å stille
  et JA/NEI-spørsmål om.
- De 66 lagoppstillingskandidatene spør i dag «hvilken kamp?». De kan først bli binære når
  systemet finner én konkret kampkandidat.
- De 422 historiske resultatene er ikke binære før dato/hjemme-borte eller en bestemt
  kampkobling er foreslått.
- Spillere uten personfil er arbeidsmengde, ikke i seg selv usikker identitet.
- Rå OCR-roller uten et konkret alternativ kan brukes som «står dette på siden?», men
  piloten prioriterer først konflikter med høyere konsekvens.

## 16. Tester og akseptansekriterier

Punktene om schema, databygg, kø, API og permanent historikk er automatiserte
pilotakseptanser. Full nettleser-E2E, alle filtervarianter, golden-output for den framtidige
generatoren og måling av visuelle treffflater er videre kvalitetsarbeid; de er ikke påstått
dekket av PR #126.

### 16.1 Schema og databygg

- Gyldig pilotkatalog parses og bygges til SQLite.
- Ugyldig source/target/revision feiler med fil og felt.
- Duplicate fingerprint feiler.
- Løst case uten resolution feiler.
- Generatoren er deterministisk og har golden-output mot fixtures.
- Alle 25 pilot-ID-er finnes og er unike.

### 16.2 Kø og rangering

- Bare `open` vises i aktiv kø.
- Score beregnes identisk i CLI og web.
- Høyest score velges når ingen lokal historikk finnes.
- Hoppede/besvarte saker filtreres lokalt uten å skjule dem fra `/mangler/saker`.
- Filterparametere er delbare og tåler ugyldige verdier.

### 16.3 UI

- Sak fungerer uten JavaScript som lesbar side med kildelenker; innsending krever klient-
  forbedringen.
- JA/NEI sender ikke før dokumentasjon og bekreftelse.
- Bytte av svar oppdaterer semantikken.
- Åpning av kilde mister ikke utkast.
- Løst, pauset og superseded har tydelige tom-/sluttilstander.
- Skjermleser annonserer valideringsfeil og suksess.
- Tastatur og mobil treffflater verifiseres.

### 16.4 API og sikkerhet

- Gyldig anonym innsending lager korrekt issue.
- Ugyldig/utdatert revisjon avvises.
- Lukket sak avvises.
- Kilde som ikke tilhører saken avvises.
- Bibliografisk kilde godtas uten URL; `javascript:` og andre ordninger avvises.
- Cross-site, feil content type og for stor kropp avvises.
- Fritekst siteres og kan ikke bryte issue-formatet.
- Token og intern validering lekker ikke.
- Rate-limit for verifisering påvirker ikke chat eller andre bidrag.
- Sekvensiell retry med samme `clientSubmissionId` dedupliseres; testen dokumenterer at
  samtidige requests kan gi duplikat fordi GitHub ikke tilbyr atomisk idempotens.

### 16.5 End-to-end

Minst disse historiene skal testes:

1. Åpne Jan With-saken, åpne kilde, svar JA med oppgitt kilde, send og få kvittering.
2. Svar NEI med ny bibliografisk kilde på Bryne-saken.
3. Åpne gammel revisjon etter deploy og få en forståelig oppdateringsmelding.
4. Åpne løst permanentlenke og se konklusjon og PR.
5. GitHub-feil bevarer skjemaet og retry lykkes uten dobbelt issue.
6. To separate nettleserøkter åpner køen; den andre får neste sak, og saken kommer tilbake
   senest 12 minutter etter at den første økten forsvinner.

## 17. Observabilitet

API-et skriver strukturerte start- og sluttlogger til Vercel Runtime Logs. De inneholder bare
rute, Vercel request-ID, HTTP-status og varighet. Kjente GitHub-feil får i tillegg en grov
feiltype og eventuell statuskode fra GitHub.

Logg bare strukturerte metadata:

```json
{
  "level": "info",
  "msg": "done",
  "route": "/api/verifications",
  "request_id": "arn1::...",
  "status": 200,
  "ms": 420
}
```

Ikke logg saks-ID, revisjon, svar, citation, kommentar, contributor, URL fra brukeren eller IP.

Vercel Web Analytics måler den grove brukerflyten med `verification-started`,
`verification-source-opened`, `verification-skipped` og `verification-submitted`. Hendelsene
kan ha sakskategori, dokumentasjonstype, status og sekunder, men aldri saks-ID, svartekst,
kilde-ID eller URL.

Følg med på:

- start på en kontroll;
- kildelenkeklikk;
- hopp over;
- startet og fullført innsending;
- GitHub-feil og rate-limit;
- tid til redaksjonell triage og avgjørelse;
- andel svar som gir en gyldig kilde;
- andel saker som ender i data-PR.

Analytics skal respektere dagens personvernvalg i prosjektet og ikke innføre ny
fingerprinting.

## 18. Utrulling

Trinnene er en operativ sjekkliste. Trinn 1–3 er kodeleveransen i PR #126; kontrollene i
trinn 4 og produksjonsaktiveringen i trinn 5 skjer før lenken deles offentlig.

### Trinn 1 – fundament

- schema, loader, SQLite-tabeller og validering;
- 25 pilot-YAML-filer;
- kandidatgenerator og score;
- flytting av gammel side til `/mangler/oversikt`.

### Trinn 2 – komplett brukerflyt

- nye ruter og sakskort;
- filtre, permanentlenker og løste tilstander;
- dokumentasjonstrinn og session-utkast;
- tilgjengelighet og responsivt design.

### Trinn 3 – innsending og moderering

- `/api/verifications`;
- GitHub issue-format, labels og Issue Form-reserve;
- idempotens, rate-limit og logging;
- redaksjonell runbook.

### Trinn 4 – verifikasjon før lansering

- full validate/typecheck/lint/test/build;
- browsergjennomgang på mobil og desktop;
- testinnsending mot en separat GitHub-innboks;
- kontroll av alle 25 kildelenker og sidetall;
- gjennomgang av personvern- og rettighetstekst;
- simulering av GitHub-nedetid og utdatert case.

### Trinn 5 – offentlig lansering

- aktiver produksjonsinnboks og Firewall-regel;
- publiser de 25 sakene;
- følg feil og spam tett første uke;
- ikke utvid automatisk kø før minst ti faktiske svar er redaksjonelt vurdert.

## 19. Suksesskriterier og beslutningspunkt

Etter 50 innsendinger eller fire uker, det som kommer sist, vurderes:

- minst 60 % av innsendingene har etterprøvbar og relevant dokumentasjon;
- minst 30 % gjør en sak klarere, løser den eller tilfører en ny uavhengig kilde;
- median redaksjonell triage er under fem minutter;
- spam/åpenbart misbruk er under 10 %;
- ingen community-svar har endret data uten review;
- minst fem saker har fått dokumentert avgjørelse eller tydeligere konfliktstatus.

Hvis dokumentasjonskvaliteten er lav, strammes kildekrav og onboarding før innlogging
vurderes. Hvis spam er problemet, aktiveres botvern. GitHub-innlogging skal bare bli krav
dersom anonym moderering faktisk viser seg uholdbar.

## 20. Definition of done

### 20.1 PR #126 er ferdig når

- `/mangler` bare presenterer konkrete JA/NEI-saker;
- den gamle oversikten fortsatt er tilgjengelig;
- alle 25 pilotsaker er schema- og referansevalidert og publisert (selve påstandene er
  nettopp det community skal kildekontrollere);
- anonyme og GitHub-innloggede brukere har fungerende innsending;
- svar gir GitHub-spor, men aldri automatisk dataendring;
- løste saker har permanent konklusjon og PR-lenke;
- generatoren finner nye kandidater uten å publisere dem automatisk;
- fixture-baserte schema-, kø-, historikk-, checkout- og API-testene er grønne;
- validate, typecheck, lint, test og produksjonsbygg er grønne;
- løsningen er visuelt kontrollert på mobil og desktop før offentlig deling.

### 20.2 Etter piloten er systemretningen oppfylt når

- faktiske svar viser at flere signalkilder kan generere presise spørsmål;
- full nettleser-E2E dekker hovedhistoriene i 16.5;
- nødvendige driftsmålinger og redaksjonell runbook er på plass;
- delt checkout eller sterkere botvern innføres bare dersom faktisk bruk begrunner det.
