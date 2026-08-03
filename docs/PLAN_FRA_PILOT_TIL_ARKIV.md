# Plan fra faktapilot til historisk arkiv

Denne planen beskriver veien fra dagens fungerende grunnmur til et historisk AaFK-arkiv
med kampfakta, søk og egne kampoppsummeringer. Den erstatter ikke
[kildekartet](research/KILDEKART_OG_INNHENTINGSSTRATEGI.md); kildekartet svarer på *hvor*
materialet finnes, mens dette dokumentet svarer på *hva vi bygger og i hvilken rekkefølge*.

## Status nå

Den opprinnelige planen la opp til Neon Postgres. Prosjektet bruker i stedet Git-versjonert
YAML som sannhet og bygger en skrivebeskyttet SQLite-fil ved bygging. Det passer dagens
bruk bedre: arkivet endres ved en merge, databasen kan bygges deterministisk på nytt, og
det finnes ingen databasetjeneste å drifte.

| Fase | Status | Merknad |
|---|---|---|
| 0. Repo og arbeidsflyt | Ferdig | Monorepo, pnpm, TypeScript, lint, tester og CI. |
| 1. Datamodell | Ferdig for pilot | Kilder, konflikter, aliaser, hendelser, lag og enkel statistikk. |
| 2. SQLite og spørringer | Ferdig | Bygges fra YAML; read-only SQL med prosessgrense. |
| 3. AI-søk | Teknisk ferdig | Verktøy og chatflyt finnes. Ekte nøkkel må fortsatt testes ende til ende. |
| 4. Portal | Delvis | Mobilvennlig direktesøk, forside, datasettbeskrivelse og enkel kampside finnes. Sesong- og motstandersider gjenstår. |
| 5. Innhøsting | Testgrunnlag klart | 450 ligakamper fra 2011–2025; fem med detaljer. |
| 6. API og MCP | Ikke startet | Bør bygges når datagrunnlaget er stabilt nok. |
| 7. Bidrag og agenter | Ikke startet | Avhenger av trygg reconcile og tydelige review-regler. |

## Beslutninger

### Git og YAML er sannheten

SQLite er et derivat. En innhøster skriver aldri direkte til databasen. Den lager en
kontrollerbar plan, og bare et eksplisitt `--write` kan skrive YAML. PR-diffen er siste
kontroll før data kommer på nettstedet.

### Fakta og fortelling er to arbeidsstrømmer

FotMob og lignende kilder kan levere dato, resultat, hendelser, lagoppstilling og statistikk.
De løser ikke behovet for kamprapporter. Journalistisk tekst, lyd, bilder og video har et
annet rettighetsgrunnlag og skal behandles separat.

Arkivet skiller derfor mellom:

- strukturerte kampfakta med proveniens per felt;
- lenker og metadata til eksterne rapporter;
- egne, selvstendige sammendrag skrevet for arkivet;
- original fulltekst bare når en avtale uttrykkelig tillater lagring og visning.

### En adapter er ikke en crawler

Hver kjøring må navngi kilde, turnering, sesong og øvre kampgrense. Det skal ikke finnes en
standardkommando som oppdager alle sesonger og starter en full backfill. Cache, fartsgrense
og få detaljer per pilot holder belastningen nede, men gir ikke i seg selv rett til bruk.

## Fase A — FotMob-faktapilot

Piloten er gjennomført mot 1. divisjon 2025:

- 30 ferdigspilte ligakamper;
- fem detaljoppslag med hendelser, lagoppstillinger og statistikk;
- 14 nye motstandere og kobling til eksisterende Raufoss IL;
- to nye stadioner fra detaljutvalget;
- FotMob-ID og kildehenvisning på hver kamp;
- ingen livekommentar, artikkeltekst, bilder, odds, momentum eller skuddkart.

Se [dekningsrapporten](data/FOTMOB_PILOT_2025.md).

For å teste portal og søk med et mer realistisk volum er ligasesongene 2011–2025
også høstet som et avgrenset testdatasett. Det gir 450 kamper, men utvider ikke
rettighetsvurderingen eller påstanden om detaljdekning. Se
[testrapporten for 2011–2025](data/FOTMOB_TESTDATA_2011_2025.md).

### Implementert flyt

```text
eksplisitt CLI-omfang
        │
        ▼
HTTP-cache + 1,1 s fartsgrense + timeout/retry
        │
        ▼
FotMob-payload → SourceMatch (ingen arkiv-ID-er her)
        │
        ▼
reconcile → plan + issues + dekningsrapport
        │
        ├── tørrkjøring (standard)
        └── --write → YAML → full arkivvalidering
```

