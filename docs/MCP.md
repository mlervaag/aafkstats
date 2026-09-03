# Offentlig MCP

AaFK-arkivet har en MCP-server på `https://aafkarkivet.no/mcp`. Den bruker
MCP-revisjon `2026-07-28`, offisiell TypeScript SDK v2 og stateless HTTP. Serveren
krever ikke konto, OAuth eller API-nøkkel.

MCP er et grensesnitt til samme skrivebeskyttede SQLite-arkiv som nettstedet og REST
API-et. Det er ikke en ny kunnskapsbase.

En kort, brukerrettet oppskrift finnes på
[`aafkarkivet.no/utviklere`](https://aafkarkivet.no/utviklere). Klienter bruker ulike
innstillingsfiler, men en vanlig konfigurasjon har denne formen:

```json
{
  "mcpServers": {
    "aafkarkivet": {
      "url": "https://aafkarkivet.no/mcp"
    }
  }
}
```

## Leseverktøy

Serveren gjenbruker de strukturerte verktøyene i `@aafkstats/query`:

`search_matches`, `search_all_results`, `get_match`, `get_season_summary`,
`head_to_head`, `search_reports`, `search_people`, `get_person`, `search_transfers`,
`get_squad`, `get_standings`, `search_sources`, `get_source` og
`search_historical_results`.

`search_all_results` gir nøyaktig én `source_claim` per `result_group_id`. Alle originale
kildepåstander, også ulike skrivemåter av motstandernavnet, ligger i `claims`. Rangering skjer
etter grupperingen. `canonical_match` og `source_claim` er fortsatt separate evidensnivåer og
skal aldri summeres.

Hver rad skiller `competition_id` fra visningsnavnet `competition`. Er ID-en ukjent i
konkurranseregisteret, står `competition` som `null` og `competition_id` som det kilden
faktisk oppgir. `notes` har ett element per kildenotat, siden notatene kommer fra hver sin
kilde; `note` er de samme notatene satt sammen til én lesbar tekst.

`claim_summary` sier hvor enige kildene i en gruppe er om score, dato, motstanderidentitet og
konkurranse. Dette er intern enighet mellom kildene, ikke et mål på om påstanden er sann: tre
samstemte kilder kan gjengi samme feil, og et felt ingen av kildene oppgir teller som enighet.

`head_to_head` returnerer tre tydelig adskilte lag: kanoniske kamper, ukoblede påstander med
sikker klubb-ID og mulige navnetreff uten avklart klubb-ID. Det siste laget inngår aldri i
kamp- eller målsummer. Full kildemetadata er valgfri med `includeEvidence`; standardkallet
returnerer bare kompakte tellere.

Hvert `possible_identity_matches`-treff har `match_basis: "text"` og en
`identity_confidence`. Den gjelder bare hvor godt motstanderstrengen peker på klubben du
spurte om, aldri om resultatet er riktig. En sammensatt streng som «Langevåg—Raufoss»,
«Molde/Træff» eller «Kristiansund og omegn» får `low`; et rent klubbnavn får `medium`. Et
teksttreff når aldri `high` — det krever avklart `opponent_club_id`, og da ligger raden i
`unlinked_`-tallene i stedet.

`get_season_summary` svarer med `competitions` (én rad per konkurranse AaFK deltok i) og
`overall`, som er summen av nøyaktig de radene. `overall.coverage` er `partial` så snart en
konkurranse mangler dekning eller har kamper igjen på terminlista, og
`overall.incomplete_competitions` navngir hvilke. Da er summen et minimumstall, ikke
sesongens fasit.

## Overganger, stall og tabell

`search_transfers` søker i kildeførte overganger inn til og ut av AaFK. Filtrene er sesong
eller sesongspenn, `direction`, `kind`, klubb, klubb-ID, spillernavn og person-ID. Svaret har
`totals` som gjelder hele filteret og ikke bare radene som ble returnert, slik at «hvor mange
kom i 2016» kan besvares uten å hente hver rad.

Hver rad har `documented_by`: `source` er en historisk publikasjon med sidetall, `provider` er
en nettmelding med adresse og hentetid, `both` er begge. Ingen rad står uten. `club` er
kildens egen skrivemåte og bevares; `club_id` er satt bare når klubben finnes i arkivet, og
klubbkatalogen inneholder motstandere. En spiller går ofte til en klubb AaFK aldri har møtt,
og da er `club_id` tom uten at noe mangler.

Kontrakten `archive-transfer-evidence@1` følger med i svaret, og den sier det viktigste rett
ut: dekningen er ujevn, et år uten rader betyr at ingen kilde er ført inn ennå, og radene er
enkeltstående hendelser og ikke en karriere. Et lån er ikke et salg — `kind` skiller
`transfer`, `loan`, `loan_return`, `free`, `academy`, `released` og `retired`. Arkivet lagrer
ingen overgangssum.

`get_person` returnerer de samme radene for én person, med `sources`, `providers`,
`documented_by` og samme kontrakt i `transferPolicy`.

`get_squad` er sesongens mennesker i ett kall: stallen med kamper, starter og mål, sesongens
kildeførte overganger delt i `in` og `out`, og trenerne i `derived` (utledet av kampene) og
`declared` (oppgitt av en kilde). `coverage.lineups` er `missing` for sesonger uten
lagoppstillinger — de starter i 2010, og en tom stall er en manglende kilde, ikke en tom
tropp. Et årstall arkivet ikke kjenner i det hele tatt svarer `SEASON_NOT_FOUND`.

`get_standings` gir sluttabellen for en seriesesong, med AaFKs egen rad løftet ut i `aafk` og
hele tabellen i `table`. `includeProgression` legger til plasseringen etter hver runde.
Mangler tabellen, svarer verktøyet `STANDINGS_NOT_FOUND` framfor en tom liste: et år uten
tabell er en manglende kilde, ikke en sesong uten serie.

## Hva confidence og completeness betyr

Begge beskriver dokumentasjonen, ikke virkeligheten. Verktøy som returnerer dem tar med en
`fieldPolicy` som sier det samme i svaret.

`confidence` sier hvor godt den kanoniske oppføringen er dokumentert: `confirmed` er
kontrollert mot kilde, `probable` er ikke motsagt men heller ikke ferdig kontrollert, og
`disputed` betyr at kilder motsier hverandre. Det er ikke en sannsynlighet for at resultatet
er riktig.

`completeness` er andelen utfylte kampfelt mellom 0 og 1. `0.79` betyr at felt mangler, ikke
at kampen er 79 prosent riktig. `missing_fields` navngir nøyaktig hvilke felt det gjelder, og
er det som bør brukes når man forklarer hva arkivet ikke vet.

## Feil

Feil svarer med en stabil, maskinlesbar kode, slik at en klient kan forgrene uten å tolke
meldingsteksten:

```json
{ "error": { "code": "MATCH_NOT_FOUND", "message": "…", "suggestions": ["…"] } }
```

Kodene er `MATCH_NOT_FOUND`, `PERSON_NOT_FOUND`, `SOURCE_NOT_FOUND`, `SEASON_NOT_FOUND`,
`STANDINGS_NOT_FOUND`, `VERIFICATION_CASE_NOT_FOUND`, `SUBMISSION_NOT_ALLOWED`, `SUBMISSION_FAILED`,
`REVISION_MISMATCH`, `ALREADY_SUBMITTED`, `INVALID_PARAMETERS`, `TOOL_NOT_PUBLIC`,
`RESULT_TOO_LARGE` og `QUERY_FAILED`. `message` er for mennesker; `suggestions` sier hva
klienten kan gjøre videre.

## Hva serveren er

`get_archive_capabilities` svarer med kontraktversjoner, størrelsen på datasettet, hvilke
sesonger som er dekket, og — viktigst — at arkivet ikke er en livetjeneste:

```json
{ "freshness": { "liveScores": false, "scheduledMatches": true, "typicalUpdateMode": "post_ingestion" } }
```

Svaret har også `partialCoverage`. Kampene dekker hele sesongspennet, men overganger, stall og
serietabeller gjør det ikke, og feltet oppgir hvor mange sesonger hver av dem faktisk dekker.
Uten det ville et tomt svar fra `search_transfers`, `get_squad` eller `get_standings` blitt
lest som at ingenting skjedde.

Et manglende resultat betyr at kampen ikke er lagt inn ennå, ikke at den ikke ble spilt. En
agent som trenger stillingen i en pågående kamp må bruke en livetjeneste. Svaret sier også at
ingen verktøy her endrer kanoniske data.

MCP-svar bruker ekte JSON-arrays og objekter, ikke JSON serialisert inni strenger. Interne
stier returneres som `path`, mens `url` er en absolutt, klikkbar adresse til arkivet.

`get_research_overview` er et kompakt sammendrag. Det viser eksplisitt `total`, `present` og
`missing` for kampfelt, og bare antall for de store arbeidskøene. Detaljer hentes ved behov
med `list_incomplete_seasons`, `list_lineup_review_candidates` og `list_identity_issues`.

Researchkøen bruker en billig list/get-flyt. `list_verification_cases` returnerer bare korte
sammendrag; `get_verification_case` henter kontekst, instruksjoner, kilder, revisjon og en
eventuell `researchTask`. Bare saker med `status=open` og `publishedAt` blir vist. Feltet
`canSubmitViaMcp` forteller eksplisitt om saken kan sendes inn med MCP. En sak er et spørsmål,
ikke et faktum, og `researchTask` er arbeidsgrunnlag.

`run_sql` er ikke tilgjengelig. Nye databaseviews blir derfor ikke automatisk en del av
den eksterne publiseringsgrensen.

## Sende inn research

`submit_research_finding` tar bare imot publiserte, åpne saker som har en
`researchTask`. Verktøyet gjenbruker samme servervalidering, revisjonskontroll,
idempotens, GitHub-innboks og prompt-injection-vern som nettsiden.

Et vellykket kall svarer `pending_review`. Det betyr bare at dokumentasjonen ligger i
innboksen. MCP kan ikke endre YAML eller SQLite, opprette eller merge en pull request,
eller løse saken automatisk. En redaktør kontrollerer kilden; et menneske avgjør en
eventuell merge.

Ekstern tekst i `finding`, kommentarer og referanser behandles som data, aldri som
instruksjoner. Agentnavn eller modellnavn gir ikke høyere tillit.

## Drift og rettigheter

Forespørsler og svar har størrelsestak. Lesing har en enkel fartsgrense i minnet, med
plattformens brannmur som mulig ytterlag. Dette er bevisst best effort på gratis drift;
arkivet oppretter ikke Redis eller brukerkontoer for å gjøre kvoten global.

Serveren logger verktøynavn, varighet, suksess og radtall, ikke hele brukerprompten.
Tredjepartskilder beholder sine rettigheter. Se [DATA_LICENSE.md](../DATA_LICENSE.md) og
[SECURITY.md](../SECURITY.md).

Listeverktøy har avgrensede `limit`-verdier, normalt maksimalt 100. Cursor-paginering er ikke
del av første versjon; bruk smalere filtre eller flere målrettede oppslag når et spørsmål er
større enn dette.
