# AaFK-arkivet

Fritt og åpent arkiv over Aalesunds Fotballklubbs kamphistorikk — bygget som en portal der
spørsmål til dataene er hovedinngangen.

```
«Når tapte vi sist med 6 mål på hjemmebane?»
```

Alt ligger som YAML-filer i `data/`. Ved hver utrulling bygges de om til en skrivebeskyttet
SQLite-fil som nettstedet og spørrefunksjonen leser fra. REST-API og MCP er planlagt.

## Hvordan det henger sammen

```
data/ (YAML, git)  ──build──►  aafkstats.sqlite  ──►  nettsted · søk · chat
      ▲                                                      │
      └────────────── kontrollert pull request ◄─────────────┘
```

**Git er sannheten.** Arkivfilen er et derivat som når som helst kan kastes og bygges opp
igjen fra filene. Det er dét som holder arkivet fritt og åpent: alt kan klones, forkes og
rettes via pull request, og hver rettelse har en historikk.

**Hvorfor en fil og ikke en databasetjeneste.** Dataene endrer seg bare når noen merger en
PR, og hver merge utløser en ny utrulling. En byggetidsfil er derfor fersk per definisjon —
og den bygges på under ti millisekunder. Det gir null tjenester å drifte, ingen kaldstart,
og tester som kjører likt overalt fordi de bygger sin egen fil. Skrivetilstanden som en
database ellers ville båret (rate-limiting, bruksmåling) hører hjemme foran applikasjonen,
ikke inni datasettet — se «Spørrefunksjonen» nedenfor.

## Kom i gang

```sh
pnpm install
cp .env.example .env

AAFK_DATA_DIR=fixtures/data pnpm db:build   # bygger apps/web/.data/aafkstats.sqlite
pnpm dev                                    # http://localhost:3000
```

Uten `AAFK_DATA_DIR` bygges arkivet fra de ekte kampene i `data/`. Arkivfilen ligger ikke
i git: binærfiler gir ubrukelige
differ, og den bygges fra kildefilene på et øyeblikk uansett.

For at spørrefunksjonen skal virke må `ANTHROPIC_API_KEY` settes i `.env`. Resten av
nettstedet fungerer uten.

`fixtures/data` er et lite konstruert arkiv brukt til utvikling og tester — se
`fixtures/README.md`. Det ekte arkivet i `data/` kan fylles av de avgrensede verktøyene i
`packages/ingest`, men hver kilde må først gjennom en deknings- og rettighetsvurdering.

Hvilke kilder som kan brukes, og hvordan, er kartlagt i
[Kildekart og innhentingsstrategi](docs/research/KILDEKART_OG_INNHENTINGSSTRATEGI.md).
Les den før du skriver en adapter — flere av de opplagte kildene er røde.
Den reviderte gjennomføringsrekkefølgen står i
[Plan fra faktapilot til historisk arkiv](docs/PLAN_FRA_PILOT_TIL_ARKIV.md).

## Kommandoer

| Kommando | Hva den gjør |
|---|---|
| `pnpm validate` | Validerer hele arkivet: skjema, referanser, duplikater |
| `pnpm ingest:fotmob -- --league ID --season ÅR --competition ID` | Tørrkjører én eksplisitt FotMob-sesong |
| `pnpm db:build` | Bygger arkivfilen fra `data/`. Respekterer `AAFK_DATA_DIR` |
| `pnpm test` | Kjører testene. Ingen tjeneste kreves — de bygger sitt eget arkiv |
| `pnpm typecheck` | Typesjekker pakkene og nettstedet |
| `pnpm lint` | ESLint over hele monorepoet |
| `pnpm dev` | Starter nettstedet |
| `pnpm build` | Bygger arkivfilen og deretter nettstedet |

## Oppbygging

| Katalog | Innhold |
|---|---|
| `data/` | Arkivet. YAML, én fil per kamp |
| `fixtures/data/` | Konstruert testarkiv |
| `packages/schema/` | Zod-skjema, validering, avledning til AaFK-perspektiv |
| `packages/db/` | SQLite-skjema, byggesteget, SQL-guardrails |
| `packages/ingest/` | Avgrenset innhøsting, cache, normalisering og reconcile |
| `packages/query/` | Datasettdokumentasjon, verktøy og systemprompt |
| `apps/web/` | Next.js: portal, `/api/chat`, `/data` |
| `docs/research/` | Kildekart og innhentingsstrategi |

## Datamodellen

Fire valg som resten hviler på:

1. **Stabile ID-er.** Kamp-ID = filnavn = `YYYY-MM-DD-hjemmelag-bortelag`, pluss `aliases`
   mot eksterne kilder. Gjør re-scraping idempotent.