Råresponsene ligger i `.cache/ingest/`, som er gitignorert. Bare normaliserte fakta og
dekningsrapporten er versjonert.

### Sikkerhetsgrenser

- Turnering og sesong er obligatoriske argumenter.
- En kjøring kan ikke omfatte mer enn 40 kamper.
- Detaljoppslag kan begrenses separat, maksimalt 10 per kjøring.
- Responsens faktiske sesong må være den forespurte; stille fallback avvises.
- 4xx prøves ikke på nytt. Nettverksfeil og 5xx har begrenset backoff.
- Delvis detaljhøsting blokkerer skriving, med mindre `--allow-partial` gis bevisst.
- Et eksisterende kanonisk kamp-ID-treff uten samme FotMob-alias sendes til kontroll.
- `manual[]` kopieres tilbake før validering og kan ikke overskrives av adapteren.
- FotMob alene gir `confidence: probable`, ikke `confirmed`.

### Kjørekommando

Tørrkjøring:

```sh
pnpm ingest:fotmob -- \
  --league 203 \
  --season 2025 \
  --competition forstedivisjon \
  --with-details \
  --details-limit 5 \
  --limit 30
```

Skriving krever i tillegg eksplisitt dato, slik at samme kjøring ikke lager en tilfeldig
ny diff dagen etter:

```sh
pnpm ingest:fotmob -- \
  --league 203 \
  --season 2025 \
  --competition forstedivisjon \
  --with-details \
  --details-limit 5 \
  --limit 30 \
  --retrieved-at 2026-08-03 \
  --write
```

### Resultat og begrensninger

Piloten beviser at moderne FotMob-JSON kan mappes til dagens modell og vises på siden.
Den beviser ikke full dekning tilbake til 2010, stabilitet over tid eller rett til en stor,
systematisk uthenting. FotMobs endepunkt er udokumentert, `robots.txt` blokkerer API-ruter,
og vilkårene begrenser automatisert bruk. En større backfill må derfor ha en eksplisitt
go/no-go-beslutning og helst skriftlig tillatelse.

## Fase B — Gjør reconcile klar for flere kilder

Dagens reconcile er med vilje konservativt: det lager nye kamper og kan oppdatere kamper
som allerede har samme eksterne kamp-ID. Før en kilde nummer to slippes til, trenger vi et
ordentlig observasjonslag.

Planlagt minimum:

1. Lagre snapshot-metadata: kilde, ekstern kamp-ID, hentetid, payload-hash og adapterversjon.
2. Representere hver observasjon som feltsti, rå verdi, normalisert verdi og kilde.
3. Treff først på `(sourceId, externalMatchId)`, deretter kandidat på lag, konkurranse og dato.
4. La hjemme/borte og resultat bekrefte identitet, ikke skape identiteten alene.
5. La manuelle låser vinne uten unntak.
6. Velge kilde per felt, ikke én global vinner for hele kampen.
7. Skrive reelle uenigheter til `conflicts[]`; tvetydige kampkoblinger skal aldri auto-merges.

Modellen har også kjente langsiktige gap: eksterne ID-er mangler på arena og konkurranse,
hendelser mangler stabile kilde-ID-er, og score etter 90/120 minutter bør få en tydeligere
kontrakt. Disse endringene bør gjøres før cup- og europakamper med ekstraomganger og
straffesparkkonkurranser importeres i større omfang.

Akseptanse for fase B:

- samme snapshot gir ingen diff;
- to kilder kan være uenige uten at data forsvinner;
- manuelle felt overlever alle kjøringer;
- payloadendringer gir en lesbar forklaring på valgt verdi;
- tvetydige treff gir `manual_review` og non-zero status;
- en kilde kan fjernes og bygges inn på nytt uten tap av andre kilders arbeid.

## Fase C — Kanonisk kampryggrad

Når reconcile tåler flere kilder, bygges først en komplett liste over *at kampene fant sted*.
Rike detaljer kommer etterpå.

Prioritert kildebruk:

1. NTB/NIFS via avtale som mulig norsk hovedkilde.
2. NFF/FIKS via avtale som autoritativ kontroll av regulerte kamper.
3. AaFK Historisk Arkiv for eldre kronologi, medlemsblader og klubbdokumentasjon.
4. RSSSF og åpne sesongoversikter til hulldeteksjon og kontroll der vilkårene tillater det.
5. FotMob som moderne sekundærkilde dersom rettighetsgrunnlaget avklares.

