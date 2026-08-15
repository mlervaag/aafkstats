# @aafkstats/db

SQLite-laget: skjemaet, byggesteget, og guardrailen rundt SQL som kommer utenfra.

```
src/
├── schema.sql      Tabeller (core_*), views (den offentlige kontrakten), FTS
├── build.ts        Bygger arkivfilen fra en validert YAML-katalog
├── index.ts        Åpning av filen, og hvor den ligger
├── safe-sql.ts     Kjører fremmed SELECT i egen prosess, med grenser
└── cli/build.ts    «pnpm db:build»
```

## Ansvar

**Arkivfilen bygges fra bunnen, aldri inkrementelt.** Resultatet avhenger da bare av
innholdet i `data/`: to bygg av samme commit gir samme fil, og en slettet YAML-fil forsvinner
faktisk. De 1 482 kampene og 544 kildedokumenterte resultatoppføringene bygges lokalt til én liten SQLite-fil; byggetid og filstørrelse er
miljøavhengige og behandles ikke som arkivfakta.

**Skillet mellom rådata og publisert datasett ligger i navnet.** SQLite har ingen schemas, så
tabellene heter `core_*` og er interne, mens viewene uten prefiks er den offentlige
kontrakten: `matches`, `venues`, `seasons`, `opponents`, `standings`, `squad`, `match_events`,
`match_conflicts`, `people`, `person_roles`, `person_conflicts`, `organizations`,
`organization_snapshots`, `providers`, `sources`,
`contributions`, `publication_extractions`, `fact_candidates`, `source_results`,
`resolved_roles`, `resolved_lineups` og FTS-tabellen `reports`.
Spørrefunksjonen ser bare viewene.

`resolved_roles` og `resolved_lineups` er et eksplisitt kandidatlag. Radene har kilde,
side og sikkerhetsnivå, men er ikke kanoniske personroller eller kampoppstillinger før de
er kontrollert og flyttet til de ordinære arkivfilene.

**Alt som kan løses én gang, løses ved bygging.** AaFK-perspektivet, tidsavhengige navn og
fullstendighet regnes ut her i stedet for per spørring. Navnet for en gitt kampdato kan aldri
endre seg, så oppslaget hører hjemme i byggesteget.

## Bruk

```ts
import { open, all, one, archivePath } from "@aafkstats/db";
import { runSafeSql } from "@aafkstats/db/sql";
import { loadValidateAndBuild } from "@aafkstats/db/build";

const db = open();                     // skrivebeskyttet, håndhevet av SQLite
const rows = all(db, "SELECT * FROM matches WHERE season = ?", 2019);

// Fremmed SQL — modellens, eller en annens — går alltid gjennom denne:
const r = await runSafeSql("SELECT count(*) FROM matches");
```

```sh
pnpm db:build                                # bygger fra data/
AAFK_DATA_DIR=fixtures/data pnpm db:build    # bygger fra fixtures
```

| Miljøvariabel | Betydning |
|---|---|
| `AAFK_DATA_DIR` | Hvilken datakatalog som bygges. Relativ til repo-rota |
| `AAFK_DB_PATH` | Hvor arkivfilen skrives og leses. Standard `apps/web/.data/aafkstats.sqlite` |

## Guardrailen

`runSafeSql()` er inngangen for SQL vi ikke har skrevet selv. Seks lag, i synkende alvor:

| Lag | Håndheves av |
|---|---|
| Filen åpnes med `readOnly` | **SQLite** |
| Egen Node-prosess, `SIGKILL` ved timeout (3 s) | **operativsystemet** |
| Prosessen får et miljø uten hemmeligheter, og 256 MB haugtak | **operativsystemet** |
| Én setning, kun SELECT/WITH, ingen `core_*`, `sqlite_*` eller `pragma_*` | koden |
| Radtak på 200, og 256 kB uansett hvor mange rader | koden |
| Varighet, radtall og feil rapporteres tilbake | koden |

**De tre første er sikkerhet**, og de holder uansett hva tekstanalysen skulle overse.

**Navnekontrollen er unntaket.** Den *er* grensen mot `core_`-tabellene, for SQLite har
ingen roller og kan ikke gi leserett på viewene alene. Derfor leses spørringen i to utgaver:

- `stripLiterals()` blanker ut strenger, siterte identifikatorer og kommentarer. Mot den
  sjekkes setningsdeling og nøkkelord, slik at `WHERE note = 'a;b'` ikke avvises som flere
  setninger og `SELECT "drop"` ikke leses som en DROP.
- `revealIdentifiers()` pakker i stedet ut de siterte identifikatorene. Mot den sjekkes
  navnene, for SQLite godtar `"core_matches"`, `[core_matches]` og `` `core_matches` `` som
  samme tabell. Blankes de, gjemmer et par anførselstegn navnet for filteret.

Begge bevarer posisjonene, så feilmeldingene peker fortsatt på riktig sted.

Navnefiltrene dekker navnerom, ikke lister: `sqlite_(?!version)\w+` i stedet for de kjente
systemtabellene, og `pragma\w*` fordi PRAGMA også finnes som tabellverdifunksjon —
`pragma_database_list` røper hvor arkivfilen ligger på disk.

Hvorfor en egen prosess: SQLite har ingen `statement_timeout`, og `DatabaseSync` er synkron.
En spørring som blokkerer i motoren holder tråden, og `Worker.terminate()` venter på at
kallet returnerer. Prosessen er den eneste tingen som faktisk kan drepes. Kostnaden er rundt
45 ms per spørring.

Prosessen får bare `PATH` — ikke `ANTHROPIC_API_KEY` eller `OPENAI_API_KEY`, og med vilje heller ikke
`NODE_OPTIONS`, som kan bære en `--require` og dermed kjøre fremmed kode i det innerste
laget. Feilmeldinger går gjennom `scrubPaths()` før de sendes videre, siden de havner både i
modellens kontekst og på skjermen.

Byte-taket finnes fordi radtaket ikke sier noe om størrelse: én celle kan være vilkårlig stor
(`SELECT hex(zeroblob(…))` holder), og resultatet går rett inn i modellens kontekst. Det er
like mye en kostnadsgrense som en minnegrense.

## Verdt å vite

**`node:sqlite` hentes via `createRequire`.** Modulen er eksperimentell i Node 22 og står
ikke i Nodes `builtinModules`. Bundlere bruker den lista til å kjenne igjen innebygde
moduler, og stripper ellers `node:`-prefikset og leter etter en npm-pakke som ikke finnes. Se
kommentaren i `index.ts` — den gjelder også `next.config.mjs`.

**To stifunksjoner, med vilje.** `archiveBuildPath()` brukes av byggesteget og regner fra
`import.meta.url`. `archivePath()` brukes av lesende kode og prøver cwd-baserte kandidater,
fordi stien etter Next sin bunting peker inn i `.next/server/`.

**`openForBuild()` har et stygt navn med hensikt.** Alt som svarer på en HTTP-forespørsel
skal bruke `open()`. Dukker `openForBuild` opp i en forespørselssti, skal det være synlig i
diffen.

**Testene prøver å bryte lagene.** `test/safe-sql.integration.test.ts` går mot en ekte
arkivfil, inkludert direkte skriveforsøk utenom koden.