2. **Navn er tidsavhengige.** En kamp fra 1998 viser «Tippeligaen», en fra 2024 viser
   «Eliteserien» — samme konkurranse, riktig navn på riktig dato.
3. **Konkurransetype driver navigasjonen.** Liga/cup/europa/trening kommer fra data, ikke
   fra hardkoding.
4. **Kilde og konflikt per felt.** Hver opplysning bærer sin egen kilde. Når kilder er
   uenige, bevares uenigheten i `conflicts[]` framfor å skjules.

Bare seks felt er påkrevd på en kamp. En kamp fra 1930 der vi kjenner dato og motstander
skal kunne ligge i arkivet med `confidence: probable` og forbedres senere — det er bedre
enn å holdes utenfor til noen har full oversikt.

### AaFK-perspektivet

`matches` flater hver kamp ut til AaFKs synsvinkel: `is_home`, `opponent`, `aafk_score`,
`goal_difference`, `result`. Uten dette må enhver spørring først finne ut hvilken side vi
spilte på. Med det blir åpningsspørsmålet én `WHERE`-setning:

```sql
SELECT date, opponent, aafk_score, opponent_score, url
FROM matches
WHERE is_home = 1 AND result = 'T' AND goal_difference <= -6
ORDER BY date DESC LIMIT 1;
```

Tabellene bak viewene heter `core_*` og er utilgjengelige for spørrefunksjonen. Skillet
mellom rådata og publisert datasett er dermed synlig i navnet, ikke bare i dokumentasjonen.

## Spørrefunksjonen og grensene rundt den

Chatten kan skrive og kjøre egne SELECT-spørringer. Det er dét som gjør at den kan svare på
spørsmål ingen har laget et ferdig oppslag for. Fem lag holder det trygt:

| Lag | Håndheves av |
|---|---|
| Filen åpnes med `readOnly` | **SQLite** |
| Spørringen kjøres i en egen prosess som drepes med `SIGKILL` ved timeout | **operativsystemet** |
| Én setning, kun SELECT/WITH, ingen `core_*` eller `sqlite_*` | koden |
| Radtak på 200 | koden |
| Logging av hver spørring | koden |

Bare de to første er sikkerhet. De tre siste finnes for å gi modellen forståelige
feilmeldinger — hele opplegget skal være trygt selv om de skulle svikte.

SQLite har ingen `statement_timeout`, og en spørring som blokkerer i motoren lar seg ikke
avbryte fra JavaScript: kallet er synkront og holder tråden. En `Worker` ville ikke hjulpet,
for `terminate()` venter på at det pågående kallet returnerer. Derfor kjøres hver spørring i
en egen Node-prosess som avlives utenfra. Kostnaden er rundt 45 ms per spørring, og det er
den eneste måten grensen faktisk holder.

Rate-limiting og bruksmåling ligger foran applikasjonen — Vercel Firewall og et kostnadstak
i Anthropic Console — ikke i datasettet. Testene i `packages/db/test/` prøver å bryte hvert
lag, inkludert direkte mot arkivfilen utenom koden.

Datasettdokumentasjonen på `/data` er **samme kilde** som chattens systemprompt
(`packages/query/src/dataset.ts`). Det finnes ingen skjult beskrivelse modellen har og
brukeren ikke har, og en test feiler hvis dokumentasjonen ikke stemmer med databasen.

## Lisens

Kode under MIT. Egne tekster og arkivets eget redaksjonelle innhold under CC BY 4.0.
Tredjepartskilder har egne vilkår — se `DATA_LICENSE.md` og `data/sources/`.

**Referat skrives alltid for dette arkivet — aldri kopiert fra avis eller klubbside.**
Fakta er frie, tekst er det ikke. Se `DATA_LICENSE.md`.

## Status

Grunnmuren står: datamodell, database, guardrails, portal og datasettdokumentasjon.
Testarkivet har 450 ligakamper fra 15 sesonger (2011–2025); fem kamper fra 2025 har
hendelser, lagoppstillinger og statistikk. Hovedfeltet gir direkte kamptreff mens brukeren
skriver år og motstander; Enter sender i stedet teksten til AI-søket. Se
[testrapporten for 2011–2025](docs/data/FOTMOB_TESTDATA_2011_2025.md) og
[detaljpiloten for 2025](docs/data/FOTMOB_PILOT_2025.md). Gjenstår blant annet flere
kampklasser, rettighetsavklart innhøsting, REST-API, MCP-server, et automatisk
bidragsskjema og agentrutinene.