Arbeidet deles i tidsblokker, ikke én agent per kamp:

- 2010–nå: strukturerte digitale kilder;
- 1990–2009: kombinasjon av digitale kampdatabaser, klubb og avisindekser;
- 1949–1989: NIFS/NTB, årsberetninger, klubbarkiv og aviser;
- 1914–1948: klubbpublikasjoner og avisarkiv, med større usikkerhet per felt.

Hver blokk leverer kampskall, dekningsmatrise, hullliste og et kontrollutvalg før den neste
starter. Treningskamper holdes som en egen strøm fordi kildedekningen og definisjonen av
«A-lag» er svakere.

## Fase D — Kilder til kamprapporter

Rapportarbeidet starter først når kampene har stabile ID-er. Oppdagelsesjobben lagrer bare
metadata: utgiver, tittel, dato, URL, tilgangstype og hvilken kamp kilden sannsynligvis
tilhører.

Prioritert rekkefølge:

1. AaFK Historisk Arkiv og digitaliserte medlemsblader.
2. Sunnmørsposten/Polaris, fortrinnsvis avtalt eksport eller arkivtilgang.
3. NTBs Fotballrobot og NIFS-sammendrag via lisens.
4. TV 2 Livesport via avtale, særlig minuttreferat og slutt-oppsummeringer.
5. Nasjonalbibliotekets katalog-API som oppdagelseslag, ikke fulltekstlager.
6. Retriever/Atekst, NRK og motstanderens klubb/lokalavis der tilgang og bruk kan avklares.

For beskyttet innhold gjelder en fail-closed rettighetsport:

- ingen omgåelse av betalingsmur, innlogging eller CAPTCHA;
- ingen fulltekst i git eller produksjonsdatabase uten uttrykkelig rett;
- ingen tett parafrase av én artikkel som om den var egen tekst;
- korte sitater bare når de er saklig nødvendige og tydelig kreditert;
- egne sammendrag bygges av autoriserte fakta og helst flere uavhengige kilder.

## Billig agentflyt

LLM-er skal ikke brukes til arbeid som kan gjøres deterministisk.

```text
sesongjobb
  ├─ adapter: hent og normaliser (ingen LLM)
  ├─ reconcile: treff, diff og konflikter (ingen LLM)
  ├─ kontrollagent: analyser bare avvik og hull (billig modell)
  ├─ kildeagent: finn rapportmetadata per kilde/tidsblokk
  └─ redaksjonsagent: bare autoriserte kamper med rikt kildegrunnlag
```

Praktiske kostnadsgrep:

- cache alle tillatte HTTP- og søkeresultater;
- send avvik, ikke hele sesongen, til modellen;
- dedupliser NTB-stoff og republiserte artikler før tekstbehandling;
- bruk én agent per kilde og tidsblokk, ikke per kamp;
- behold modellens strukturerte påstander og regenerer tekst uten ny kildeanalyse;
- bruk dyrere modell bare ved kildekonflikt eller et faktisk rikt historisk referat.

## Neste konkrete PR-er

1. Kontrollér pilotens 30 resultater og de fem detaljkampene mot NFF eller en annen kilde.
2. Test `/api/chat` med gyldig modellnøkkel mot de ekte kampene.
3. Lag sesongside for 2025 og motstanderside fra dagens offentlige SQLite-views.
4. Bygg snapshot-/observasjonslaget og konfliktprøver før kilde nummer to.
5. Gjør en egen FotMob-dekningsprøve av 2011 uten å skrive data, særlig cup/europa og
   manglende statistikk.
6. Ta go/no-go for en eventuell 2010–nå-backfill etter rettighetsavklaring.
7. Start dialog med NTB, NFF og AaFK Historisk Arkiv parallelt; de avgjør hvor komplett og
   fortellende arkivet kan bli.

## Ferdigkriterium for første offentlige beta

- minst én hel sesong er kontrollert mot to kilder;
- kampside, sesongside, motstanderside og faktasøk fungerer uten AI;
- AI-søk svarer med lenker til de samme kampene og viser kjørt SQL;
- kildestatus og usikkerhet vises, ikke bare lagres;
- ingen beskyttet fulltekst er lagret uten avtale;
- innhøsting kan kjøres på nytt uten å overskrive manuelt arbeid;
- CI validerer alle YAML-filer, bygger SQLite og tester de viktigste spørsmålene.
