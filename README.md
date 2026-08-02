# AaFK-arkivet

Fritt og åpent arkiv over Aalesunds Fotballklubbs kamphistorikk — bygget som en portal der
spørsmål til dataene er hovedinngangen.

```
«Når tapte vi sist med 6 mål på hjemmebane?»
```

Alt ligger som YAML-filer i `data/`. Ved hver utrulling bygges de om til et Postgres-skjema
som nettstedet, REST-API-et, MCP-serveren og spørrefunksjonen leser fra.

## Hvordan det henger sammen

```
data/ (YAML, git)  ──build──►  Postgres  ──►  nettsted · REST-API · MCP · chat
      ▲                                              │
      └────────── PR fra /bidra og agentrutiner ◄────┘
```

**Git er sannheten.** Databasen er et derivat som når som helst kan kastes og bygges opp
igjen fra filene. Det er dét som holder arkivet fritt og åpent: alt kan klones, forkes og
rettes via pull request, og hver rettelse har en historikk.

## Kom i gang

```sh
pnpm install
cp .env.example .env          # juster DATABASE_URL om nødvendig

pnpm db:migrate               # oppretter core, public_api og chat-rollen
AAFK_DATA_DIR=fixtures/data pnpm db:sync
pnpm dev                      # http://localhost:3000
```

For at spørrefunksjonen skal virke må `ANTHROPIC_API_KEY` settes i `.env`. Resten av
nettstedet fungerer uten.

`fixtures/data` er et lite konstruert arkiv brukt til utvikling og tester — se
`fixtures/README.md`. Det ekte arkivet i `data/` fylles av innhøstingen i `packages/ingest`.

## Kommandoer

| Kommando | Hva den gjør |
|---|---|
| `pnpm validate` | Validerer hele arkivet: skjema, referanser, duplikater |
| `pnpm db:migrate` | Kjører migrasjonene |
| `pnpm db:sync` | Laster `data/` inn i Postgres, i én transaksjon |
| `pnpm test` | Kjører testene. Databasetestene hoppes over uten `DATABASE_URL` |
| `pnpm dev` | Starter nettstedet |

## Oppbygging

| Katalog | Innhold |
|---|---|
| `data/` | Arkivet. YAML, én fil per kamp |
| `fixtures/data/` | Konstruert testarkiv |
| `packages/schema/` | Zod-skjema, validering, avledning til AaFK-perspektiv |
| `packages/db/` | Migrasjoner, synkronisering, SQL-guardrails |
| `packages/query/` | Datasettdokumentasjon, verktøy og systemprompt |
| `apps/web/` | Next.js: portal, `/api/chat`, `/data` |

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

`public_api.matches` flater hver kamp ut til AaFKs synsvinkel: `is_home`, `opponent`,
`aafk_score`, `goal_difference`, `result`. Uten dette må enhver spørring først finne ut
hvilken side vi spilte på. Med det blir åpningsspørsmålet én `WHERE`-setning:

```sql
SELECT date, opponent, aafk_score, opponent_score, url
FROM public_api.matches
WHERE is_home AND result = 'T' AND goal_difference <= -6
ORDER BY date DESC LIMIT 1;
```

## Spørrefunksjonen og grensene rundt den

Chatten kan skrive og kjøre egne SELECT-spørringer. Det er dét som gjør at den kan svare på
spørsmål ingen har laget et ferdig oppslag for. Fem lag holder det trygt:

| Lag | Håndheves av |
|---|---|
| Rollen `aafk_chat` har SELECT kun på `public_api` | **Postgres** |
| Skrivebeskyttet transaksjon med `statement_timeout` | **Postgres** |
| Én setning, kun SELECT/WITH | koden |
| Radtak på 200, påtvunget ved innpakking | koden |
| Logging av hver spørring | koden |

Bare de to første er sikkerhet. De tre siste finnes for å gi modellen forståelige
feilmeldinger — hele opplegget skal være trygt selv om de skulle svikte. Testene i
`packages/db/test/` prøver å bryte hvert lag, inkludert direkte mot databasen utenom koden.

Datasettdokumentasjonen på `/data` er **samme kilde** som chattens systemprompt
(`packages/query/src/dataset.ts`). Det finnes ingen skjult beskrivelse modellen har og
brukeren ikke har, og en test feiler hvis dokumentasjonen ikke stemmer med databasen.

## Lisens

Kode under MIT (`LICENSE`), data under CC BY 4.0 (`DATA_LICENSE.md`).

**Referat skrives alltid for dette arkivet — aldri kopiert fra avis eller klubbside.**
Fakta er frie, tekst er det ikke. Se `DATA_LICENSE.md`.

## Status

Grunnmuren står: datamodell, database, guardrails, portal og datasettdokumentasjon.
Gjenstår: innhøsting fra kildene, REST-API, MCP-server, bidragsside og agentrutinene.
